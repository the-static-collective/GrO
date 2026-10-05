import { createHash } from "node:crypto";

import { verifyOccurrenceReceipt } from "./receipt.js";
import { stableStringify } from "./stable.js";
import { GRO_DESCENDANT_MEDIA_TYPE } from "./descendant.js";

export const GRO_LINEAGE_CHECKPOINT_MEDIA_TYPE =
  "application/vnd.gro.lineage-checkpoint+json";
export const GRO_PRUNED_DESCENDANT_MEDIA_TYPE =
  "application/vnd.gro.pruned-descendant-world-seed+json";

function asObject(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(code);
  }
  return value;
}

function nonEmpty(value, code) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(code);
  return value;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function requireAddress(value, code = "INVALID_SHA256_ADDRESS") {
  const address = nonEmpty(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(address)) throw new Error(code);
  return address;
}

function bytesOf(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  throw new Error("INVALID_BYTES");
}

function hashJson(value) {
  return `sha256:${sha256(Buffer.from(stableStringify(value), "utf8"))}`;
}

function normalizeTenet(value, actorId) {
  const tenet = asObject(value, "INVALID_PRUNED_DESCENDANT_TENET");
  if (tenet.authorId !== actorId) {
    throw new Error("PRUNED_DESCENDANT_AUTHOR_MUST_BE_ACTION_ACTOR");
  }
  if (tenet.authorControl !== false) {
    throw new Error("PRUNED_DESCENDANT_AUTHOR_CONTROL_MUST_BE_FALSE");
  }

  return {
    seedId: nonEmpty(tenet.seedId, "INVALID_PRUNED_DESCENDANT_SEED_ID"),
    label: nonEmpty(tenet.label, "INVALID_PRUNED_DESCENDANT_LABEL"),
    offeredActionLabel: nonEmpty(
      tenet.offeredActionLabel,
      "INVALID_PRUNED_DESCENDANT_ACTION_LABEL"
    ),
    requiredHeldKind: tenet.requiredHeldKind ?? null,
    authorId: actorId,
    authorControl: false,
    dispositions: ["notice", "hold", "ignore", "act-through"]
  };
}

