import test from "node:test";
import assert from "node:assert/strict";

import { makeReceipt } from "../src/receipt.js";
import { stableStringify } from "../src/stable.js";
import {
  GRO_LINEAGE_CHECKPOINT_MEDIA_TYPE,
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

function fixture() {
  const fullY = {
    schema: "gro.descendant-world-seed.v1",
    ancestor: {
      payloadAddress: sha("a"),
      crossingId: "crossing:x",
      localTraceId: "trace:x",
      localAdmissionReceiptId: "receipt:admit-x"
    },
    action: {
      receipt: {
        receiptId: sha("b"),
        actorId: "actor:b"
      }
    },
    lineage: {
      uptake: {
        uptake_id: "uptake:xy"
      }
    },
    tenet: {
      seedId: "seed:y",
      label: "Y",
      offeredActionLabel: "Act Y",
      requiredHeldKind: null,
      authorId: "actor:b",
      authorControl: false
    },
    sentinel: "FULL_X_EVIDENCE_SENTINEL_SHOULD_NOT_RECURSE"
  };

  const verifiedY = {
    address: sha("c"),
    payload: fullY,
    lineageVerified: true
  };

  const crossingY = {
    crossing_id: "crossing:y",
    payload_refs: [
      {
        address: verifiedY.address,
        role: "cultural-descendant",
        media_type: "application/vnd.gro.descendant-world-seed+json"
      }
    ]
  };

  const commitment = {
    schema: "relatte.receipt-set-commitment/v0",
    commitment_id: "commitment:c",
    world_id: "world:c",
    local_history_head: "history:c",
    receipt_ids: ["receipt:receive-y", "receipt:admit-y"],
    receipt_count: 2,
    receipt_set_root: "relatte-receipt-set-v0:root-c",
    created_at: "2026-10-04T19:20:00Z",
    laws: ["COMMITMENT != HISTORY"]
  };

  const checkpoint = createLineageCheckpoint({
    verifiedSeed: verifiedY,
    subjectCrossing: crossingY,
    localReceiptSetCommitment: commitment,
    checkpointWorldId: "world:c",
    createdAt: "2026-10-04T19:21:00Z"
  });
  const addressedCheckpoint = addressLineageCheckpoint(checkpoint);
  const checkpointDraft = makeLineageCheckpointDraft({
    checkpoint,
    checkpointAddress: addressedCheckpoint.address,
    sourceParticular: "receiver:c",
    createdAt: "2026-10-04T19:21:01Z"
  });
  const checkpointCrossing = {
    ...checkpointDraft,
    crossing_id: "crossing:checkpoint-y",
    signing: {
      algorithm: "test"
    }
  };

  const verifiedCheckpoint = {
    address: addressedCheckpoint.address,
    checkpoint,
    checkpointCrossing,
    checkpointVerified: true
  };

  const parentLocalTrace = {
    schema: "gro.trace.v0",
    traceId: "trace:local-y",
    receiptId: "receipt:admit-y",
    kind: "tenet",
    lineage: {
      descendantCrossingId: "crossing:y",
      descendantPayloadAddress: verifiedY.address
    }
  };

  const actionReceipt = makeReceipt({
    occurredAt: "2026-10-04T19:22:00Z",
    actorId: "actor:c",
    placeId: "place:c",
    action: "act-through-tenet",
    inputs: ["receipt:admit-y"],
    outputs: ["trace:tenet-response"],
    priorTraceIds: ["trace:local-y"]
  });
  const response = {
    schema: "gro.trace.v0",
    traceId: "trace:response-z",
    receiptId: actionReceipt.receiptId,
    sourceActorId: "actor:c",
    kind: "tenet-response",
    relatedTenetTraceId: "trace:local-y",
    authority: "influence-only"
  };

  const directLineage = {
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
    parentLocalTrace,
    actionReceipt,
    actionResponseTrace: response,
    descendantTenet: {
      seedId: "seed:z",
      label: "Z",
      offeredActionLabel: "Act Z",
      requiredHeldKind: null,
      authorId: "actor:c",
      authorControl: false
    },
    directLineageEvidence: directLineage,
    ancestryCheckpoint: verifiedCheckpoint
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

  return {
    fullY,
    verifiedY,
    crossingY,
    checkpoint,
    addressedCheckpoint,
    checkpointCrossing,
    payloadZ,
    addressedZ,
    crossingZ
  };
}

test("checkpoint compresses a fully verified generation into a bounded lineage root", () => {
  const { checkpoint, verifiedY } = fixture();

  assert.equal(checkpoint.generation, 1);
  assert.equal(checkpoint.previousLineageRoot, null);
  assert.equal(checkpoint.subject.crossingId, "crossing:y");
  assert.equal(checkpoint.subject.payloadAddress, verifiedY.address);
  assert.equal(checkpoint.directParent.crossingId, "crossing:x");
  assert.match(checkpoint.lineageRoot, /^gro-lineage-root-v0:/);
  assert.equal(checkpoint.authority, null);
  assert.equal(checkpoint.semanticEffect, "none");
});

test("pruned Z does not recursively embed Y's full X evidence bundle", () => {
  const { fullY, payloadZ } = fixture();

  const pruned = stableStringify(payloadZ);
  const naive = stableStringify({
    ...payloadZ,
    recursivelyNestedParentPayload: fullY
  });

  assert.equal(
    pruned.includes("FULL_X_EVIDENCE_SENTINEL_SHOULD_NOT_RECURSE"),
    false
  );
  assert.ok(Buffer.byteLength(pruned) < Buffer.byteLength(naive));
});

test("checkpoint verification binds signed carrier, receipt commitment shape, and checkpoint bytes", async () => {
  const { checkpoint, addressedCheckpoint, checkpointCrossing } = fixture();

  const verified = await verifyLineageCheckpoint({
    bytes: addressedCheckpoint.bytes,
    expectedAddress: addressedCheckpoint.address,
    checkpointCrossing,
    verifyRelatteCrossing: async () => true,
    verifyReceiptSetCommitmentShape: () => true
  });

  assert.equal(verified.checkpointVerified, true);
  assert.equal(verified.checkpoint.checkpointId, checkpoint.checkpointId);

  await assert.rejects(
    () =>
      verifyLineageCheckpoint({
        bytes: addressedCheckpoint.bytes,
        expectedAddress: addressedCheckpoint.address,
        checkpointCrossing,
        verifyRelatteCrossing: async () => true,
        verifyReceiptSetCommitmentShape: () => false
      }),
    /INVALID_LINEAGE_RECEIPT_SET_COMMITMENT/
  );
});

test("Z verifies its direct Y relation plus checkpointed earlier ancestry", async () => {
  const { addressedZ, crossingZ } = fixture();

  const verified = await verifyPrunedDescendantWorldSeed({
    bytes: addressedZ.bytes,
    expectedAddress: addressedZ.address,
    descendantCrossing: crossingZ,
    verifyRelatteLineage: async () => true,
    verifyRelatteCrossing: async () => true,
    verifyReceiptSetCommitmentShape: () => true
  });

  assert.equal(verified.lineageVerified, true);
  assert.equal(verified.lineageMode, "checkpointed-resumable");
  assert.equal(verified.generation, 2);

  const trace = localizePrunedDescendantWorldSeed({
    verifiedSeed: verified,
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

  assert.equal(trace.lineage.generation, 2);
  assert.equal(trace.lineage.lineageMode, "checkpointed-resumable");
  assert.equal(trace.lineage.ancestryAuthority, false);
});

test("checkpoint carrier role is explicit and non-semantic", () => {
  const { checkpoint, addressedCheckpoint } = fixture();
  const draft = makeLineageCheckpointDraft({
    checkpoint,
    checkpointAddress: addressedCheckpoint.address,
    sourceParticular: "receiver:c",
    createdAt: "2026-10-04T19:21:01Z"
  });

  assert.equal(draft.declared_kind, "R11_LINEAGE_CHECKPOINT");
  assert.equal(draft.requested_effect, null);
  assert.equal(draft.payload_refs[0].media_type, GRO_LINEAGE_CHECKPOINT_MEDIA_TYPE);
  assert.equal(draft.extensions.gro_lineage_checkpoint.authority, null);
});
