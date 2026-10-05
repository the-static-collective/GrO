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
import {
  GRO_DESCENDANT_MEDIA_TYPE,
  addressDescendantWorldSeed,
  localizeDescendantWorldSeed,
  makeDescendantWorldSeed,
  verifyDescendantWorldSeed
} from "../src/descendant.js";
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
  listenHttpDiscoveryServer,
  retrieveVerifiedFromDiscovery
} from "../src/discovery.js";

const relatteRoot = resolve(process.argv[2] ?? ".deps/reLATTE");
const relatte = await import(
  pathToFileURL(resolve(relatteRoot, "src/index.ts")).href
);

const base = await mkdtemp(resolve(tmpdir(), "gro-tenet-007-"));
const xRoot = resolve(base, "ancestor-x-provider");
const yFileRoot = resolve(base, "descendant-y-file");
const yHttpRoot = resolve(base, "descendant-y-http");

let xMapServer;
let yMapServer;
const yHttpServer = createHttpContentProviderServer({ root: yHttpRoot });

try {
  // X begins as an ordinary addressed GrO tenet.
  const sourcePlace = { id: "place:source-garden" };
  const sourceAuthor = {
    id: "actor:source-author",
    held: [
      {
        id: "tenet-seed:x",
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
  const leftX = act({
    place: sourcePlace,
    actor: sourceAuthor,
    field: sourceField,
    actionId: "leave-tenet",
    occurredAt: "2026-10-04T19:10:00.000Z",
    traces: []
  });
  const sourceTraceX = leftX.traces.find((x) => x.kind === "tenet");
  const payloadX = makeTenetPayload(sourceTraceX);
  const storedX = await writeAddressedJson(xRoot, payloadX);

  const specX = makeAddressedTenetTransferSpec({
    trace: sourceTraceX,
    payloadAddress: storedX.address,
    sourceWorld: "world:source-x",
    sourceHistoryHead: "history:source-x",
    createdAt: "2026-10-04T19:11:00.000Z"
  });
  const crossingX = await relatte.sealOpaqueOrganCrossing(
    specX,
    await relatte.generateP256KeyPair()
  );
  assert.equal(await relatte.verifyOpaqueOrganCrossing(crossingX), true);

  // X has its own old discovery map.
  xMapServer = createHttpDiscoveryServer({
    lookup: async (address) => {
      assert.equal(address, storedX.address);
      return [
        {
          providerId: "provider:x-old",
          kind: "file",
          locator: "store:x-old"
        }
      ];
    }
  });
  const xMapUrl = await listenHttpDiscoveryServer(xMapServer);
  const discoverX = httpDiscovery({ baseUrl: xMapUrl });

  const foundX = await retrieveVerifiedFromDiscovery({
    address: storedX.address,
    discover: discoverX,
    materializeProvider: async () =>
      fileContentProvider({
        id: "provider:x-old",
        root: xRoot
      })
  });

  // Room B receives and locally admits X.
  const receiverB = await relatte.LocalReceiver.create(
    resolve(base, "room-b-receiver"),
    {
      world_id: "world:room-b",
      receiver_particular: "receiver:room-b",
      contract_ref: "contract:room-b/v0"
    }
  );
  await receiverB.receive(crossingX, "2026-10-04T19:12:00.000Z");
  const admitX = await receiverB.dispose(
    crossingX.crossing_id,
    "ADMIT",
    "2026-10-04T19:12:01.000Z",
    {
      note: "Room B admits ancestor X",
      admit_effect: "gro-addressed-tenet-candidate"
    }
  );

  const localX = await interpretAddressedTenetArrival({
    crossing: crossingX,
    dispositionReceipt: admitX,
    destination: {
      worldId: "world:room-b",
      placeId: "place:rain-room"
    },
    resolvePayloadBytes: async () => foundX.bytes,
    localRules: {
      label: "X reached the Rain Room.",
      offeredActionLabel: "Refill the community rain bowl",
      requiredHeldKind: "water"
    }
  });

  // A local actor actually acts through X.
  const actorB = {
    id: "actor:room-b",
    held: [{ id: "water:bottle-b", kind: "water" }]
  };
  const fieldB = resolveField({
    place: { id: "place:rain-room" },
    actor: actorB,
    traces: [localX.trace]
  });
  const throughX = fieldB.affordances.find((item) =>
    item.id.startsWith("through-tenet:")
  );
  assert.ok(throughX);

  const actedX = act({
    place: { id: "place:rain-room" },
    actor: actorB,
    field: fieldB,
    actionId: throughX.id,
    occurredAt: "2026-10-04T19:13:00.000Z",
    traces: [localX.trace]
  });
  const responseX = actedX.traces.at(-1);
  assert.equal(responseX.kind, "tenet-response");

  // reLATTE records the admitted field and cultural variation that births Y.
  const lensB = relatte.sealFieldLens({
    schema: "relatte.field-lens/v0",
    world_id: "world:room-b",
    title: "GrO descendant field",
    channels: [
      {
        name: "growth",
        weights: {
          admitted_receipts: 1,
          admitted_descendants: 1
        }
      }
    ],
    created_at: "2026-10-04T19:13:01.000Z",
    laws: [
      "LENS != HISTORY",
      "LOCAL WEIGHT != UNIVERSAL VALUE"
    ]
  });

  const fieldProjectionB = await relatte.projectField({
    lens: lensB,
    admitted_receipts: [admitX]
  });

  const uptake = await relatte.createCulturalUptake({
    ancestor_crossing: crossingX,
    admitted_receipt: admitX,
    field_projection: fieldProjectionB,
    world_id: "world:room-b",
    local_particular: "particular:room-b:grower",
    variation: {
      preserved: [
        "invitation-only",
        "water relation",
        "local choice"
      ],
      varied: [
        "young-tree action becomes a forward water invitation"
      ],
      introduced: [
        "descendant world-seed Y"
      ],
      retired: [
        "dependence on ancestor provider"
      ]
    },
    note: "Room B acts through X and authors a distinct descendant Y.",
    created_at: "2026-10-04T19:13:02.000Z"
  });

  const payloadY = makeDescendantWorldSeed({
    ancestorPayloadAddress: storedX.address,
    ancestorLocalTrace: localX.trace,
    actionReceipt: actedX.receipt,
    actionResponseTrace: responseX,
    descendantTenet: {
      seedId: "tenet-seed:y",
      label: "The rain bowl was refilled; carry water forward.",
      offeredActionLabel: "Water the next thirsty tree",
      requiredHeldKind: "water",
      authorId: actorB.id,
      authorControl: false
    },
    lineageEvidence: {
      ancestorCrossing: crossingX,
      ancestorAdmissionReceipt: admitX,
      fieldProjection: fieldProjectionB,
      uptake
    }
  });

  const addressedY = addressDescendantWorldSeed(payloadY);
  const storedYFile = await writeAddressedJson(yFileRoot, payloadY);
  const storedYHttp = await writeAddressedJson(yHttpRoot, payloadY);
  assert.equal(storedYFile.address, addressedY.address);
  assert.equal(storedYHttp.address, addressedY.address);

  const draftY = relatte.buildCulturalDescendantDraft({
    uptake,
    descendant_payload_ref: {
      address: addressedY.address,
      media_type: GRO_DESCENDANT_MEDIA_TYPE
    },
    created_at: "2026-10-04T19:14:00.000Z"
  });
  const crossingY = await relatte.sealCrossingEnvelope(
    draftY,
    await relatte.generateP256KeyPair()
  );

  assert.equal(
    await relatte.verifyCulturalDescendant({
      ancestor_crossing: crossingX,
      admitted_receipt: admitX,
      field_projection: fieldProjectionB,
      uptake,
      descendant_crossing: crossingY
    }),
    true
  );

  // Y gets entirely new roads and a new map.
  const yHttpUrl = await listenHttpContentProvider(yHttpServer);
  yMapServer = createHttpDiscoveryServer({
    lookup: async (address) => {
      assert.equal(address, addressedY.address);
      return [
        {
          providerId: "provider:y-file",
          kind: "file",
          locator: "store:y-file"
        },
        {
          providerId: "provider:y-http",
          kind: "http",
          locator: yHttpUrl
        }
      ];
    }
  });
  const yMapUrl = await listenHttpDiscoveryServer(yMapServer);
  const discoverY = httpDiscovery({ baseUrl: yMapUrl });

  // Ancestor infrastructure dies before Room C discovers Y.
  await rm(xRoot, { recursive: true, force: true });
  await closeHttpDiscoveryServer(xMapServer);
  xMapServer = null;

  await assert.rejects(
    () => discoverX(storedX.address),
    /fetch failed|HTTP_DISCOVERY|ECONNREFUSED/i
  );

  // Room C receives Y as a new crossing.
  const receiverC = await relatte.LocalReceiver.create(
    resolve(base, "room-c-receiver"),
    {
      world_id: "world:room-c",
      receiver_particular: "receiver:room-c",
      contract_ref: "contract:room-c/v0"
    }
  );
  await receiverC.receive(crossingY, "2026-10-04T19:15:00.000Z");
  const admitY = await receiverC.dispose(
    crossingY.crossing_id,
    "ADMIT",
    "2026-10-04T19:15:01.000Z",
    {
      note: "Room C admits descendant Y",
      admit_effect: "gro-descendant-tenet-candidate"
    }
  );

  const foundY = await retrieveVerifiedFromDiscovery({
    address: addressedY.address,
    discover: discoverY,
    materializeProvider: async ({ providerId, kind, locator }) => {
      if (kind === "file") {
        return fileContentProvider({
          id: providerId,
          root: yFileRoot
        });
      }
      return httpContentProvider({
        id: providerId,
        baseUrl: locator
      });
    }
  });

  const verifiedY = await verifyDescendantWorldSeed({
    bytes: foundY.bytes,
    expectedAddress: addressedY.address,
    descendantCrossing: crossingY,
    verifyRelatteLineage: (args) =>
      relatte.verifyCulturalDescendant(args)
  });
  assert.equal(verifiedY.lineageVerified, true);

  const localY = localizeDescendantWorldSeed({
    verifiedSeed: verifiedY,
    descendantCrossing: crossingY,
    dispositionReceipt: admitY,
    destination: {
      worldId: "world:room-c",
      placeId: "place:orchard-edge"
    },
    localRules: {
      label: "A descendant invitation arrived without its ancestor's road.",
      offeredActionLabel: "Water the next thirsty tree",
      requiredHeldKind: "water"
    }
  });

  const actorC = {
    id: "actor:room-c",
    held: [{ id: "water:bottle-c", kind: "water" }]
  };
  const fieldC = resolveField({
    place: { id: "place:orchard-edge" },
    actor: actorC,
    traces: [localY]
  });
  assert.ok(
    fieldC.affordances.some((item) =>
      item.id.startsWith("through-tenet:")
    )
  );

  console.log(JSON.stringify({
    schema: "gro.tenet-007-witness.v0",
    ancestor: {
      crossing_id: crossingX.crossing_id,
      payload_address: storedX.address,
      original_provider_alive: false,
      original_discovery_map_alive: false
    },
    action: {
      actor_id: actedX.receipt.actorId,
      receipt_id: actedX.receipt.receiptId,
      acted_through_admission: actedX.receipt.inputs.includes(admitX.receipt_id)
    },
    descendant: {
      crossing_id: crossingY.crossing_id,
      payload_address: addressedY.address,
      parent_crossing_id: crossingY.parents[0],
      lineage_verified: verifiedY.lineageVerified,
      discovered_from_new_map: true,
      served_from_new_provider: foundY.candidate.providerId,
      playable_in_room_c: true
    },
    laws: [
      "DESCENDANT != ANCESTOR",
      "LINEAGE != CENTRAL REGISTRY",
      "PROPAGATION != BROADCAST",
      "ANCESTOR PROVIDER DEATH != DESCENDANT DEATH",
      "ANCESTOR MAP DEATH != DESCENDANT UNDISCOVERABLE",
      "ANCESTRY != AUTHORITY"
    ]
  }, null, 2));
} finally {
  await closeHttpContentProvider(yHttpServer);
  if (xMapServer) await closeHttpDiscoveryServer(xMapServer);
  if (yMapServer) await closeHttpDiscoveryServer(yMapServer);
  await rm(base, { recursive: true, force: true });
}