function checkpointSubjectFromVerifiedSeed(
  verifiedSeed,
  subjectCrossing,
  predecessorCheckpoint = null
) {
  const verified = asObject(verifiedSeed, "INVALID_VERIFIED_SEED");
  if (verified.lineageVerified !== true) {
    throw new Error("FULL_LINEAGE_VERIFICATION_REQUIRED_BEFORE_CHECKPOINT");
  }

  const payload = asObject(verified.payload, "INVALID_VERIFIED_SEED_PAYLOAD");
  const crossing = asObject(subjectCrossing, "INVALID_CHECKPOINT_SUBJECT_CROSSING");
  const subjectPayloadAddress = requireAddress(
    verified.address,
    "INVALID_CHECKPOINT_SUBJECT_ADDRESS"
  );

  const bound = Array.isArray(crossing.payload_refs)
    ? crossing.payload_refs.some((entry) => entry?.address === subjectPayloadAddress)
    : false;
  if (!bound) throw new Error("SUBJECT_CROSSING_DOES_NOT_BIND_PAYLOAD");

  if (payload.schema === "gro.mineral-world-seed.v0") {
    const ancestry = payload.ancestry;
    const subject = {
      crossingId: nonEmpty(
        crossing.crossing_id,
        "INVALID_SUBJECT_CROSSING_ID"
      ),
      payloadAddress: subjectPayloadAddress
    };

    if (ancestry == null) {
      if (predecessorCheckpoint != null) {
        throw new Error("ROOT_MINERAL_CHECKPOINT_MUST_NOT_HAVE_PREDECESSOR");
      }
      return {
        generation: 1,
        previousLineageRoot: null,
        predecessorAnchor: null,
        subject,
        directParent: null,
        verification: {
          mode: "full-mineral-evidence-before-checkpoint",
          mineralVerificationReceiptAddress: requireAddress(
            payload.verification?.receiptAddress,
            "INVALID_MINERAL_VERIFICATION_RECEIPT_ADDRESS"
          ),
          evidenceAddress: subjectPayloadAddress
        }
      };
    }

    const predecessor = asObject(
      predecessorCheckpoint,
      "MINERAL_DESCENDANT_REQUIRES_PREDECESSOR_CHECKPOINT"
    );
    if (
      predecessor.checkpointVerified !== true ||
      predecessor.successionVerified !== true
    ) {
      throw new Error("VERIFIED_MINERAL_PREDECESSOR_CHECKPOINT_REQUIRED");
    }
    const prior = asObject(
      predecessor.checkpoint,
      "INVALID_MINERAL_PREDECESSOR_CHECKPOINT"
    );
    const priorCrossing = asObject(
      predecessor.checkpointCrossing,
      "INVALID_MINERAL_PREDECESSOR_CHECKPOINT_CROSSING"
    );
    if (
      prior.subject?.crossingId !== ancestry.ancestorCrossingId ||
      prior.subject?.payloadAddress !== ancestry.ancestorSeedAddress
    ) {
      throw new Error("MINERAL_PREDECESSOR_DOES_NOT_MATCH_ANCESTOR");
    }
    const priorGeneration = Number(prior.generation);
    if (!Number.isInteger(priorGeneration) || priorGeneration < 1) {
      throw new Error("INVALID_MINERAL_PREDECESSOR_GENERATION");
    }

    return {
      generation: priorGeneration + 1,
      previousLineageRoot: nonEmpty(
        prior.lineageRoot,
        "INVALID_PREVIOUS_LINEAGE_ROOT"
      ),
      predecessorAnchor: {
        checkpointId: nonEmpty(
          prior.checkpointId,
          "INVALID_PREDECESSOR_CHECKPOINT_ID"
        ),
        checkpointAddress: requireAddress(
          predecessor.address,
          "INVALID_PREDECESSOR_CHECKPOINT_ADDRESS"
        ),
        checkpointCrossingId: nonEmpty(
          priorCrossing.crossing_id,
          "INVALID_PREDECESSOR_CHECKPOINT_CROSSING_ID"
        ),
        lineageRoot: nonEmpty(
          prior.lineageRoot,
          "INVALID_PREDECESSOR_LINEAGE_ROOT"
        ),
        generation: priorGeneration
      },
      subject,
      directParent: {
        crossingId: nonEmpty(
          ancestry.ancestorCrossingId,
          "INVALID_MINERAL_ANCESTOR_CROSSING"
        ),
        payloadAddress: requireAddress(
          ancestry.ancestorSeedAddress,
          "INVALID_MINERAL_ANCESTOR_SEED_ADDRESS"
        )
      },
      verification: {
        mode: "full-mineral-evidence-and-descendant-lineage-before-checkpoint",
        actionReceiptId: nonEmpty(
          ancestry.actionReceiptId,
          "INVALID_MINERAL_ANCESTOR_ACTION_RECEIPT"
        ),
        wantId: nonEmpty(
          ancestry.wantId,
          "INVALID_MINERAL_ANCESTOR_WANT"
        ),
        mineralVerificationReceiptAddress: requireAddress(
          payload.verification?.receiptAddress,
          "INVALID_MINERAL_VERIFICATION_RECEIPT_ADDRESS"
        ),
        evidenceAddress: subjectPayloadAddress
      }
    };
  }

  if (payload.schema === "gro.descendant-world-seed.v1") {
    const ancestor = asObject(payload.ancestor, "INVALID_CHECKPOINT_ANCESTOR");
    const action = asObject(
      asObject(payload.action, "INVALID_CHECKPOINT_ACTION").receipt,
      "INVALID_CHECKPOINT_ACTION_RECEIPT"
    );
    const uptake = asObject(
      asObject(payload.lineage, "INVALID_CHECKPOINT_LINEAGE").uptake,
      "INVALID_CHECKPOINT_UPTAKE"
    );

    return {
      generation: 1,
      previousLineageRoot: null,
      predecessorAnchor: null,
      subject: {
        crossingId: nonEmpty(crossing.crossing_id, "INVALID_SUBJECT_CROSSING_ID"),
        payloadAddress: subjectPayloadAddress
      },
      directParent: {
        crossingId: nonEmpty(
          ancestor.crossingId,
          "INVALID_CHECKPOINT_PARENT_CROSSING_ID"
        ),
        payloadAddress: requireAddress(
          ancestor.payloadAddress,
          "INVALID_CHECKPOINT_PARENT_PAYLOAD_ADDRESS"
        )
      },
      verification: {
        mode: "full-evidence-before-prune",
        uptakeId: nonEmpty(uptake.uptake_id, "INVALID_CHECKPOINT_UPTAKE_ID"),
        actionReceiptId: nonEmpty(
          action.receiptId,
          "INVALID_CHECKPOINT_ACTION_RECEIPT_ID"
        ),
        evidenceAddress: subjectPayloadAddress
      }
    };
  }

  if (payload.schema === "gro.pruned-descendant-world-seed.v1") {
    const parent = asObject(payload.parent, "INVALID_CHECKPOINT_PARENT");
    const action = asObject(
      asObject(payload.action, "INVALID_CHECKPOINT_ACTION").receipt,
      "INVALID_CHECKPOINT_ACTION_RECEIPT"
    );
    const uptake = asObject(
      asObject(payload.directLineage, "INVALID_CHECKPOINT_LINEAGE").uptake,
      "INVALID_CHECKPOINT_UPTAKE"
    );
    const inherited = asObject(
      payload.ancestryCheckpoint,
      "INVALID_INHERITED_CHECKPOINT"
    );
    const prior = asObject(
      inherited.checkpoint,
      "INVALID_INHERITED_CHECKPOINT_BODY"
    );
    const priorCrossing = asObject(
      inherited.checkpointCrossing,
      "INVALID_INHERITED_CHECKPOINT_CROSSING"
    );
    const priorGeneration = Number(prior.generation);
    if (!Number.isInteger(priorGeneration) || priorGeneration < 1) {
      throw new Error("INVALID_PREDECESSOR_GENERATION");
    }

    return {
      generation: priorGeneration + 1,
      previousLineageRoot: nonEmpty(
        prior.lineageRoot,
        "INVALID_PREVIOUS_LINEAGE_ROOT"
      ),
      predecessorAnchor: {
        checkpointId: nonEmpty(
          prior.checkpointId,
          "INVALID_PREDECESSOR_CHECKPOINT_ID"
        ),
        checkpointAddress: requireAddress(
          inherited.address,
          "INVALID_PREDECESSOR_CHECKPOINT_ADDRESS"
        ),
        checkpointCrossingId: nonEmpty(
          priorCrossing.crossing_id,
          "INVALID_PREDECESSOR_CHECKPOINT_CROSSING_ID"
        ),
        lineageRoot: nonEmpty(
          prior.lineageRoot,
          "INVALID_PREDECESSOR_LINEAGE_ROOT"
        ),
        generation: priorGeneration
      },
      subject: {
        crossingId: nonEmpty(crossing.crossing_id, "INVALID_SUBJECT_CROSSING_ID"),
        payloadAddress: subjectPayloadAddress
      },
      directParent: {
        crossingId: nonEmpty(
          parent.crossingId,
          "INVALID_CHECKPOINT_PARENT_CROSSING_ID"
        ),
        payloadAddress: requireAddress(
          parent.payloadAddress,
          "INVALID_CHECKPOINT_PARENT_PAYLOAD_ADDRESS"
        )
      },
      verification: {
        mode: "checkpointed-direct-relation",
        uptakeId: nonEmpty(uptake.uptake_id, "INVALID_CHECKPOINT_UPTAKE_ID"),
        actionReceiptId: nonEmpty(
          action.receiptId,
          "INVALID_CHECKPOINT_ACTION_RECEIPT_ID"
        ),
        evidenceAddress: subjectPayloadAddress
      }
    };
  }

  throw new Error("UNSUPPORTED_CHECKPOINT_SEED_SCHEMA");
}

