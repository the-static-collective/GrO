import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

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
import {
  closeHttpDiscoveryServer,
  createHttpDiscoveryServer,
  httpDiscovery,
  listenHttpDiscoveryServer
} from "../src/discovery.js";
import { resolveFromIndependentMaps } from "../src/many-maps.js";

const relatteRoot = resolve(process.argv[2] ?? ".deps/reLATTE");
const relatte = await import(
  pathToFileURL(resolve(relatteRoot, "src/index.ts")).href
);

const base = await mkdtemp(resolve(tmpdir(), "gro-tenet-006-"));
const aliceRoot = resolve(base, "provider-alice");
const carolRoot = resolve(base, "provider-carol");

const carolServer = createHttpContentProviderServer({ root: carolRoot });
const liarServer = createServer((_request, response) => {
  const bytes = Buffer.from('{"not":"the world-seed"}', "utf8");
  response.statusCode = 200;
  response.end(bytes);
});

let mapAServer;
let mapBServer;

try {
  const sourcePlace = { id: "place:source-garden" };
  const sourceAuthor = {
    id: "actor:source-author",
    held: [
      {
        id: "tenet-seed:many-maps-001",
        kind: "tenet-seed",
        label: "Water can continue what happened here.",
        offeredActionLabel: "Water the young tree",
        requiredHeldKind: "water"
      }
    ]
  };

  const sourceField = resolveField({
    place: sourcePlace,
    actor: sourceAuthor,
    traces: []
  });

  const left = act({
    place: sourcePlace,
    actor: sourceAuthor,
    field: sourceField,
    actionId: "leave-tenet",
    occurredAt: "2026-10-04T19:00:00.000Z",
    traces: []
  });
  const sourceTrace = left.traces.find((x) => x.kind === "tenet");
  const payload = makeTenetPayload(sourceTrace);

  const alice = await writeAddressedJson(aliceRoot, payload);
  const carol = await writeAddressedJson(carolRoot, payload);
  assert.equal(alice.address, carol.address);

  const spec = makeAddressedTenetTransferSpec({
    trace: sourceTrace,
    payloadAddress: alice.address,
    sourceWorld: "world:gro-room-a",
    sourceHistoryHead: "history:gro-room-a:tenet-006",
    createdAt: "2026-10-04T19:01:00.000Z"
  });

  const crossing = await relatte.sealOpaqueOrganCrossing(
    spec,
    await relatte.generateP256KeyPair()
  );
  assert.equal(await relatte.verifyOpaqueOrganCrossing(crossing), true);

  const receiver = await relatte.LocalReceiver.create(
    resolve(base, "room-b-receiver"),
    {
      world_id: "world:gro-room-b",
      receiver_particular: "receiver:gro-room-b",
      contract_ref: "contract:gro-room-b/v0"
    }
  );
  await receiver.receive(crossing, "2026-10-04T19:01:01.000Z");
  const dispositionReceipt = await receiver.dispose(
    crossing.crossing_id,
    "ADMIT",
    "2026-10-04T19:01:02.000Z",
    {
      note: "Room B admits candidate before independent discovery",
      admit_effect: "gro-addressed-tenet-candidate"
    }
  );

  const carolUrl = await listenHttpContentProvider(carolServer);

  await new Promise((ok, fail) => {
    liarServer.once("error", fail);
    liarServer.listen(0, "127.0.0.1", () => {
      liarServer.off("error", fail);
      ok();
    });
  });
  const liarBound = liarServer.address();
  const liarUrl = `http://127.0.0.1:${liarBound.port}`;

  // Map A and Map B have no shared directory state and no overlapping provider hints.
  mapAServer = createHttpDiscoveryServer({
    lookup: async (address) => {
      assert.equal(address, alice.address);
      return [
        { providerId: "alice", kind: "file", locator: "store:alice" },
        { providerId: "ghost-a", kind: "file", locator: "store:ghost-a" }
      ];
    }
  });

  mapBServer = createHttpDiscoveryServer({
    lookup: async (address) => {
      assert.equal(address, alice.address);
      return [
        { providerId: "liar-b", kind: "http", locator: liarUrl },
        { providerId: "carol", kind: "http", locator: carolUrl }
      ];
    }
  });

  const mapAUrl = await listenHttpDiscoveryServer(mapAServer);
  const mapBUrl = await listenHttpDiscoveryServer(mapBServer);

  const resolved = await resolveFromIndependentMaps({
    address: alice.address,
    maps: [
      { mapId: "map:orchard", discover: httpDiscovery({ baseUrl: mapAUrl }) },
      { mapId: "map:lantern", discover: httpDiscovery({ baseUrl: mapBUrl }) }
    ],
    materializeProvider: async ({ candidate }) => {
      if (candidate.kind === "file") {
        if (candidate.providerId === "alice") {
          return fileContentProvider({
            id: candidate.providerId,
            root: aliceRoot
          });
        }
        return fileContentProvider({
          id: candidate.providerId,
          root: resolve(base, "missing")
        });
      }

      return httpContentProvider({
        id: candidate.providerId,
        baseUrl: candidate.locator
      });
    }
  });

  const verifiedMaps = resolved.observations.filter(
    (entry) => entry.status === "verified"
  );
  assert.equal(verifiedMaps.length, 2);
  assert.notEqual(verifiedMaps[0].providerId, verifiedMaps[1].providerId);
  assert.notEqual(verifiedMaps[0].candidateId, verifiedMaps[1].candidateId);
  assert.deepEqual(verifiedMaps[0].bytes, verifiedMaps[1].bytes);

  const common = {
    crossing,
    dispositionReceipt,
    destination: {
      worldId: "world:gro-room-b",
      placeId: "place:rain-room"
    },
    localRules: {
      label: "Independent maps converged on the same seed.",
      offeredActionLabel: "Refill the community rain bowl",
      requiredHeldKind: "water"
    }
  };

  const viaMapA = await interpretAddressedTenetArrival({
    ...common,
    resolvePayloadBytes: async () => verifiedMaps[0].bytes
  });
  const viaMapB = await interpretAddressedTenetArrival({
    ...common,
    resolvePayloadBytes: async () => verifiedMaps[1].bytes
  });

  assert.equal(viaMapA.trace.traceId, viaMapB.trace.traceId);

  console.log(JSON.stringify({
    schema: "gro.tenet-006-witness.v0",
    payload_address: alice.address,
    maps: resolved.observations.map((entry) => ({
      map_id: entry.mapId,
      status: entry.status,
      provider_id: entry.providerId ?? null,
      candidate_id: entry.candidateId ?? null,
      attempts: entry.attempts
    })),
    shared_directory_state: false,
    overlapping_provider_hints: false,
    discovery_consensus_required: resolved.convergence.consensusRequired,
    identity_basis: resolved.convergence.identityBasis,
    resulting_trace_ids: [
      viaMapA.trace.traceId,
      viaMapB.trace.traceId
    ],
    converged: viaMapA.trace.traceId === viaMapB.trace.traceId,
    laws: [
      "MANY MAPS != MANY SEEDS",
      "DISCOVERY CONSENSUS != SEED IDENTITY",
      "DIRECTORY DISAGREEMENT != IDENTITY CONFLICT",
      "CONVERGENCE IS VERIFIED, NOT VOTED",
      "MAP SET != PROVIDER SET"
    ]
  }, null, 2));
} finally {
  await closeHttpContentProvider(carolServer);
  if (liarServer.listening) {
    await new Promise((done) => liarServer.close(() => done()));
  }
  if (mapAServer) await closeHttpDiscoveryServer(mapAServer);
  if (mapBServer) await closeHttpDiscoveryServer(mapBServer);
  await rm(base, { recursive: true, force: true });
}
