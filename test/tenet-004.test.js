import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { act, resolveField } from "../src/field.js";
import {
  interpretAddressedTenetArrival,
  makeAddressedTenetTransferSpec,
  makeTenetPayload
} from "../src/crossing.js";
import { writeAddressedJson } from "../src/payload-store.js";
import {
  closeHttpContentProvider,
  createHttpContentProviderServer,
  fileContentProvider,
  httpContentProvider,
  listenHttpContentProvider,
  retrieveFromProviders
} from "../src/content-road.js";

function makeSource() {
  const place = { id: "place:source" };
  const author = {
    id: "actor:source",
    held: [
      {
        id: "tenet-seed:004",
        kind: "tenet-seed",
        label: "Carry water forward.",
        offeredActionLabel: "Water the sapling",
        requiredHeldKind: "water"
      }
    ]
  };
  const field = resolveField({ place, actor: author, traces: [] });
  const trace = act({
    place,
    actor: author,
    field,
    actionId: "leave-tenet",
    occurredAt: "2026-10-04T18:40:00Z",
    traces: []
  }).traces.find((item) => item.kind === "tenet");

  const payload = makeTenetPayload(trace);
  return { trace, payload };
}

function fakeCrossing(spec) {
  return {
    crossing_id: "relatte-crossing:tenet-004",
    source_world: spec.source_world,
    payload_refs: spec.payload_refs,
    extensions: {
      organ_adapter: {
        family_ref: spec.family_ref,
        donor_claims: spec.donor_claims
      }
    }
  };
}

function admitReceipt() {
  return {
    crossing_id: "relatte-crossing:tenet-004",
    world_id: "world:destination",
    receiver_particular: "receiver:destination",
    contract_ref: "contract:destination/v0",
    kind: "R3_ADMIT",
    semantic_effect: "candidate",
    receipt_id: "receipt:admit:tenet-004"
  };
}

test("two independent providers serve identical bytes for one world-seed address", async () => {
  const base = await mkdtemp(join(tmpdir(), "gro-tenet-004-providers-"));
  const rootA = join(base, "provider-a");
  const rootB = join(base, "provider-b");
  const server = createHttpContentProviderServer({ root: rootB });

  try {
    const { payload } = makeSource();
    const a = await writeAddressedJson(rootA, payload);
    const b = await writeAddressedJson(rootB, payload);
    assert.equal(a.address, b.address);

    const baseUrl = await listenHttpContentProvider(server);
    const providerA = fileContentProvider({ id: "provider:a", root: rootA });
    const providerB = httpContentProvider({
      id: "provider:b",
      baseUrl
    });

    const fromA = await retrieveFromProviders(a.address, [providerA]);
    const fromB = await retrieveFromProviders(a.address, [providerB]);

    assert.equal(fromA.providerKind, "file");
    assert.equal(fromB.providerKind, "http");
    assert.deepEqual(fromA.bytes, fromB.bytes);
  } finally {
    await closeHttpContentProvider(server);
    await rm(base, { recursive: true, force: true });
  }
});

test("provider path does not change local GrO trace identity", async () => {
  const base = await mkdtemp(join(tmpdir(), "gro-tenet-004-identity-"));
  const rootA = join(base, "provider-a");
  const rootB = join(base, "provider-b");
  const server = createHttpContentProviderServer({ root: rootB });

  try {
    const { trace, payload } = makeSource();
    const a = await writeAddressedJson(rootA, payload);
    const b = await writeAddressedJson(rootB, payload);
    assert.equal(a.address, b.address);

    const spec = makeAddressedTenetTransferSpec({
      trace,
      payloadAddress: a.address,
      sourceWorld: "world:source",
      createdAt: "2026-10-04T18:41:00Z"
    });
    const crossing = fakeCrossing(spec);
    const baseUrl = await listenHttpContentProvider(server);

    const providers = [
      fileContentProvider({ id: "provider:a", root: rootA }),
      httpContentProvider({ id: "provider:b", baseUrl })
    ];

    const common = {
      crossing,
      dispositionReceipt: admitReceipt(),
      destination: {
        worldId: "world:destination",
        placeId: "place:rain-room"
      },
      localRules: {
        offeredActionLabel: "Refill the rain bowl"
      }
    };

    const viaA = await interpretAddressedTenetArrival({
      ...common,
      resolvePayloadBytes: async (address) =>
        (await retrieveFromProviders(address, [providers[0]])).bytes
    });

    const viaB = await interpretAddressedTenetArrival({
      ...common,
      resolvePayloadBytes: async (address) =>
        (await retrieveFromProviders(address, [providers[1]])).bytes
    });

    assert.equal(viaA.trace.traceId, viaB.trace.traceId);
    assert.deepEqual(viaA.trace.tenet, viaB.trace.tenet);
    assert.equal(viaA.trace.crossing.payloadAddress, a.address);
  } finally {
    await closeHttpContentProvider(server);
    await rm(base, { recursive: true, force: true });
  }
});

test("one provider may die and fallback still resolves the same addressed seed", async () => {
  const base = await mkdtemp(join(tmpdir(), "gro-tenet-004-failover-"));
  const rootA = join(base, "provider-a");
  const rootB = join(base, "provider-b");
  const server = createHttpContentProviderServer({ root: rootB });

  try {
    const { payload } = makeSource();
    const a = await writeAddressedJson(rootA, payload);
    await writeAddressedJson(rootB, payload);

    const baseUrl = await listenHttpContentProvider(server);
    const providerA = fileContentProvider({ id: "provider:a", root: rootA });
    const providerB = httpContentProvider({ id: "provider:b", baseUrl });

    await rm(rootA, { recursive: true, force: true });

    const result = await retrieveFromProviders(a.address, [
      providerA,
      providerB
    ]);

    assert.equal(result.providerId, "provider:b");
    assert.equal(result.attempts[0].status, "failed");
    assert.equal(result.attempts[1].status, "served");
  } finally {
    await closeHttpContentProvider(server);
    await rm(base, { recursive: true, force: true });
  }
});