function checkpointRootBody(body) {
  return {
    generation: body.generation,
    previousLineageRoot: body.previousLineageRoot,
    predecessorAnchor: body.predecessorAnchor,
    subject: body.subject,
    directParent: body.directParent,
    verification: body.verification,
    localReceiptSetRoot: body.localReceiptSetCommitment.receipt_set_root
  };
}

function checkpointIdentityBody(body) {
  return {
    schema: "gro.lineage-checkpoint.v0",
    checkpointWorldId: body.checkpointWorldId,
    generation: body.generation,
    previousLineageRoot: body.previousLineageRoot,
    predecessorAnchor: body.predecessorAnchor,
    subject: body.subject,
    directParent: body.directParent,
    verification: body.verification,
    localReceiptSetCommitment: body.localReceiptSetCommitment,
    lineageRoot: body.lineageRoot,
    createdAt: body.createdAt,
    semanticEffect: "none",
    authority: null,
    laws: body.laws
  };
}

export function createLineageCheckpoint({
  verifiedSeed,
  subjectCrossing,
  predecessorCheckpoint = null,
  localReceiptSetCommitment,
  checkpointWorldId,
  createdAt
}) {
  const relation = checkpointSubjectFromVerifiedSeed(
    verifiedSeed,
    subjectCrossing,
    predecessorCheckpoint
  );
  const commitment = asObject(
    localReceiptSetCommitment,
    "INVALID_LINEAGE_RECEIPT_SET_COMMITMENT"
  );
  if (commitment.schema !== "relatte.receipt-set-commitment/v0") {
    throw new Error("INVALID_LINEAGE_RECEIPT_SET_COMMITMENT");
  }
  if (commitment.world_id !== checkpointWorldId) {
    throw new Error("CHECKPOINT_WORLD_COMMITMENT_MISMATCH");
  }

  const body = {
    schema: "gro.lineage-checkpoint.v0",
    checkpointWorldId: nonEmpty(
      checkpointWorldId,
      "INVALID_CHECKPOINT_WORLD_ID"
    ),
    generation: relation.generation,
    previousLineageRoot: relation.previousLineageRoot,
    predecessorAnchor: relation.predecessorAnchor,
    subject: relation.subject,
    directParent: relation.directParent,
    verification: relation.verification,
    localReceiptSetCommitment: structuredClone(commitment),
    lineageRoot: null,
    createdAt: nonEmpty(createdAt, "INVALID_CHECKPOINT_CREATED_AT"),
    semanticEffect: "none",
    authority: null,
    laws: [
      "CHECKPOINT != HISTORY",
      "COMMITMENT != EVIDENCE",
      "PRUNING != RETCON",
      "LINEAGE ROOT != AUTHORITY",
      "FULL VERIFICATION PRECEDES PRUNING",
      "REHYDRATION MAY RECHECK HISTORY",
      "SUCCESSOR ROOT BINDS PREDECESSOR ANCHOR"
    ]
  };

  body.lineageRoot = `gro-lineage-root-v0:${sha256(
    Buffer.from(stableStringify(checkpointRootBody(body)), "utf8")
  )}`;

  return {
    ...body,
    checkpointId: `gro-lineage-checkpoint-v0:${sha256(
      Buffer.from(stableStringify(checkpointIdentityBody(body)), "utf8")
    )}`
  };
}

