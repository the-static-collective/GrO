import test from "node:test";
import assert from "node:assert/strict";

import { makeReceipt } from "../src/receipt.js";
import { stableStringify } from "../src/stable.js";
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

function sha(char) {
  return "sha256:" + char.repeat(64);
}

function commitment(world, tag) {
  return {
    schema: "relatte.receipt-set-commitment/v0",
    commitment_id: `commitment:${tag}`,
    world_id: world,
    local_history_head: `history:${tag}`,
    receipt_ids: [`receipt:${tag}:receive`, `receipt:${tag}:admit`],
    receipt_count: 2,
    receipt_set_root: `relatte-receipt-set-v0:${tag}`,
    created_at: "2026-10-04T20:00:00Z",
    laws: ["COMMITMENT != HISTORY"]
  };
}

async function fixture() {
  const verifiedY = {
    address: sha("a"),
    lineageVerified: true,
    payload: {
      schema: "gro.descendant-world-seed.v1",
      ancestor: {
        crossingId: "crossing:x",
        payloadAddress: sha("x")
      },
      action: {
        receipt: {
          receiptId: sha("b"),
          actorId: "actor:b"
        }
      },
      lineage: {
        uptake: { uptake_id: "uptake:xy" }
      },
      tenet: {
        seedId: "seed:y",
        label: "Y",
        offeredActionLabel: "Act Y",
        requiredHeldKind: null,
        authorId: "actor:b",
        authorControl: false
      }
    }
  };
  const crossingY = {
    crossing_id: "crossing:y",
    payload_refs: [{ address: verifiedY.address }]
  };

  const checkpointY = createLineageCheckpoint({
    verifiedSeed: verifiedY,
    subjectCrossing: crossingY,
    localReceiptSetCommitment: commitment("world:c", "y"),
    checkpointWorldId: "world:c",
    createdAt: "2026-10-04T20:01:00Z"
  });
  const addressedCheckpointY = addressLineageCheckpoint(checkpointY);
  const checkpointCrossingY = {
    ...makeLineageCheckpointDraft({
      checkpoint: checkpointY,
      checkpointAddress: addressedCheckpointY.address,
      sourceParticular: "receiver:c",
      createdAt: "2026-10-04T20:01:01Z"
    }),
    crossing_id: "crossing:checkpoint-y"
  };
  const verifiedCheckpointY = await verifyLineageCheckpoint({
    bytes: addressedCheckpointY.bytes,
    expectedAddress: addressedCheckpointY.address,
    checkpointCrossing: checkpointCrossingY,
    verifyRelatteCrossing: async () => true,
    verifyReceiptSetCommitmentShape: () => true
  });

  const actionYZ = makeReceipt({
    occurredAt: "2026-10-04T20:02:00Z",
    actorId: "actor:c",
    placeId: "place:c",
    action: "act-through-tenet",
    inputs: ["receipt:admit-y"],
    outputs: ["trace:tenet-response"],
    priorTraceIds: ["trace:local-y"]
  });
  const responseYZ = {
    schema: "gro.trace.v0",
    traceId: "trace:response-z",
    receiptId: actionYZ.receiptId,
    sourceActorId: "actor:c",
    kind: "tenet-response",
    relatedTenetTraceId: "trace:local-y",
    authority: "influence-only"
  };
  const directYZ = {
    parentCrossing: crossingY,
    parentAdmissionReceipt: {
      receipt_id: "receipt:admit-y",
      crossing_id: "crossing:y"
    },
    fieldProjection: {
      projection_id: "field:c",
      history_root: "history:c"
    },
    uptake: {
      uptake_id: "uptake:yz",
      ancestor_crossing_id: "crossing:y",
      admitted_receipt_id: "receipt:admit-y",
      field_projection_id: "field:c",
      field_history_root: "history:c"
    }
  };

  const payloadZ = makePrunedDescendantWorldSeed({
    parentLocalTrace: {
      schema: "gro.trace.v0",
      traceId: "trace:local-y",
      receiptId: "receipt:admit-y",
      kind: "tenet",
      lineage: {
        descendantCrossingId: "crossing:y",
        descendantPayloadAddress: verifiedY.address
      }
    },
    actionReceipt: actionYZ,
    actionResponseTrace: responseYZ,
    descendantTenet: {
      seedId: "seed:z",
      label: "Z",
      offeredActionLabel: "Act Z",
      requiredHeldKind: null,
      authorId: "actor:c",
      authorControl: false
    },
    directLineageEvidence: directYZ,
    ancestryCheckpoint: verifiedCheckpointY
  });
  const addressedZ = addressPrunedDescendantWorldSeed(payloadZ);
  const crossingZ = {
    crossing_id: "crossing:z",
    parents: ["crossing:y"],
    payload_refs: [
      {
        address: addressedZ.address,
        role: "cultural-descendant",
        media_type: GRO_PRUNED_DESCENDANT_MEDIA_TYPE
      }
    ]
  };
  const verifiedZ = await verifyPrunedDescendantWorldSeed({
    bytes: addressedZ.bytes,
    expectedAddress: addressedZ.address,
    descendantCrossing: crossingZ,
    verifyRelatteLineage: async () => true,
    verifyRelatteCrossing: async () => true,
    verifyReceiptSetCommitmentShape: () => true
  });

  const checkpointZ = createLineageCheckpoint({
    verifiedSeed: verifiedZ,
    subjectCrossing: crossingZ,
    localReceiptSetCommitment: commitment("world:d", "z"),
    checkpointWorldId: "world:d",
    createdAt: "2026-10-04T20:03:00Z"
  });
  const addressedCheckpointZ = addressLineageCheckpoint(checkpointZ);
  const checkpointCrossingZ = {
    ...makeLineageCheckpointDraft({
      checkpoint: checkpointZ,
      checkpointAddress: addressedCheckpointZ.address,
      sourceParticular: "receiver:d",
      createdAt: "2026-10-04T20:03:01Z"
    }),
    crossing_id: "crossing:checkpoint-z"
  };
  const verifiedCheckpointZ = await verifyLineageCheckpoint({
    bytes: addressedCheckpointZ.bytes,
    expectedAddress: addressedCheckpointZ.address,
    checkpointCrossing: checkpointCrossingZ,
    verifyRelatteCrossing: async () => true,
    verifyReceiptSetCommitmentShape: () => true
  });

  const localZ = localizePrunedDescendantWorldSeed({
    verifiedSeed: verifiedZ,
    descendantCrossing: crossingZ,
    dispositionReceipt: {
      receipt_id: "receipt:admit-z",
      crossing_id: "crossing:z",
      world_id: "world:d",
      receiver_particular: "receiver:d",
      kind: "R3_ADMIT"
    },
    destination: {
      worldId: "world:d",
      placeId: "place:d"
    }
  });

  const actionZQ = makeReceipt({
    occurredAt: "2026-10-04T20:04:00Z",
    actorId: "actor:d",
    placeId: "place:d",
    action: "act-through-tenet",
    inputs: ["receipt:admit-z"],
    outputs: ["trace:tenet-response"],
    priorTraceIds: [localZ.traceId]
  });
  const responseZQ = {
    schema: "gro.trace.v0",
    traceId: "trace:response-q",
    receiptId: actionZQ.receiptId,
    sourceActorId: "actor:d",
    kind: "tenet-response",
    relatedTenetTraceId: localZ.traceId,
    authority: "influence-only"
  };
  const directZQ = {
    parentCrossing: crossingZ,
    parentAdmissionReceipt: {
      receipt_id: "receipt:admit-z",
      crossing_id: "crossing:z"
    },
    fieldProjection: {
      projection_id: "field:d",
      history_root: "history:d"
    },
    uptake: {
      uptake_id: "uptake:zq",
      ancestor_crossing_id: "crossing:z",
      admitted_receipt_id: "receipt:admit-z",
      field_projection_id: "field:d",
      field_history_root: "history:d"
    }
  };

  const payloadQ = makePrunedDescendantWorldSeed({
    parentLocalTrace: localZ,
    actionReceipt: actionZQ,
    actionResponseTrace: responseZQ,
    descendantTenet: {
      seedId: "seed:q",
      label: "Q",
      offeredActionLabel: "Act Q",
      requiredHeldKind: null,
      authorId: "actor:d",
      authorControl: false
    },
    directLineageEvidence: directZQ,
    ancestryCheckpoint: verifiedCheckpointZ
  });
  const addressedQ = addressPrunedDescendantWorldSeed(payloadQ);
  const crossingQ = {
    crossing_id: "crossing:q",
    parents: ["crossing:z"],
    payload_refs: [
      {
        address: addressedQ.address,
        role: "cultural-descendant",
        media_type: GRO_PRUNED_DESCENDANT_MEDIA_TYPE
      }
    ]
  };

  return {
    checkpointY,
    addressedCheckpointY,
    checkpointCrossingY,
    checkpointZ,
    addressedCheckpointZ,
    checkpointCrossingZ,
    payloadQ,
    addressedQ,
    crossingQ
  };
}

