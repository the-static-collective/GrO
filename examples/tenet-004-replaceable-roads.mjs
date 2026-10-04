import assert from "node:assert/strict";
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
  listenHttpContentProvider,
  retrieveFromProviders
} from "../src/content-road.js";

const relatteRoot = resolve(process.argv[2] ?? ".deps/reLATTE");
const relatte = await import(
  pathToFileURL(resolve(relatteRoot, "src/index.ts")).href
);

const base = await mkdtemp(resolve(tmpdir(), "gro-tenet-004-"));
const providerARoot = resolve(base, "provider-a");
const providerBRoot = resolve(base, "provider-b");
const server = createHttpContentProviderServer({ root: providerBRoot });

try {
  const sourcePlace = { id: "place:source-garden" };
  const sourceAuthor = {
    id: "actor:source-author",
    held: [
      {
        id: "tenet-seed:replaceable-road-001",
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
    occurredAt: "2026-10-04T18:40:00.000Z",
    traces: []
  });

  const sourceTrace = left.traces.find((item) => item.kind === "tenet");
  const payload = makeTenetPayload(sourceTrace);

  const storedA = await writeAddressedJson(providerARoot, payload);
  const storedB = await writeAddressedJson(providerBRoot, payload);
  assert.equal(storedA.address, storedB.address);

  const spec = makeAddressedTenetTransferSpec({
    trace: sourceTrace,
    payloadAddress: storedA.address,
    sourceWorld: "world:gro-room-a",
    sourceHistoryHead: "history:gro-room-a:tenet-004",
    createdAt: "2026-10-04T18:41:00.000Z"
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

  const receiveReceipt = await receiver.receive(
    crossing,
    "2026-10-04T18:41:01.000Z"
  );
  assert.equal(receiveReceipt.kind, "RECEIVED");

  const dispositionReceipt = await receiver.dispose(
    crossing.crossing_id,
    "ADMIT",
    "2026-10-04T18:41:02.000Z",
    {
      note: "Room B admits the addressed world-seed",
      admit_effect: "gro-addressed-tenet-candidate"
    }
  );
  assert.equal(dispositionReceipt.kind, "R3_ADMIT");

  const baseUrl = await listenHttpContentProvider(server);
  const providerA = fileContentProvider({
    id: "provider:file-a",
    root: providerARoot
  });
  const providerB = httpContentProvider({
    id: "provider:http-b",
    baseUrl
  });

  const common = {
    crossing,
    dispositionReceipt,
    destination: {
      worldId: "world:gro-room-b",
      placeId: "place:rain-room"
    },
    localRules: {
      label: "A verified world-seed reached the Rain Room.",
      offeredActionLabel: "Refill the community rain bowl",
      requiredHeldKind: "water"
    }
  };

  const fromA = await retrieveFromProviders(storedA.address, [providerA]);
  const viaA = await interpretAddressedTenetArrival({
    ...common,
    resolvePayloadBytes: async () => fromA.bytes
  });

  const fromB = await retrieveFromProviders(storedA.address, [providerB]);
  const viaB = await interpretAddressedTenetArrival({
    ...common,
    resolvePayloadBytes: async () => fromB.bytes
  });

  assert.equal(fromA.providerKind, "file");
  assert.equal(fromB.providerKind, "http");
  assert.deepEqual(fromA.bytes, fromB.bytes);
  assert.equal(viaA.trace.traceId, viaB.trace.traceId);
  assert.deepEqual(viaA.trace.tenet, viaB.trace.tenet);

  // Provider A dies after the seed has already been independently retained.
  await rm(providerARoot, { recursive: true, force: true });

  const fallback = await retrieveFromProviders(storedA.address, [
    providerA,
    providerB
  ]);
  assert.equal(fallback.providerId, "provider:http-b");
  assert.equal(fallback.attempts[0].status, "failed");
  assert.equal(fallback.attempts[1].status, "served");

  const afterDeath = await interpretAddressedTenetArrival({
    ...common,
    resolvePayloadBytes: async () => fallback.bytes
  });

  assert.equal(afterDeath.trace.traceId, viaA.trace.traceId);

  console.log(JSON.stringify({
    schema: "gro.tenet-004-witness.v0",
    crossing_id: crossing.crossing_id,
    payload_address: storedA.address,
    providers: {
      file_a: {
        independent_copy: true,
        later_dead: true
      },
      http_b: {
        independent_copy: true,
        survived: true
      }
    },
    before_failure: {
      file_trace_id: viaA.trace.traceId,
      http_trace_id: viaB.trace.traceId,
      identical_consequence: viaA.trace.traceId === viaB.trace.traceId
    },
    after_failure: {
      selected_provider: fallback.providerId,
      attempts: fallback.attempts,
      trace_id: afterDeath.trace.traceId,
      consequence_survived: afterDeath.trace.traceId === viaA.trace.traceId
    },
    laws: [
      "ROAD != SEED",
      "PROVIDER != AUTHORITY",
      "RETRIEVAL PATH != IDENTITY",
      "COPY != OWNERSHIP",
      "PROVIDER DEATH != WORLD-SEED DEATH"
    ]
  }, null, 2));
} finally {
  await closeHttpContentProvider(server);
  await rm(base, { recursive: true, force: true });
}