export function addressLineageCheckpoint(checkpoint) {
  const text = stableStringify(checkpoint);
  const bytes = Buffer.from(text, "utf8");
  return {
    address: `sha256:${sha256(bytes)}`,
    bytes
  };
}


function checkpointSuccessionShape(checkpoint) {
  const generation = Number(checkpoint.generation);
  if (!Number.isInteger(generation) || generation < 1) {
    throw new Error("INVALID_LINEAGE_CHECKPOINT_GENERATION");
  }

  if (generation === 1) {
    if (
      checkpoint.previousLineageRoot !== null ||
      checkpoint.predecessorAnchor !== null
    ) {
      throw new Error("GENESIS_CHECKPOINT_MUST_NOT_HAVE_PREDECESSOR");
    }
    return {
      generation,
      predecessorAnchor: null,
      expectedParents: [checkpoint.subject.crossingId]
    };
  }

  const anchor = asObject(
    checkpoint.predecessorAnchor,
    "SUCCESSOR_CHECKPOINT_REQUIRES_PREDECESSOR_ANCHOR"
  );
  const anchorGeneration = Number(anchor.generation);
  if (
    !Number.isInteger(anchorGeneration) ||
    anchorGeneration !== generation - 1
  ) {
    throw new Error("PREDECESSOR_GENERATION_MISMATCH");
  }

  const lineageRoot = nonEmpty(
    anchor.lineageRoot,
    "INVALID_PREDECESSOR_LINEAGE_ROOT"
  );
  if (checkpoint.previousLineageRoot !== lineageRoot) {
    throw new Error("PREDECESSOR_LINEAGE_ROOT_MISMATCH");
  }

  const normalized = {
    checkpointId: nonEmpty(
      anchor.checkpointId,
      "INVALID_PREDECESSOR_CHECKPOINT_ID"
    ),
    checkpointAddress: requireAddress(
      anchor.checkpointAddress,
      "INVALID_PREDECESSOR_CHECKPOINT_ADDRESS"
    ),
    checkpointCrossingId: nonEmpty(
      anchor.checkpointCrossingId,
      "INVALID_PREDECESSOR_CHECKPOINT_CROSSING_ID"
    ),
    lineageRoot,
    generation: anchorGeneration
  };

  return {
    generation,
    predecessorAnchor: normalized,
    expectedParents: [
      checkpoint.subject.crossingId,
      normalized.checkpointCrossingId
    ]
  };
}

export function makeLineageCheckpointDraft({
  checkpoint,
  checkpointAddress,
  sourceParticular,
  createdAt
}) {
  const body = asObject(checkpoint, "INVALID_LINEAGE_CHECKPOINT");
  const address = requireAddress(
    checkpointAddress,
    "INVALID_LINEAGE_CHECKPOINT_ADDRESS"
  );

  const succession = checkpointSuccessionShape(body);

  return {
    schema: "relatte.crossing-envelope/v0",
    protocol_version: "0",
    source_particular: nonEmpty(
      sourceParticular,
      "INVALID_CHECKPOINT_SOURCE_PARTICULAR"
    ),
    source_world: nonEmpty(
      body.checkpointWorldId,
      "INVALID_CHECKPOINT_SOURCE_WORLD"
    ),
    source_history_head: nonEmpty(
      body.localReceiptSetCommitment.receipt_set_root,
      "INVALID_CHECKPOINT_HISTORY_ROOT"
    ),
    parents: succession.expectedParents,
    declared_kind: "R11_LINEAGE_CHECKPOINT",
    payload_refs: [
      {
        address,
        role: "lineage-checkpoint",
        media_type: GRO_LINEAGE_CHECKPOINT_MEDIA_TYPE
      }
    ],
    requested_effect: null,
    capability_ref: null,
    privacy_policy: null,
    audience_policy: null,
    return_address: null,
    created_at: nonEmpty(createdAt, "INVALID_CHECKPOINT_CROSSING_CREATED_AT"),
    extensions: {
      gro_lineage_checkpoint: {
        checkpoint_id: body.checkpointId,
        lineage_root: body.lineageRoot,
        generation: body.generation,
        previous_lineage_root: body.previousLineageRoot,
        predecessor_anchor: body.predecessorAnchor,
        semantic_effect: "none",
        authority: null,
        laws: [
          "CHECKPOINT != HISTORY",
          "CHECKPOINT != AUTHORITY",
          "SIGNED CHECKPOINT != GLOBAL CANON"
        ]
      }
    }
  };
}

