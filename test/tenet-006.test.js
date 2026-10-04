import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
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
  listenHttpContentProvider
} from "../src/content-road.js";
import { resolveFromIndependentMaps } from "../src/many-maps.js";

function makeSource() {
  const place = { id: "place:source" };
  const author = {
    id: "actor:source",
    held: [
      {
        id: "tenet-seed:006",
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
    occurredAt: "2026-10-04T19:00:00Z",
    traces: []
  }).traces.find((item) => item.kind === "tenet");

  return { trace, payload: makeTenetPayload(trace) };
}

function crossingFor(spec) {
  return {
    crossing_id: "relatte-crossing:tenet-006",
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
    crossing_id: "relatte-crossing:tenet-006",
    world_id: "world:destination",
    receiver_particular: "receiver:destination",
    contract_ref: "contract:destination/v0",
    kind: "R3_ADMIT",
    semantic_effect: "candidate",
    receipt_id: "receipt:admit:tenet-006"
  };
}

test("two disjoint discovery maps independently verify one seed", async () => {
  const base = await mkdtemp(join(tmpdir(), "gro-tenet-006-disjoint-"));
  const rootA = join(base, "alice");
  const rootB = join(base, "carol");
  const serverB = createHttpContentProviderServer({ root: rootB });

  try {
    const { payload } = makeSource();
    const a = await writeAddressedJson(rootA, payload);
    const b = await writeAddressedJson(rootB, payload);
    assert.equal(a.address, b.address);

    const urlB = await listenHttpContentProvider(serverB);

    const result = await resolveFromIndependentMaps({
      address: a.address,
      maps: [
        {
          mapId: "map:a",
          discover: async () => [
            { providerId: "alice", kind: "file", locator: "store:alice" },
            { providerId: "ghost-a", kind: "file", locator: "store:ghost-a" }
          ]
        },
        {
          mapId: "map:b",
          discover: async () => [
            { providerId: "carol", kind: "http", locator: urlB },
            { providerId: "ghost-b", kind: "http", locator: "http://127.0.0.1:9" }
          ]
        }
      ],
      materializeProvider: async ({ mapId, candidate }) => {
        if (mapId === "map:a") {
          if (candidate.providerId === "alice") {
            return fileContentProvider({ id: "alice", root: rootA });
          }
          return fileContentProvider({
            id: candidate.providerId,
            root: join(base, "missing-a")
          });
        }

        return httpContentProvider({
          id: candidate.providerId,
          baseUrl: candidate.locator
        });
      }
    });

    const verified = result.observations.filter((x) => x.status === "verified");
    assert.equal(verified.length, 2);
    assert.notEqual(verified[0].providerId, verified[1].providerId);
    assert.notEqual(verified[0].candidateId, verified[1].candidateId);
    assert.deepEqual(verified[0].bytes, verified[1].bytes);
    assert.equal(result.convergence.consensusRequired, false);
    assert.equal(result.convergence.identityBasis, "signed-content-address");
  } finally {
    await closeHttpContentProvider(serverB);
    await rm(base, { recursive: true, force: true });
  }
});

test("map disagreement does not require discovery consensus for local consequence", async () => {
  const base = await mkdtemp(join(tmpdir(), "gro-tenet-006-consequence-"));
  const rootA = join(base, "provider-a");
  const rootB = join(base, "provider-b");
  const serverB = createHttpContentProviderServer({ root: rootB });

  try {
    const { trace, payload } = makeSource();
    const a = await writeAddressedJson(rootA, payload);
    const b = await writeAddressedJson(rootB, payload);
    assert.equal(a.address, b.address);
    const urlB = await listenHttpContentProvider(serverB);

    const spec = makeAddressedTenetTransferSpec({
      trace,
      payloadAddress: a.address,
      sourceWorld: "world:source",
      createdAt: "2026-10-04T19:01:00Z"
    });
    const crossing = crossingFor(spec);

    const resolved = await resolveFromIndependentMaps({
      address: a.address,
      maps: [
        {
          mapId: "map:orchard",
          discover: async () => [
            { providerId: "alice", kind: "file", locator: "store:alice" }
          ]
        },
        {
          mapId: "map:lantern",
          discover: async () => [
            { providerId: "carol", kind: "http", locator: urlB }
          ]
        }
      ],
      materializeProvider: async ({ candidate }) => {
        if (candidate.providerId === "alice") {
          return fileContentProvider({ id: "alice", root: rootA });
        }
        return httpContentProvider({
          id: candidate.providerId,
          baseUrl: candidate.locator
        });
      }
    });

    const verified = resolved.observations.filter((x) => x.status === "verified");
    assert.equal(verified.length, 2);

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
      resolvePayloadBytes: async () => verified[0].bytes
    });
    const viaB = await interpretAddressedTenetArrival({
      ...common,
      resolvePayloadBytes: async () => verified[1].bytes
    });

    assert.equal(viaA.trace.traceId, viaB.trace.traceId);
    assert.deepEqual(viaA.trace.tenet, viaB.trace.tenet);
  } finally {
    await closeHttpContentProvider(serverB);
    await rm(base, { recursive: true, force: true });
  }
});

test("one failed map does not veto another map's verified seed", async () => {
  const base = await mkdtemp(join(tmpdir(), "gro-tenet-006-no-veto-"));
  const root = join(base, "survivor");

  try {
    const { payload } = makeSource();
    const stored = await writeAddressedJson(root, payload);

    const result = await resolveFromIndependentMaps({
      address: stored.address,
      maps: [
        {
          mapId: "map:broken",
          discover: async () => {
            throw new Error("offline");
          }
        },
        {
          mapId: "map:survivor",
          discover: async () => [
            { providerId: "survivor", kind: "file", locator: "store:survivor" }
          ]
        }
      ],
      materializeProvider: async ({ candidate }) =>
        fileContentProvider({ id: candidate.providerId, root })
    });

    assert.equal(result.observations[0].status, "unresolved");
    assert.equal(result.observations[1].status, "verified");
    assert.equal(result.selectedMapId, "map:survivor");
    assert.equal(result.convergence.consensusRequired, false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
