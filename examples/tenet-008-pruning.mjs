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
import {
  GRO_PRUNED_DESCENDANT_MEDIA_TYPE,
  addressLineageCheckpoint,
  addressPrunedDescendantWorldSeed,
  createLineageCheckpoint,
  localizePrunedDescendantWorldSeed,
  makeLineageCheckpointDraft,
  makePrunedDescendantWorldSeed,
  verifyLineageCheckpoint,
  verifyPrunedDescendantWorldSeed
} from "../src/lineage-checkpoint.js";
import { stableStringify } from "../src/stable.js";
import { writeAddressedJson } from "../src/payload-store.js";

const relatteRoot = resolve(process.argv[2] ?? ".deps/reLATTE");
const relatte = await import(
  pathToFileURL(resolve(relatteRoot, "src/index.ts")).href
);

const base = await mkdtemp(resolve(tmpdir(), "gro-tenet-008-"));
const xRoot = resolve(base, "x-store");
const yRoot = resolve(base, "y-store");
const zRoot = resolve(base, "z-store");

try {
  // Generation X.
  const sourcePlace = { id: "place:x-source" };
  const sourceAuthor = {
    id: "actor:x-author",
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
    occurredAt: "2026-10-04T19:30:00.000Z",
    traces: []
  });
  const sourceTraceX = leftX.traces.find((x) => x.kind === "tenet");
  const payloadX = makeTenetPayload(sourceTraceX);
  const storedX = await writeAddressedJson(xRoot, payloadX);

  const specX = makeAddressedTenetTransferSpec({
    trace: sourceTraceX,
    payloadAddress: storedX.address,
    sourceWorld: "world:x",
    sourceHistoryHead: "history:x",
    createdAt: "2026-10-04T19:31:00.000Z"
  });
  const crossingX = await relatte.sealOpaqueOrganCrossing(
    specX,
    await relatte.generateP256KeyPair()
  );

  // Room B admits X and acts through it to create Y.
  const receiverB = await relatte.LocalReceiver.create(
    resolve(base, "room-b"),
    {
      world_id: "world:b",
      receiver_particular: "receiver:b",
      contract_ref: "contract:b/v0"
    }
  );
  await receiverB.receive(crossingX, "2026-10-04T19:32:00.000Z");
  const admitX = await receiverB.dispose(
    crossingX.crossing_id,
    "ADMIT",
    "2026-10-04T19:32:01.000Z",
    {
      admit_effect: "gro-addressed-tenet-candidate"
    }
  );

  const localX = await interpretAddressedTenetArrival({
    crossing: crossingX,
    dispositionReceipt: admitX,
    destination: {
      worldId: "world:b",
      placeId: "place:b-rain"
    },
    resolvePayloadBytes: async () => storedX.bytes,
    localRules: {
      offeredActionLabel: "Refill the first rain bowl",
      requiredHeldKind: "water"
    }
  });

  const actorB = {
    id: "actor:b",
    held: [{ id: "water:b", kind: "water" }]
  };
  const fieldBGrO = resolveField({
    place: { id: "place:b-rain" },
    actor: actorB,
    traces: [localX.trace]
  });
  const throughX = fieldBGrO.affordances.find((a) =>
    a.id.startsWith("through-tenet:")
  );
  const actedX = act({
    place: { id: "place:b-rain" },
    actor: actorB,
    field: fieldBGrO,
    actionId: throughX.id,
    occurredAt: "2026-10-04T19:33:00.000Z",
    traces: [localX.trace]
  });
  const responseX = actedX.traces.at(-1);

  const lensB = relatte.sealFieldLens({
    schema: "relatte.field-lens/v0",
    world_id: "world:b",
    title: "Generation B",
    channels: [
      {
        name: "growth",
        weights: {
          admitted_receipts: 1,
          admitted_descendants: 1
        }
      }
    ],
    created_at: "2026-10-04T19:33:01.000Z",
    laws: ["LENS != HISTORY", "LOCAL WEIGHT != UNIVERSAL VALUE"]
  });
  const fieldB = await relatte.projectField({
    lens: lensB,
    admitted_receipts: [admitX]
  });
  const uptakeXY = await relatte.createCulturalUptake({
    ancestor_crossing: crossingX,
    admitted_receipt: admitX,
    field_projection: fieldB,
    world_id: "world:b",
    local_particular: "particular:b-grower",
    variation: {
      preserved: ["invitation-only", "water relation"],
      varied: ["first bowl becomes second invitation"],
      introduced: ["generation Y"],
      retired: ["source wording"]
    },
    note: "B acts through X to make Y.",
    created_at: "2026-10-04T19:33:02.000Z"
  });

  const payloadY = makeDescendantWorldSeed({
    ancestorPayloadAddress: storedX.address,
    ancestorLocalTrace: localX.trace,
    actionReceipt: actedX.receipt,
    actionResponseTrace: responseX,
    descendantTenet: {
      seedId: "tenet-seed:y",
      label: "The first bowl was filled.",
      offeredActionLabel: "Refill the second rain bowl",
      requiredHeldKind: "water",
      authorId: actorB.id,
      authorControl: false
    },
    lineageEvidence: {
      ancestorCrossing: crossingX,
      ancestorAdmissionReceipt: admitX,
      fieldProjection: fieldB,
      uptake: uptakeXY
    }
  });
  const addressedY = addressDescendantWorldSeed(payloadY);
  const storedY = await writeAddressedJson(yRoot, payloadY);
  assert.equal(storedY.address, addressedY.address);

  const draftY = relatte.buildCulturalDescendantDraft({
    uptake: uptakeXY,
    descendant_payload_ref: {
      address: addressedY.address,
      media_type: GRO_DESCENDANT_MEDIA_TYPE
    },
    created_at: "2026-10-04T19:34:00.000Z"
  });
  const crossingY = await relatte.sealCrossingEnvelope(
    draftY,
    await relatte.generateP256KeyPair()
  );

  // Room C receives Y and fully verifies X→Y one final time before pruning.
  const receiverC = await relatte.LocalReceiver.create(
    resolve(base, "room-c"),
    {
      world_id: "world:c",
      receiver_particular: "receiver:c",
      contract_ref: "contract:c/v0"
    }
  );
  const receiveY = await receiverC.receive(
    crossingY,
    "2026-10-04T19:35:00.000Z"
  );
  const admitY = await receiverC.dispose(
    crossingY.crossing_id,
    "ADMIT",
    "2026-10-04T19:35:01.000Z",
    {
      admit_effect: "gro-descendant-tenet-candidate"
    }
  );

  const verifiedY = await verifyDescendantWorldSeed({
    bytes: storedY.bytes,
    expectedAddress: storedY.address,
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
      worldId: "world:c",
      placeId: "place:c-garden"
    },
    localRules: {
      offeredActionLabel: "Refill the second rain bowl",
      requiredHeldKind: "water"
    }
  });

  // R11-style local receipt-set commitment: commitment, not history.
  const commitmentC = await relatte.createReceiptSetCommitment({
    world_id: "world:c",
    local_history_head: receiverC.snapshot().history_head,
    receipts: [receiveY, admitY],
    created_at: "2026-10-04T19:35:02.000Z"
  });

  // Checkpoint Y only after full lineage verification succeeded.
  const checkpointY = createLineageCheckpoint({
    verifiedSeed: verifiedY,
    subjectCrossing: crossingY,
    localReceiptSetCommitment: commitmentC,
    checkpointWorldId: "world:c",
    createdAt: "2026-10-04T19:35:03.000Z"
  });
  const addressedCheckpointY = addressLineageCheckpoint(checkpointY);

  const checkpointDraftY = makeLineageCheckpointDraft({
    checkpoint: checkpointY,
    checkpointAddress: addressedCheckpointY.address,
    sourceParticular: "receiver:c",
    createdAt: "2026-10-04T19:35:04.000Z"
  });
  const checkpointCrossingY = await relatte.sealCrossingEnvelope(
    checkpointDraftY,
    await relatte.generateP256KeyPair()
  );

  const verifiedCheckpointY = await verifyLineageCheckpoint({
    bytes: addressedCheckpointY.bytes,
    expectedAddress: addressedCheckpointY.address,
    checkpointCrossing: checkpointCrossingY,
    verifyRelatteCrossing: (value) =>
      relatte.verifyCrossingEnvelope(value),
    verifyReceiptSetCommitmentShape: (value) =>
      relatte.verifyReceiptSetCommitmentShape(value)
  });
  assert.equal(verifiedCheckpointY.checkpointVerified, true);

  // Room C now acts through Y to make Z.
  const actorC = {
    id: "actor:c",
    held: [{ id: "water:c", kind: "water" }]
  };
  const fieldCGrO = resolveField({
    place: { id: "place:c-garden" },
    actor: actorC,
    traces: [localY]
  });
  const throughY = fieldCGrO.affordances.find((a) =>
    a.id.startsWith("through-tenet:")
  );
  const actedY = act({
    place: { id: "place:c-garden" },
    actor: actorC,
    field: fieldCGrO,
    actionId: throughY.id,
    occurredAt: "2026-10-04T19:36:00.000Z",
    traces: [localY]
  });
  const responseY = actedY.traces.at(-1);

  const lensC = relatte.sealFieldLens({
    schema: "relatte.field-lens/v0",
    world_id: "world:c",
    title: "Generation C",
    channels: [
      {
        name: "growth",
        weights: {
          admitted_receipts: 1,
          admitted_descendants: 1
        }
      }
    ],
    created_at: "2026-10-04T19:36:01.000Z",
    laws: ["LENS != HISTORY", "LOCAL WEIGHT != UNIVERSAL VALUE"]
  });
  const fieldC = await relatte.projectField({
    lens: lensC,
    admitted_receipts: [admitY]
  });
  const uptakeYZ = await relatte.createCulturalUptake({
    ancestor_crossing: crossingY,
    admitted_receipt: admitY,
    field_projection: fieldC,
    world_id: "world:c",
    local_particular: "particular:c-grower",
    variation: {
      preserved: ["invitation-only", "water relation"],
      varied: ["second bowl becomes orchard-edge invitation"],
      introduced: ["generation Z", "checkpointed ancestry"],
      retired: ["recursive ancestor evidence bundle"]
    },
    note: "C acts through Y to make checkpointed Z.",
    created_at: "2026-10-04T19:36:02.000Z"
  });

  const payloadZ = makePrunedDescendantWorldSeed({
    parentLocalTrace: localY,
    actionReceipt: actedY.receipt,
    actionResponseTrace: responseY,
    descendantTenet: {
      seedId: "tenet-seed:z",
      label: "Two bowls are full; carry water toward the orchard.",
      offeredActionLabel: "Water the orchard-edge tree",
      requiredHeldKind: "water",
      authorId: actorC.id,
      authorControl: false
    },
    directLineageEvidence: {
      parentCrossing: crossingY,
      parentAdmissionReceipt: admitY,
      fieldProjection: fieldC,
      uptake: uptakeYZ
    },
    ancestryCheckpoint: verifiedCheckpointY
  });
  const addressedZ = addressPrunedDescendantWorldSeed(payloadZ);
  const storedZ = await writeAddressedJson(zRoot, payloadZ);
  assert.equal(storedZ.address, addressedZ.address);

  const draftZ = relatte.buildCulturalDescendantDraft({
    uptake: uptakeYZ,
    descendant_payload_ref: {
      address: addressedZ.address,
      media_type: GRO_PRUNED_DESCENDANT_MEDIA_TYPE
    },
    created_at: "2026-10-04T19:37:00.000Z"
  });
  const crossingZ = await relatte.sealCrossingEnvelope(
    draftZ,
    await relatte.generateP256KeyPair()
  );

  assert.equal(
    await relatte.verifyCulturalDescendant({
      ancestor_crossing: crossingY,
      admitted_receipt: admitY,
      field_projection: fieldC,
      uptake: uptakeYZ,
      descendant_crossing: crossingZ
    }),
    true
  );

  // Pruning becomes real: destroy X and Y semantic payload stores.
  await rm(xRoot, { recursive: true, force: true });
  await rm(yRoot, { recursive: true, force: true });

  // Room D only receives Z. It does not rehydrate X or Y payload bytes.
  const receiverD = await relatte.LocalReceiver.create(
    resolve(base, "room-d"),
    {
      world_id: "world:d",
      receiver_particular: "receiver:d",
      contract_ref: "contract:d/v0"
    }
  );
  await receiverD.receive(crossingZ, "2026-10-04T19:38:00.000Z");
  const admitZ = await receiverD.dispose(
    crossingZ.crossing_id,
    "ADMIT",
    "2026-10-04T19:38:01.000Z",
    {
      admit_effect: "gro-pruned-descendant-candidate"
    }
  );

  const verifiedZ = await verifyPrunedDescendantWorldSeed({
    bytes: storedZ.bytes,
    expectedAddress: storedZ.address,
    descendantCrossing: crossingZ,
    verifyRelatteLineage: (args) =>
      relatte.verifyCulturalDescendant(args),
    verifyRelatteCrossing: (value) =>
      relatte.verifyCrossingEnvelope(value),
    verifyReceiptSetCommitmentShape: (value) =>
      relatte.verifyReceiptSetCommitmentShape(value)
  });

  assert.equal(verifiedZ.lineageMode, "checkpointed-resumable");
  assert.equal(verifiedZ.generation, 2);

  const localZ = localizePrunedDescendantWorldSeed({
    verifiedSeed: verifiedZ,
    descendantCrossing: crossingZ,
    dispositionReceipt: admitZ,
    destination: {
      worldId: "world:d",
      placeId: "place:d-orchard-edge"
    },
    localRules: {
      offeredActionLabel: "Water the orchard-edge tree",
      requiredHeldKind: "water"
    }
  });

  const actorD = {
    id: "actor:d",
    held: [{ id: "water:d", kind: "water" }]
  };
  const fieldD = resolveField({
    place: { id: "place:d-orchard-edge" },
    actor: actorD,
    traces: [localZ]
  });
  assert.ok(
    fieldD.affordances.some((a) => a.id.startsWith("through-tenet:"))
  );

  // Demonstrate why pruning matters: recursive carry is strictly larger.
  const prunedBytes = Buffer.byteLength(stableStringify(payloadZ));
  const naiveRecursiveBytes = Buffer.byteLength(
    stableStringify({
      ...payloadZ,
      recursivelyNestedFullParentPayload: payloadY
    })
  );
  assert.ok(prunedBytes < naiveRecursiveBytes);

  console.log(JSON.stringify({
    schema: "gro.tenet-008-witness.v0",
    generations: ["X", "Y", "Z"],
    checkpoint: {
      checkpoint_id: checkpointY.checkpointId,
      lineage_root: checkpointY.lineageRoot,
      generation: checkpointY.generation,
      receipt_set_root:
        checkpointY.localReceiptSetCommitment.receipt_set_root,
      authority: checkpointY.authority,
      semantic_effect: checkpointY.semanticEffect
    },
    pruning: {
      x_payload_online_at_z_verification: false,
      y_payload_online_at_z_verification: false,
      z_lineage_mode: verifiedZ.lineageMode,
      z_generation: verifiedZ.generation,
      pruned_bytes: prunedBytes,
      naive_recursive_bytes: naiveRecursiveBytes,
      bytes_avoided_in_this_fixture: naiveRecursiveBytes - prunedBytes
    },
    resumability: {
      inherited_lineage_root: verifiedZ.inheritedLineageRoot,
      full_y_evidence_address: checkpointY.verification.evidenceAddress,
      rehydration_possible_if_evidence_returns: true,
      rehydration_performed_here: false
    },
    playable: fieldD.affordances.some((a) =>
      a.id.startsWith("through-tenet:")
    ),
    laws: [
      "CHECKPOINT != HISTORY",
      "COMMITMENT != EVIDENCE",
      "PRUNING != RETCON",
      "PRUNED != FORGOTTEN",
      "FULL VERIFICATION PRECEDES PRUNING",
      "DIRECT RELATION VERIFIED, EARLIER HISTORY CHECKPOINTED",
      "LINEAGE ROOT != AUTHORITY"
    ]
  }, null, 2));
} finally {
  await rm(base, { recursive: true, force: true });
}