export async function verifyLineageCheckpoint({
  bytes,
  expectedAddress,
  checkpointCrossing,
  verifyRelatteCrossing,
  verifyReceiptSetCommitmentShape
}) {
  const raw = bytesOf(bytes);
  const address = requireAddress(
    expectedAddress,
    "INVALID_LINEAGE_CHECKPOINT_ADDRESS"
  );
  if (`sha256:${sha256(raw)}` !== address) {
    throw new Error("LINEAGE_CHECKPOINT_ADDRESS_MISMATCH");
  }

  const text = raw.toString("utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("INVALID_LINEAGE_CHECKPOINT_JSON");
  }
  if (stableStringify(parsed) !== text) {
    throw new Error("LINEAGE_CHECKPOINT_NOT_CANONICAL");
  }

  const checkpoint = asObject(parsed, "INVALID_LINEAGE_CHECKPOINT");
  if (checkpoint.schema !== "gro.lineage-checkpoint.v0") {
    throw new Error("INVALID_LINEAGE_CHECKPOINT_SCHEMA");
  }
  if (
    checkpoint.semanticEffect !== "none" ||
    checkpoint.authority !== null
  ) {
    throw new Error("LINEAGE_CHECKPOINT_AUTHORITY_ESCALATION");
  }

  const succession = checkpointSuccessionShape(checkpoint);

  const rootExpected = `gro-lineage-root-v0:${sha256(
    Buffer.from(stableStringify(checkpointRootBody(checkpoint)), "utf8")
  )}`;
  if (checkpoint.lineageRoot !== rootExpected) {
    throw new Error("LINEAGE_ROOT_MISMATCH");
  }

  const checkpointIdExpected = `gro-lineage-checkpoint-v0:${sha256(
    Buffer.from(stableStringify(checkpointIdentityBody(checkpoint)), "utf8")
  )}`;
  if (checkpoint.checkpointId !== checkpointIdExpected) {
    throw new Error("LINEAGE_CHECKPOINT_ID_MISMATCH");
  }

  if (typeof verifyReceiptSetCommitmentShape !== "function") {
    throw new Error("RECEIPT_SET_COMMITMENT_VERIFIER_REQUIRED");
  }
  if (
    verifyReceiptSetCommitmentShape(
      checkpoint.localReceiptSetCommitment
    ) !== true
  ) {
    throw new Error("INVALID_LINEAGE_RECEIPT_SET_COMMITMENT");
  }

  const crossing = asObject(
    checkpointCrossing,
    "INVALID_LINEAGE_CHECKPOINT_CROSSING"
  );
  if (typeof verifyRelatteCrossing !== "function") {
    throw new Error("RELATTE_CROSSING_VERIFIER_REQUIRED");
  }
  if ((await verifyRelatteCrossing(crossing)) !== true) {
    throw new Error("INVALID_LINEAGE_CHECKPOINT_CROSSING");
  }

  if (
    crossing.source_world !== checkpoint.checkpointWorldId ||
    !Array.isArray(crossing.parents) ||
    stableStringify(crossing.parents) !==
      stableStringify(succession.expectedParents)
  ) {
    throw new Error("LINEAGE_CHECKPOINT_CROSSING_RELATION_MISMATCH");
  }

  const ref = Array.isArray(crossing.payload_refs)
    ? crossing.payload_refs.find(
        (entry) =>
          entry?.address === address &&
          entry?.role === "lineage-checkpoint" &&
          entry?.media_type === GRO_LINEAGE_CHECKPOINT_MEDIA_TYPE
      )
    : null;
  if (!ref) throw new Error("LINEAGE_CHECKPOINT_CROSSING_DOES_NOT_BIND_BODY");

  const extension = asObject(
    asObject(crossing.extensions, "INVALID_CHECKPOINT_EXTENSIONS")
      .gro_lineage_checkpoint,
    "INVALID_CHECKPOINT_EXTENSION"
  );
  if (
    extension.checkpoint_id !== checkpoint.checkpointId ||
    extension.lineage_root !== checkpoint.lineageRoot ||
    extension.generation !== checkpoint.generation ||
    extension.previous_lineage_root !== checkpoint.previousLineageRoot ||
    stableStringify(extension.predecessor_anchor ?? null) !==
      stableStringify(checkpoint.predecessorAnchor ?? null) ||
    extension.semantic_effect !== "none" ||
    extension.authority !== null
  ) {
    throw new Error("LINEAGE_CHECKPOINT_EXTENSION_MISMATCH");
  }

  return {
    address,
    checkpoint,
    checkpointCrossing: crossing,
    checkpointVerified: true,
    successionVerified: true,
    predecessorAnchor: succession.predecessorAnchor
  };
}

