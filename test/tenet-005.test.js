import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { act } from "../src/field.js";
import { resolveField } from "../src/field.js";
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
import {
  projectDiscoveryObservation,
  retrieveVerifiedFromDiscovery
} from "../src/discovery.js";

function sourceTrace() {
  const place = { id: "place:source" };
  const actor = {
    id: "actor:source",
    held: [
      {
        id: "tenet-seed:005",
        kind: "tenet-seed",
        label: "Carry water forward.",
        offeredActionLabel: "Water the sapling",
        requiredHeldKind: "water"
      }
    ]
  };
  const field = resolveField({ place, actor, traces: [] });
  return act({
    place,
    actor,
    field,
    actionId: "leave-tenet",
    occurredAt: "2026-10-04T18:50:00Z",
    traces: []
  }).traces.find((trace) => trace.kind === "tenet");
}

function crossingFor(spec) {
  return {
    crossing_id: "relatte-crossing:tenet-005",
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
    crossing_id: "relatte-crossing:tenet-005",
    world_id: "world:destination",
    receiver_particular: "receiver:destination",
    contract_ref: "contract:destination/v0",
    kind: "R3_ADMIT",
    semantic_effect: "candidate",
    receipt_id: "receipt:admit:tenet-005"
  };
}

test("discovery projection treats candidates as non-authoritative hints", () => {
  const observed = projectDiscoveryObservation([
    { providerId: "a", kind: "file", locator: "store:a" },
    { providerId: "a", kind: "file", locator: "store:a" },
    { providerId: "bad", kind: "ftp", locator: "ftp://example.invalid/x" },
    { providerId: "b", kind: "http", locator: "http://127.0.0.1:9" }
  ]);

  assert.equal(observed.status, "candidates-observed");
  assert.equal(observed.candidates.length, 2);
  assert.ok(observed.ignored.some((x) => x.reason === "DUPLICATE_CANDIDATE"));
  assert.ok(
    observed.ignored.some(
      (x) => x.reason === "UNSUPPORTED_DISCOVERY_CANDIDATE_KIND"
    )
  );
});

test("lying and stale discovery hints cannot redefine the addressed seed", async () => {
  const base = await mkdtemp(join(tmpdir(), "gro-tenet-005-"));
  const honestRoot = join(base, "honest");
  const deadRoot = join(base, "dead");
  const honestServer = createHttpContentProviderServer({ root: honestRoot });

  const liarServer = createServer((_req, res) => {
    const bytes = Buffer.from('{"lie":"different bytes"}', "utf8");
    res.statusCode = 200;
    res.setHeader("content-length", String(bytes.length));
    res.end(bytes);
  });

  try {
    const trace = sourceTrace();
    const payload = makeTenetPayload(trace);
    const published = await writeAddressedJson(honestRoot, payload);
    const honestUrl = await listenHttpContentProvider(honestServer);

    await new Promise((resolve, reject) => {
      liarServer.once("error", reject);
      liarServer.listen(0, "127.0.0.1", () => {
        liarServer.off("error", reject);
        resolve();
      });
    });
    const liarBound = liarServer.address();
    const liarUrl = `http://127.0.0.1:${liarBound.port}`;

    const discover = async () => [
      { providerId: "stale", kind: "file", locator: "store:dead" },
      { providerId: "liar", kind: "http", locator: liarUrl },
      { providerId: "honest", kind: "http", locator: honestUrl },
      { providerId: "honest", kind: "http", locator: honestUrl }
    ];

    const materializeProvider = async (candidate) => {
      if (candidate.kind === "file") {
        if (candidate.locator !== "store:dead") throw new Error("UNKNOWN_STORE");
        return fileContentProvider({ id: candidate.providerId, root: deadRoot });
      }
      if (candidate.kind === "http") {
        return httpContentProvider({
          id: candidate.providerId,
          baseUrl: candidate.locator
        });
      }
      throw new Error("UNSUPPORTED_PROVIDER_KIND");
    };

    const resolved = await retrieveVerifiedFromDiscovery({
      address: published.address,
      discover,
      materializeProvider
    });

    assert.equal(resolved.candidate.providerId, "honest");
    assert.equal(resolved.attempts[0].status, "provider-failed");
    assert.equal(resolved.attempts[1].status, "address-mismatch");
    assert.equal(resolved.attempts[2].status, "verified");
    assert.equal(
      resolved.discovery.ignored.filter((x) => x.reason === "DUPLICATE_CANDIDATE").length,
      1
    );
  } finally {
    await closeHttpContentProvider(honestServer);
    if (liarServer.listening) {
      await new Promise((resolve) => liarServer.close(() => resolve()));
    }
    await rm(base, { recursive: true, force: true });
  }
});

test("discovery ordering and directory identity do not enter GrO consequence identity", async () => {
  const trace = sourceTrace();
  const payload = makeTenetPayload(trace);
  const { address, bytes } = await import("../src/payload-store.js").then(
    ({ addressJson }) => addressJson(payload)
  );

  const spec = makeAddressedTenetTransferSpec({
    trace,
    payloadAddress: address,
    sourceWorld: "world:source",
    createdAt: "2026-10-04T18:51:00Z"
  });

  const crossing = crossingFor(spec);
  const destination = {
    worldId: "world:destination",
    placeId: "place:rain-room"
  };
  const localRules = {
    offeredActionLabel: "Refill the rain bowl"
  };

  const provider = {
    id: "provider:honest",
    kind: "memory",
    async resolve() {
      return bytes;
    }
  };

  const first = await retrieveVerifiedFromDiscovery({
    address,
    discover: async () => [
      { providerId: "honest", kind: "file", locator: "logical:honest" }
    ],
    materializeProvider: async () => provider
  });

  const second = await retrieveVerifiedFromDiscovery({
    address,
    discover: async () => [
      { providerId: "noise", kind: "file", locator: "logical:missing" },
      { providerId: "honest", kind: "file", locator: "logical:honest" }
    ],
    materializeProvider: async (candidate) => {
      if (candidate.providerId === "noise") {
        return {
          id: "noise",
          kind: "memory",
          async resolve() {
            throw new Error("missing");
          }
        };
      }
      return provider;
    }
  });

  const viaFirst = await interpretAddressedTenetArrival({
    crossing,
    dispositionReceipt: admitReceipt(),
    destination,
    resolvePayloadBytes: async () => first.bytes,
    localRules
  });
  const viaSecond = await interpretAddressedTenetArrival({
    crossing,
    dispositionReceipt: admitReceipt(),
    destination,
    resolvePayloadBytes: async () => second.bytes,
    localRules
  });

  assert.equal(viaFirst.trace.traceId, viaSecond.trace.traceId);
  assert.deepEqual(viaFirst.trace.tenet, viaSecond.trace.tenet);
});