test("successor checkpoint binds compact predecessor anchor and previous root", async () => {
  const {
    checkpointY,
    addressedCheckpointY,
    checkpointCrossingY,
    checkpointZ,
    checkpointCrossingZ
  } = await fixture();

  assert.equal(checkpointZ.generation, 2);
  assert.equal(checkpointZ.previousLineageRoot, checkpointY.lineageRoot);
  assert.deepEqual(checkpointZ.predecessorAnchor, {
    checkpointId: checkpointY.checkpointId,
    checkpointAddress: addressedCheckpointY.address,
    checkpointCrossingId: checkpointCrossingY.crossing_id,
    lineageRoot: checkpointY.lineageRoot,
    generation: 1
  });

  assert.deepEqual(checkpointCrossingZ.parents, [
    "crossing:z",
    checkpointCrossingY.crossing_id
  ]);
});

test("Q carries only the newest checkpoint body", async () => {
  const { checkpointY, checkpointZ, payloadQ } = await fixture();
  const serialized = stableStringify(payloadQ);

  const checkpointSchemaCount =
    serialized.split('"schema":"gro.lineage-checkpoint.v0"').length - 1;

  assert.equal(checkpointSchemaCount, 1);
  assert.equal(
    payloadQ.ancestryCheckpoint.checkpoint.checkpointId,
    checkpointZ.checkpointId
  );
  assert.equal(
    payloadQ.ancestryCheckpoint.checkpoint.predecessorAnchor.checkpointId,
    checkpointY.checkpointId
  );
  assert.equal(
    Object.hasOwn(
      payloadQ.ancestryCheckpoint.checkpoint.predecessorAnchor,
      "checkpoint"
    ),
    false
  );
});