function verifyDirectRelation({
  parent,
  action,
  response,
  directLineage,
  tenet
}) {
  const parentCrossing = asObject(
    directLineage.parentCrossing,
    "INVALID_DIRECT_PARENT_CROSSING"
  );
  const admission = asObject(
    directLineage.parentAdmissionReceipt,
    "INVALID_DIRECT_PARENT_ADMISSION"
  );
  const field = asObject(
    directLineage.fieldProjection,
    "INVALID_DIRECT_FIELD"
  );
  const uptake = asObject(directLineage.uptake, "INVALID_DIRECT_UPTAKE");

  if (parentCrossing.crossing_id !== parent.crossingId) {
    throw new Error("DIRECT_PARENT_CROSSING_MISMATCH");
  }
  if (admission.receipt_id !== parent.localAdmissionReceiptId) {
    throw new Error("DIRECT_PARENT_ADMISSION_MISMATCH");
  }
  if (admission.crossing_id !== parent.crossingId) {
    throw new Error("DIRECT_PARENT_ADMISSION_CROSSING_MISMATCH");
  }
  if (
    uptake.ancestor_crossing_id !== parent.crossingId ||
    uptake.admitted_receipt_id !== admission.receipt_id ||
    uptake.field_projection_id !== field.projection_id ||
    uptake.field_history_root !== field.history_root
  ) {
    throw new Error("DIRECT_UPTAKE_RELATION_MISMATCH");
  }

  if (!verifyOccurrenceReceipt(action)) {
    throw new Error("INVALID_PRUNED_DESCENDANT_ACTION_RECEIPT");
  }
  if (action.action !== "act-through-tenet") {
    throw new Error("PRUNED_DESCENDANT_REQUIRES_ACT_THROUGH_TENET");
  }
  if (!action.inputs.includes(admission.receipt_id)) {
    throw new Error("PRUNED_DESCENDANT_ACTION_NOT_LINKED_TO_ADMISSION");
  }
  if (
    response.kind !== "tenet-response" ||
    response.receiptId !== action.receiptId ||
    response.relatedTenetTraceId !== parent.localTraceId ||
    response.sourceActorId !== action.actorId
  ) {
    throw new Error("PRUNED_DESCENDANT_RESPONSE_MISMATCH");
  }
  if (tenet.authorId !== action.actorId) {
    throw new Error("PRUNED_DESCENDANT_TENET_ACTOR_MISMATCH");
  }

  return { parentCrossing, admission, field, uptake };
}

export function makePrunedDescendantWorldSeed({
  parentLocalTrace,
  actionReceipt,
  actionResponseTrace,
  descendantTenet,
  directLineageEvidence,
  ancestryCheckpoint
}) {
  const parentTrace = asObject(
    parentLocalTrace,
    "INVALID_PRUNED_PARENT_LOCAL_TRACE"
  );
  if (parentTrace.kind !== "tenet") {
    throw new Error("PRUNED_PARENT_LOCAL_TRACE_NOT_TENET");
  }

  const parentLineage = asObject(
    parentTrace.lineage,
    "PRUNED_PARENT_TRACE_MISSING_LINEAGE"
  );
  const parent = {
    crossingId: nonEmpty(
      parentLineage.descendantCrossingId,
      "INVALID_PRUNED_PARENT_CROSSING_ID"
    ),
    payloadAddress: requireAddress(
      parentLineage.descendantPayloadAddress,
      "INVALID_PRUNED_PARENT_PAYLOAD_ADDRESS"
    ),
    localTraceId: nonEmpty(
      parentTrace.traceId,
      "INVALID_PRUNED_PARENT_TRACE_ID"
    ),
    localAdmissionReceiptId: nonEmpty(
      parentTrace.receiptId,
      "INVALID_PRUNED_PARENT_ADMISSION_ID"
    )
  };

  const inherited = asObject(
    ancestryCheckpoint,
    "INVALID_PRUNED_ANCESTRY_CHECKPOINT"
  );
  if (inherited.checkpointVerified !== true) {
    throw new Error("VERIFIED_ANCESTRY_CHECKPOINT_REQUIRED");
  }
  const checkpoint = asObject(
    inherited.checkpoint,
    "INVALID_PRUNED_ANCESTRY_CHECKPOINT_BODY"
  );
  if (
    checkpoint.subject.crossingId !== parent.crossingId ||
    checkpoint.subject.payloadAddress !== parent.payloadAddress
  ) {
    throw new Error("ANCESTRY_CHECKPOINT_PARENT_MISMATCH");
  }

  const action = asObject(
    actionReceipt,
    "INVALID_PRUNED_DESCENDANT_ACTION_RECEIPT"
  );
  const response = asObject(
    actionResponseTrace,
    "INVALID_PRUNED_DESCENDANT_RESPONSE_TRACE"
  );
  const directLineage = asObject(
    directLineageEvidence,
    "INVALID_PRUNED_DIRECT_LINEAGE"
  );
  const tenet = normalizeTenet(descendantTenet, action.actorId);

  verifyDirectRelation({
    parent,
    action,
    response,
    directLineage,
    tenet
  });

  return {
    schema: "gro.pruned-descendant-world-seed.v1",
    parent,
    action: {
      receipt: structuredClone(action),
      responseTrace: structuredClone(response)
    },
    directLineage: {
      parentCrossing: structuredClone(directLineage.parentCrossing),
      parentAdmissionReceipt: structuredClone(
        directLineage.parentAdmissionReceipt
      ),
      fieldProjection: structuredClone(directLineage.fieldProjection),
      uptake: structuredClone(directLineage.uptake)
    },
    ancestryCheckpoint: {
      address: inherited.address,
      checkpoint: structuredClone(inherited.checkpoint),
      checkpointCrossing: structuredClone(inherited.checkpointCrossing)
    },
    tenet,
    laws: [
      "DESCENDANT != ANCESTOR",
      "CHECKPOINT != HISTORY",
      "PRUNED != FORGOTTEN",
      "LINEAGE != CENTRAL REGISTRY",
      "ANCESTRY != AUTHORITY",
      "DIRECT RELATION VERIFIED, EARLIER HISTORY CHECKPOINTED"
    ]
  };
}

export function addressPrunedDescendantWorldSeed(value) {
  const text = stableStringify(value);
  const bytes = Buffer.from(text, "utf8");
  return {
    address: `sha256:${sha256(bytes)}`,
    bytes
  };
}

export async function verifyPrunedDescendantWorldSeed({
  bytes,
  expectedAddress,
  descendantCrossing,
  verifyRelatteLineage,
  verifyRelatteCrossing,
  verifyReceiptSetCommitmentShape
}) {
  const raw = bytesOf(bytes);
  const address = requireAddress(
    expectedAddress,
    "INVALID_PRUNED_DESCENDANT_ADDRESS"
  );
  if (`sha256:${sha256(raw)}` !== address) {
    throw new Error("PRUNED_DESCENDANT_ADDRESS_MISMATCH");
  }

  const text = raw.toString("utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("INVALID_PRUNED_DESCENDANT_JSON");
  }
  if (stableStringify(parsed) !== text) {
    throw new Error("PRUNED_DESCENDANT_NOT_CANONICAL");
  }

  const payload = asObject(parsed, "INVALID_PRUNED_DESCENDANT_PAYLOAD");
  if (payload.schema !== "gro.pruned-descendant-world-seed.v1") {
    throw new Error("INVALID_PRUNED_DESCENDANT_SCHEMA");
  }

  const inherited = asObject(
    payload.ancestryCheckpoint,
    "INVALID_PRUNED_ANCESTRY_CHECKPOINT"
  );
  const checkpointBytes = Buffer.from(
    stableStringify(inherited.checkpoint),
    "utf8"
  );
  const verifiedCheckpoint = await verifyLineageCheckpoint({
    bytes: checkpointBytes,
    expectedAddress: inherited.address,
    checkpointCrossing: inherited.checkpointCrossing,
    verifyRelatteCrossing,
    verifyReceiptSetCommitmentShape
  });

  const parent = asObject(payload.parent, "INVALID_PRUNED_PARENT");
  if (
    verifiedCheckpoint.checkpoint.subject.crossingId !== parent.crossingId ||
    verifiedCheckpoint.checkpoint.subject.payloadAddress !==
      parent.payloadAddress
  ) {
    throw new Error("PRUNED_PARENT_CHECKPOINT_MISMATCH");
  }

  const action = asObject(
    asObject(payload.action, "INVALID_PRUNED_ACTION").receipt,
    "INVALID_PRUNED_ACTION_RECEIPT"
  );
  const response = asObject(
    payload.action.responseTrace,
    "INVALID_PRUNED_RESPONSE_TRACE"
  );
  const directLineage = asObject(
    payload.directLineage,
    "INVALID_PRUNED_DIRECT_LINEAGE"
  );
  const tenet = normalizeTenet(payload.tenet, action.actorId);

  const linked = verifyDirectRelation({
    parent,
    action,
    response,
    directLineage,
    tenet
  });

  const crossing = asObject(
    descendantCrossing,
    "INVALID_PRUNED_DESCENDANT_CROSSING"
  );
  if (
    !Array.isArray(crossing.parents) ||
    crossing.parents.length !== 1 ||
    crossing.parents[0] !== parent.crossingId
  ) {
    throw new Error("PRUNED_DESCENDANT_PARENT_MISMATCH");
  }

  const ref = Array.isArray(crossing.payload_refs)
    ? crossing.payload_refs.find(
        (entry) =>
          entry?.address === address &&
          entry?.media_type === GRO_PRUNED_DESCENDANT_MEDIA_TYPE
      )
    : null;
  if (!ref) {
    throw new Error("PRUNED_DESCENDANT_CROSSING_DOES_NOT_BIND_PAYLOAD");
  }

  if (typeof verifyRelatteLineage !== "function") {
    throw new Error("RELATTE_LINEAGE_VERIFIER_REQUIRED");
  }
  if (
    (await verifyRelatteLineage({
      ancestor_crossing: linked.parentCrossing,
      admitted_receipt: linked.admission,
      field_projection: linked.field,
      uptake: linked.uptake,
      descendant_crossing: crossing
    })) !== true
  ) {
    throw new Error("PRUNED_DIRECT_LINEAGE_VERIFICATION_FAILED");
  }

  return {
    address,
    payload,
    lineageVerified: true,
    lineageMode: "checkpointed-resumable",
    generation: Number(verifiedCheckpoint.checkpoint.generation) + 1,
    inheritedLineageRoot: verifiedCheckpoint.checkpoint.lineageRoot
  };
}