test("Q verifies with newest checkpoint after old checkpoint body is absent", async () => {
  const { addressedQ, crossingQ } = await fixture();

  const verified = await verifyPrunedDescendantWorldSeed({
    bytes: addressedQ.bytes,
    expectedAddress: addressedQ.address,
    descendantCrossing: crossingQ,
    verifyRelatteLineage: async () => true,
    verifyRelatteCrossing: async () => true,
    verifyReceiptSetCommitmentShape: () => true
  });

  assert.equal(verified.lineageVerified, true);
  assert.equal(verified.lineageMode, "checkpointed-resumable");
  assert.equal(verified.generation, 3);
});

test("tampering predecessor anchor breaks successor checkpoint verification", async () => {
  const {
    addressedCheckpointZ,
    checkpointCrossingZ
  } = await fixture();

  const tampered = JSON.parse(addressedCheckpointZ.bytes.toString("utf8"));
  tampered.predecessorAnchor.lineageRoot =
    "gro-lineage-root-v0:" + "0".repeat(64);
  const bytes = Buffer.from(stableStringify(tampered), "utf8");

  await assert.rejects(
    () =>
      verifyLineageCheckpoint({
        bytes,
        expectedAddress: addressedCheckpointZ.address,
        checkpointCrossing: checkpointCrossingZ,
        verifyRelatteCrossing: async () => true,
        verifyReceiptSetCommitmentShape: () => true
      }),
    /LINEAGE_CHECKPOINT_ADDRESS_MISMATCH|PREDECESSOR_LINEAGE_ROOT_MISMATCH|LINEAGE_ROOT_MISMATCH/
  );
});