export function localizePrunedDescendantWorldSeed({
  verifiedSeed,
  descendantCrossing,
  dispositionReceipt,
  destination,
  localRules = {}
}) {
  const verified = asObject(
    verifiedSeed,
    "INVALID_VERIFIED_PRUNED_DESCENDANT"
  );
  if (
    verified.lineageVerified !== true ||
    verified.lineageMode !== "checkpointed-resumable"
  ) {
    throw new Error("PRUNED_DESCENDANT_LINEAGE_NOT_VERIFIED");
  }

  const payload = asObject(
    verified.payload,
    "INVALID_VERIFIED_PRUNED_PAYLOAD"
  );
  const crossing = asObject(
    descendantCrossing,
    "INVALID_PRUNED_DESCENDANT_CROSSING"
  );
  const receipt = asObject(
    dispositionReceipt,
    "INVALID_PRUNED_DESCENDANT_ADMISSION"
  );
  const dest = asObject(destination, "INVALID_PRUNED_DESTINATION");

  if (
    receipt.kind !== "R3_ADMIT" ||
    receipt.crossing_id !== crossing.crossing_id ||
    receipt.world_id !== dest.worldId
  ) {
    throw new Error("PRUNED_DESCENDANT_NOT_LOCALLY_ADMITTED");
  }

  const sourceTenet = asObject(
    payload.tenet,
    "INVALID_PRUNED_DESCENDANT_TENET"
  );
  const localBody = {
    crossingId: crossing.crossing_id,
    payloadAddress: verified.address,
    destinationWorld: dest.worldId,
    destinationPlace: dest.placeId,
    receiverParticular: receipt.receiver_particular,
    label: localRules.label ?? sourceTenet.label,
    offeredActionLabel:
      localRules.offeredActionLabel ?? sourceTenet.offeredActionLabel,
    requiredHeldKind:
      Object.prototype.hasOwnProperty.call(localRules, "requiredHeldKind")
        ? localRules.requiredHeldKind
        : sourceTenet.requiredHeldKind ?? null
  };
  const digest = sha256(Buffer.from(stableStringify(localBody), "utf8"));

  return {
    schema: "gro.trace.v0",
    traceId: `trace:${digest.slice(0, 20)}`,
    receiptId: nonEmpty(
      receipt.receipt_id,
      "INVALID_PRUNED_DESCENDANT_ADMISSION_ID"
    ),
    placeId: dest.placeId,
    sourceActorId: receipt.receiver_particular,
    kind: "tenet",
    tags: ["tenet", "imported-tenet", "pruned-descendant-tenet"],
    authority: "invitation-only",
    tenet: {
      tenetId: `tenet:pruned:${digest.slice(0, 20)}`,
      seedId: sourceTenet.seedId,
      label: localBody.label,
      offeredActionLabel: localBody.offeredActionLabel,
      requiredHeldKind: localBody.requiredHeldKind,
      authorId: sourceTenet.authorId,
      authorControl: false,
      dispositions: ["notice", "hold", "ignore", "act-through"]
    },
    lineage: {
      parentCrossingId: payload.parent.crossingId,
      parentPayloadAddress: payload.parent.payloadAddress,
      descendantCrossingId: crossing.crossing_id,
      descendantPayloadAddress: verified.address,
      inheritedLineageRoot: verified.inheritedLineageRoot,
      generation: verified.generation,
      lineageMode: verified.lineageMode,
      ancestryAuthority: false
    }
  };
}
