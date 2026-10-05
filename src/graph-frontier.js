import { createHash } from "node:crypto";

import { makeReceipt, verifyOccurrenceReceipt } from "./receipt.js";
import { stableStringify } from "./stable.js";

export const GRO_GRAPH_FRONTIER_CHECKPOINT_MEDIA_TYPE =
  "application/vnd.gro.graph-frontier-checkpoint+json";
export const GRO_FRONTIER_DESCENDANT_MEDIA_TYPE =
  "application/vnd.gro.frontier-descendant-world-seed+json";

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

function requireAddress(value, code = "INVALID_GRAPH_FRONTIER_ADDRESS") {
  const address = nonEmpty(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(address)) throw new Error(code);
  return address;
}

function bytesOf(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  throw new Error("INVALID_GRAPH_FRONTIER_BYTES");
}

function normalizeTenet(value, actorId) {
  const tenet = asObject(value, "INVALID_FRONTIER_DESCENDANT_TENET");
  if (tenet.authorId !== actorId) {
    throw new Error("FRONTIER_DESCENDANT_AUTHOR_MUST_BE_ACTION_ACTOR");
  }
  if (tenet.authorControl !== false) {
    throw new Error("FRONTIER_DESCENDANT_AUTHOR_CONTROL_MUST_BE_FALSE");
  }

  return {
    seedId: nonEmpty(tenet.seedId, "INVALID_FRONTIER_DESCENDANT_SEED_ID"),
    label: nonEmpty(tenet.label, "INVALID_FRONTIER_DESCENDANT_LABEL"),
    offeredActionLabel: nonEmpty(
      tenet.offeredActionLabel,
      "INVALID_FRONTIER_DESCENDANT_ACTION_LABEL"
    ),
    requiredHeldKind: tenet.requiredHeldKind ?? null,
    authorId: actorId,
    authorControl: false,
    dispositions: ["notice", "hold", "ignore", "act-through"]
  };
}

function normalizeParentAnchors({
  recombinantPayload,
  verifiedParentCheckpoints
}) {
  const payload = asObject(
    recombinantPayload,
    "INVALID_GRAPH_FRONTIER_RECOMBINANT_PAYLOAD"
  );
  if (
    payload.schema !== "gro.recombinant-world-seed.v1" ||
    !Array.isArray(payload.parents) ||
    payload.parents.length < 2
  ) {
    throw new Error("GRAPH_FRONTIER_REQUIRES_RECOMBINANT_PARENTS");
  }
  if (
    !Array.isArray(verifiedParentCheckpoints) ||
    verifiedParentCheckpoints.length !== payload.parents.length
  ) {
    throw new Error("GRAPH_FRONTIER_REQUIRES_VERIFIED_PARENT_CHECKPOINTS");
  }

  const verifiedById = new Map();
  for (const raw of verifiedParentCheckpoints) {
    const verified = asObject(raw, "INVALID_VERIFIED_PARENT_CHECKPOINT");
    if (
      verified.checkpointVerified !== true ||
      verified.successionVerified !== true
    ) {
      throw new Error("GRAPH_FRONTIER_PARENT_CHECKPOINT_NOT_VERIFIED");
    }

    const checkpoint = asObject(
      verified.checkpoint,
      "INVALID_PARENT_CHECKPOINT_BODY"
    );
    const id = nonEmpty(
      checkpoint.checkpointId,
      "INVALID_PARENT_CHECKPOINT_ID"
    );
    if (verifiedById.has(id)) {
      throw new Error("DUPLICATE_PARENT_CHECKPOINT");
    }
    verifiedById.set(id, verified);
  }

  const anchors = payload.parents.map((parentValue) => {
    const parent = asObject(parentValue, "INVALID_RECOMBINANT_PARENT");
    const checkpointId = nonEmpty(
      parent.checkpointId,
      "INVALID_RECOMBINANT_PARENT_CHECKPOINT_ID"
    );
    const verified = verifiedById.get(checkpointId);
    if (!verified) throw new Error("MISSING_VERIFIED_PARENT_CHECKPOINT");

    const checkpoint = verified.checkpoint;
    const checkpointCrossing = asObject(
      verified.checkpointCrossing,
      "INVALID_PARENT_CHECKPOINT_CROSSING"
    );

    if (
      requireAddress(verified.address, "INVALID_PARENT_CHECKPOINT_ADDRESS") !==
        requireAddress(parent.checkpointAddress) ||
      checkpointCrossing.crossing_id !== parent.checkpointCrossingId ||
      checkpoint.lineageRoot !== parent.lineageRoot ||
      checkpoint.subject.crossingId !== parent.subject.crossingId ||
      checkpoint.subject.payloadAddress !== parent.subject.payloadAddress
    ) {
      throw new Error("PARENT_CHECKPOINT_ANCHOR_MISMATCH");
    }

    return {
      checkpointId,
      checkpointAddress: parent.checkpointAddress,
      checkpointCrossingId: parent.checkpointCrossingId,
      lineageRoot: parent.lineageRoot,
      generation: Number(checkpoint.generation),
      subjectCrossingId: parent.subject.crossingId,
      subjectPayloadAddress: parent.subject.payloadAddress
    };
  });

  return anchors.sort((a, b) =>
    a.checkpointId.localeCompare(b.checkpointId)
  );
}

function frontierRootBody(anchors) {
  return anchors.map((anchor) => ({
    checkpointId: anchor.checkpointId,
    checkpointAddress: anchor.checkpointAddress,
    checkpointCrossingId: anchor.checkpointCrossingId,
    lineageRoot: anchor.lineageRoot,
    generation: anchor.generation,
    subjectCrossingId: anchor.subjectCrossingId,
    subjectPayloadAddress: anchor.subjectPayloadAddress
  }));
}

function graphRootBody(body) {
  return {
    subject: body.subject,
    parentFrontierRoot: body.parentFrontierRoot,
    parentFrontier: body.parentFrontier,
    verification: body.verification,
    localReceiptSetRoot: body.localReceiptSetCommitment.receipt_set_root
  };
}

function checkpointIdentityBody(body) {
  return {
    schema: "gro.graph-frontier-checkpoint.v0",
    checkpointWorldId: body.checkpointWorldId,
    subject: body.subject,
    parentFrontierRoot: body.parentFrontierRoot,
    parentFrontier: body.parentFrontier,
    verification: body.verification,
    localReceiptSetCommitment: body.localReceiptSetCommitment,
    graphRoot: body.graphRoot,
    createdAt: body.createdAt,
    semanticEffect: "none",
    authority: null,
    laws: body.laws
  };
}

export function createGraphFrontierCheckpoint({
  verifiedRecombination,
  subjectCrossing,
  verifiedParentCheckpoints,
  localReceiptSetCommitment,
  checkpointWorldId,
  createdAt
}) {
  const verified = asObject(
    verifiedRecombination,
    "INVALID_VERIFIED_RECOMBINATION"
  );
  if (verified.recombinationVerified !== true) {
    throw new Error("FULL_RECOMBINATION_VERIFICATION_REQUIRED_BEFORE_FRONTIER");
  }

  const payload = asObject(
    verified.payload,
    "INVALID_VERIFIED_RECOMBINATION_PAYLOAD"
  );
  const crossing = asObject(
    subjectCrossing,
    "INVALID_GRAPH_FRONTIER_SUBJECT_CROSSING"
  );
  const subjectAddress = requireAddress(
    verified.address,
    "INVALID_GRAPH_FRONTIER_SUBJECT_ADDRESS"
  );

  const bound = Array.isArray(crossing.payload_refs)
    ? crossing.payload_refs.some((entry) => entry?.address === subjectAddress)
    : false;
  if (!bound) throw new Error("GRAPH_FRONTIER_SUBJECT_NOT_BOUND");

  const expectedParents = payload.parents
    .map((parent) => parent.subject.crossingId)
    .sort();
  if (
    stableStringify([...(crossing.parents ?? [])].sort()) !==
    stableStringify(expectedParents)
  ) {
    throw new Error("GRAPH_FRONTIER_SUBJECT_PARENT_MISMATCH");
  }

  const anchors = normalizeParentAnchors({
    recombinantPayload: payload,
    verifiedParentCheckpoints
  });
  const frontierRoot = `gro-frontier-root-v0:${sha256(
    Buffer.from(stableStringify(frontierRootBody(anchors)), "utf8")
  )}`;

  const commitment = asObject(
    localReceiptSetCommitment,
    "INVALID_GRAPH_FRONTIER_RECEIPT_SET_COMMITMENT"
  );
  if (commitment.schema !== "relatte.receipt-set-commitment/v0") {
    throw new Error("INVALID_GRAPH_FRONTIER_RECEIPT_SET_COMMITMENT");
  }
  if (commitment.world_id !== checkpointWorldId) {
    throw new Error("GRAPH_FRONTIER_WORLD_COMMITMENT_MISMATCH");
  }

  const actionReceipt = asObject(
    asObject(payload.action, "INVALID_RECOMBINATION_ACTION").receipt,
    "INVALID_RECOMBINATION_ACTION_RECEIPT"
  );

  const body = {
    schema: "gro.graph-frontier-checkpoint.v0",
    checkpointWorldId: nonEmpty(
      checkpointWorldId,
      "INVALID_GRAPH_FRONTIER_WORLD"
    ),
    subject: {
      crossingId: nonEmpty(
        crossing.crossing_id,
        "INVALID_GRAPH_FRONTIER_SUBJECT_CROSSING_ID"
      ),
      payloadAddress: subjectAddress
    },
    parentFrontierRoot: frontierRoot,
    parentFrontier: anchors,
    verification: {
      mode: "multi-parent-full-before-prune",
      forkId: nonEmpty(payload.fork?.forkId, "INVALID_GRAPH_FRONTIER_FORK_ID"),
      recombinationActionReceiptId: nonEmpty(
        actionReceipt.receiptId,
        "INVALID_GRAPH_FRONTIER_ACTION_RECEIPT_ID"
      ),
      evidenceAddress: subjectAddress
    },
    localReceiptSetCommitment: structuredClone(commitment),
    graphRoot: null,
    createdAt: nonEmpty(createdAt, "INVALID_GRAPH_FRONTIER_CREATED_AT"),
    semanticEffect: "none",
    authority: null,
    laws: [
      "FRONTIER != HISTORY",
      "FRONTIER ROOT != AUTHORITY",
      "MULTI-PARENT ROOT != CANON",
      "FULL PARENT VERIFICATION PRECEDES FRONTIER PRUNING",
      "PARENT CHECKPOINT ANCHOR != PARENT CHECKPOINT BODY",
      "REHYDRATION MAY RECHECK PARENT HISTORY"
    ]
  };

  body.graphRoot = `gro-graph-root-v0:${sha256(
    Buffer.from(stableStringify(graphRootBody(body)), "utf8")
  )}`;

  return {
    ...body,
    checkpointId: `gro-graph-frontier-checkpoint-v0:${sha256(
      Buffer.from(stableStringify(checkpointIdentityBody(body)), "utf8")
    )}`
  };
}

export function addressGraphFrontierCheckpoint(checkpoint) {
  const text = stableStringify(checkpoint);
  const bytes = Buffer.from(text, "utf8");
  return {
    address: `sha256:${sha256(bytes)}`,
    bytes
  };
}

export function makeGraphFrontierCheckpointDraft({
  checkpoint,
  checkpointAddress,
  sourceParticular,
  createdAt
}) {
  const body = asObject(checkpoint, "INVALID_GRAPH_FRONTIER_CHECKPOINT");
  if (body.schema !== "gro.graph-frontier-checkpoint.v0") {
    throw new Error("INVALID_GRAPH_FRONTIER_CHECKPOINT_SCHEMA");
  }
  const address = requireAddress(
    checkpointAddress,
    "INVALID_GRAPH_FRONTIER_CHECKPOINT_ADDRESS"
  );

  const parents = [
    body.subject.crossingId,
    ...body.parentFrontier.map((anchor) => anchor.checkpointCrossingId)
  ].sort();

  return {
    schema: "relatte.crossing-envelope/v0",
    protocol_version: "0",
    source_particular: nonEmpty(
      sourceParticular,
      "INVALID_GRAPH_FRONTIER_SOURCE_PARTICULAR"
    ),
    source_world: nonEmpty(
      body.checkpointWorldId,
      "INVALID_GRAPH_FRONTIER_SOURCE_WORLD"
    ),
    source_history_head: nonEmpty(
      body.localReceiptSetCommitment.receipt_set_root,
      "INVALID_GRAPH_FRONTIER_HISTORY_ROOT"
    ),
    parents,
    declared_kind: "GRO_GRAPH_FRONTIER_CHECKPOINT",
    payload_refs: [
      {
        address,
        role: "graph-frontier-checkpoint",
        media_type: GRO_GRAPH_FRONTIER_CHECKPOINT_MEDIA_TYPE
      }
    ],
    requested_effect: null,
    capability_ref: null,
    privacy_policy: null,
    audience_policy: null,
    return_address: null,
    created_at: nonEmpty(
      createdAt,
      "INVALID_GRAPH_FRONTIER_CROSSING_CREATED_AT"
    ),
    extensions: {
      gro_graph_frontier: {
        checkpoint_id: body.checkpointId,
        graph_root: body.graphRoot,
        parent_frontier_root: body.parentFrontierRoot,
        parent_checkpoint_ids: body.parentFrontier
          .map((anchor) => anchor.checkpointId)
          .sort(),
        parent_lineage_roots: body.parentFrontier
          .map((anchor) => anchor.lineageRoot)
          .sort(),
        parent_count: body.parentFrontier.length,
        semantic_effect: "none",
        authority: null,
        laws: [
          "FRONTIER != HISTORY",
          "MULTI-PARENT ROOT != CANON",
          "GRAPH CHECKPOINT != AUTHORITY"
        ]
      }
    }
  };
}

export async function verifyGraphFrontierCheckpoint({
  bytes,
  expectedAddress,
  checkpointCrossing,
  verifyRelatteCrossing,
  verifyReceiptSetCommitmentShape
}) {
  const raw = bytesOf(bytes);
  const address = requireAddress(
    expectedAddress,
    "INVALID_GRAPH_FRONTIER_CHECKPOINT_ADDRESS"
  );
  if (`sha256:${sha256(raw)}` !== address) {
    throw new Error("GRAPH_FRONTIER_CHECKPOINT_ADDRESS_MISMATCH");
  }

  const text = raw.toString("utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("INVALID_GRAPH_FRONTIER_CHECKPOINT_JSON");
  }
  if (stableStringify(parsed) !== text) {
    throw new Error("GRAPH_FRONTIER_CHECKPOINT_NOT_CANONICAL");
  }

  const checkpoint = asObject(parsed, "INVALID_GRAPH_FRONTIER_CHECKPOINT");
  if (checkpoint.schema !== "gro.graph-frontier-checkpoint.v0") {
    throw new Error("INVALID_GRAPH_FRONTIER_CHECKPOINT_SCHEMA");
  }
  if (
    checkpoint.semanticEffect !== "none" ||
    checkpoint.authority !== null
  ) {
    throw new Error("GRAPH_FRONTIER_AUTHORITY_ESCALATION");
  }

  if (!Array.isArray(checkpoint.parentFrontier) || checkpoint.parentFrontier.length < 2) {
    throw new Error("GRAPH_FRONTIER_REQUIRES_MULTIPLE_PARENTS");
  }

  const normalizedFrontier = checkpoint.parentFrontier
    .map((anchorValue) => {
      const anchor = asObject(anchorValue, "INVALID_GRAPH_FRONTIER_ANCHOR");
      return {
        checkpointId: nonEmpty(anchor.checkpointId, "INVALID_FRONTIER_CHECKPOINT_ID"),
        checkpointAddress: requireAddress(
          anchor.checkpointAddress,
          "INVALID_FRONTIER_CHECKPOINT_ADDRESS"
        ),
        checkpointCrossingId: nonEmpty(
          anchor.checkpointCrossingId,
          "INVALID_FRONTIER_CHECKPOINT_CROSSING_ID"
        ),
        lineageRoot: nonEmpty(anchor.lineageRoot, "INVALID_FRONTIER_LINEAGE_ROOT"),
        generation: Number(anchor.generation),
        subjectCrossingId: nonEmpty(
          anchor.subjectCrossingId,
          "INVALID_FRONTIER_SUBJECT_CROSSING_ID"
        ),
        subjectPayloadAddress: requireAddress(
          anchor.subjectPayloadAddress,
          "INVALID_FRONTIER_SUBJECT_PAYLOAD_ADDRESS"
        )
      };
    })
    .sort((a, b) => a.checkpointId.localeCompare(b.checkpointId));

  if (
    stableStringify(normalizedFrontier) !==
    stableStringify(checkpoint.parentFrontier)
  ) {
    throw new Error("GRAPH_FRONTIER_NOT_CANONICALLY_ORDERED");
  }

  const expectedFrontierRoot = `gro-frontier-root-v0:${sha256(
    Buffer.from(stableStringify(frontierRootBody(normalizedFrontier)), "utf8")
  )}`;
  if (checkpoint.parentFrontierRoot !== expectedFrontierRoot) {
    throw new Error("GRAPH_FRONTIER_ROOT_MISMATCH");
  }

  const expectedGraphRoot = `gro-graph-root-v0:${sha256(
    Buffer.from(stableStringify(graphRootBody(checkpoint)), "utf8")
  )}`;
  if (checkpoint.graphRoot !== expectedGraphRoot) {
    throw new Error("GRAPH_ROOT_MISMATCH");
  }

  const expectedCheckpointId =
    `gro-graph-frontier-checkpoint-v0:${sha256(
      Buffer.from(stableStringify(checkpointIdentityBody(checkpoint)), "utf8")
    )}`;
  if (checkpoint.checkpointId !== expectedCheckpointId) {
    throw new Error("GRAPH_FRONTIER_CHECKPOINT_ID_MISMATCH");
  }

  if (typeof verifyReceiptSetCommitmentShape !== "function") {
    throw new Error("RECEIPT_SET_COMMITMENT_VERIFIER_REQUIRED");
  }
  if (
    verifyReceiptSetCommitmentShape(
      checkpoint.localReceiptSetCommitment
    ) !== true
  ) {
    throw new Error("INVALID_GRAPH_FRONTIER_RECEIPT_SET_COMMITMENT");
  }

  const crossing = asObject(
    checkpointCrossing,
    "INVALID_GRAPH_FRONTIER_CROSSING"
  );
  if (typeof verifyRelatteCrossing !== "function") {
    throw new Error("RELATTE_CROSSING_VERIFIER_REQUIRED");
  }
  if ((await verifyRelatteCrossing(crossing)) !== true) {
    throw new Error("INVALID_GRAPH_FRONTIER_CROSSING");
  }

  const expectedParents = [
    checkpoint.subject.crossingId,
    ...normalizedFrontier.map((anchor) => anchor.checkpointCrossingId)
  ].sort();
  if (
    crossing.source_world !== checkpoint.checkpointWorldId ||
    stableStringify([...(crossing.parents ?? [])].sort()) !==
      stableStringify(expectedParents)
  ) {
    throw new Error("GRAPH_FRONTIER_CROSSING_RELATION_MISMATCH");
  }

  const ref = Array.isArray(crossing.payload_refs)
    ? crossing.payload_refs.find(
        (entry) =>
          entry?.address === address &&
          entry?.role === "graph-frontier-checkpoint" &&
          entry?.media_type === GRO_GRAPH_FRONTIER_CHECKPOINT_MEDIA_TYPE
      )
    : null;
  if (!ref) throw new Error("GRAPH_FRONTIER_CROSSING_DOES_NOT_BIND_BODY");

  const ext = asObject(
    asObject(crossing.extensions, "INVALID_GRAPH_FRONTIER_EXTENSIONS")
      .gro_graph_frontier,
    "INVALID_GRAPH_FRONTIER_EXTENSION"
  );
  if (
    ext.checkpoint_id !== checkpoint.checkpointId ||
    ext.graph_root !== checkpoint.graphRoot ||
    ext.parent_frontier_root !== checkpoint.parentFrontierRoot ||
    ext.parent_count !== checkpoint.parentFrontier.length ||
    ext.semantic_effect !== "none" ||
    ext.authority !== null ||
    stableStringify(ext.parent_checkpoint_ids) !==
      stableStringify(
        normalizedFrontier.map((anchor) => anchor.checkpointId).sort()
      ) ||
    stableStringify(ext.parent_lineage_roots) !==
      stableStringify(
        normalizedFrontier.map((anchor) => anchor.lineageRoot).sort()
      )
  ) {
    throw new Error("GRAPH_FRONTIER_EXTENSION_MISMATCH");
  }

  return {
    address,
    checkpoint,
    checkpointCrossing: crossing,
    graphFrontierVerified: true,
    parentCount: checkpoint.parentFrontier.length,
    frontierMode: "bounded-multi-parent-resumable"
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
    "INVALID_FRONTIER_PARENT_CROSSING"
  );
  const admission = asObject(
    directLineage.parentAdmissionReceipt,
    "INVALID_FRONTIER_PARENT_ADMISSION"
  );
  const field = asObject(
    directLineage.fieldProjection,
    "INVALID_FRONTIER_FIELD"
  );
  const uptake = asObject(
    directLineage.uptake,
    "INVALID_FRONTIER_UPTAKE"
  );

  if (
    parentCrossing.crossing_id !== parent.crossingId ||
    admission.receipt_id !== parent.localAdmissionReceiptId ||
    admission.crossing_id !== parent.crossingId ||
    uptake.ancestor_crossing_id !== parent.crossingId ||
    uptake.admitted_receipt_id !== admission.receipt_id ||
    uptake.field_projection_id !== field.projection_id ||
    uptake.field_history_root !== field.history_root
  ) {
    throw new Error("FRONTIER_DIRECT_RELATION_MISMATCH");
  }

  if (
    !verifyOccurrenceReceipt(action) ||
    action.action !== "act-through-tenet" ||
    !action.inputs.includes(admission.receipt_id)
  ) {
    throw new Error("INVALID_FRONTIER_DESCENDANT_ACTION");
  }
  if (
    response.kind !== "tenet-response" ||
    response.receiptId !== action.receiptId ||
    response.relatedTenetTraceId !== parent.localTraceId ||
    response.sourceActorId !== action.actorId
  ) {
    throw new Error("INVALID_FRONTIER_DESCENDANT_RESPONSE");
  }
  if (tenet.authorId !== action.actorId) {
    throw new Error("FRONTIER_DESCENDANT_TENET_ACTOR_MISMATCH");
  }

  return { parentCrossing, admission, field, uptake };
}

export function makeFrontierDescendantWorldSeed({
  parentLocalTrace,
  actionReceipt,
  actionResponseTrace,
  descendantTenet,
  directLineageEvidence,
  ancestryFrontier
}) {
  const parentTrace = asObject(
    parentLocalTrace,
    "INVALID_FRONTIER_PARENT_LOCAL_TRACE"
  );
  const parentLineage = asObject(
    parentTrace.lineage,
    "FRONTIER_PARENT_TRACE_MISSING_LINEAGE"
  );
  const parent = {
    crossingId: nonEmpty(
      parentLineage.recombinantCrossingId,
      "INVALID_FRONTIER_PARENT_CROSSING_ID"
    ),
    payloadAddress: requireAddress(
      parentLineage.recombinantPayloadAddress,
      "INVALID_FRONTIER_PARENT_PAYLOAD_ADDRESS"
    ),
    localTraceId: nonEmpty(
      parentTrace.traceId,
      "INVALID_FRONTIER_PARENT_TRACE_ID"
    ),
    localAdmissionReceiptId: nonEmpty(
      parentTrace.receiptId,
      "INVALID_FRONTIER_PARENT_ADMISSION_ID"
    )
  };

  const frontier = asObject(
    ancestryFrontier,
    "INVALID_ANCESTRY_GRAPH_FRONTIER"
  );
  if (frontier.graphFrontierVerified !== true) {
    throw new Error("VERIFIED_GRAPH_FRONTIER_REQUIRED");
  }
  if (
    frontier.checkpoint.subject.crossingId !== parent.crossingId ||
    frontier.checkpoint.subject.payloadAddress !== parent.payloadAddress
  ) {
    throw new Error("GRAPH_FRONTIER_PARENT_MISMATCH");
  }

  const action = asObject(
    actionReceipt,
    "INVALID_FRONTIER_DESCENDANT_ACTION_RECEIPT"
  );
  const response = asObject(
    actionResponseTrace,
    "INVALID_FRONTIER_DESCENDANT_RESPONSE_TRACE"
  );
  const directLineage = asObject(
    directLineageEvidence,
    "INVALID_FRONTIER_DIRECT_LINEAGE"
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
    schema: "gro.frontier-descendant-world-seed.v1",
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
    ancestryFrontier: {
      address: frontier.address,
      checkpoint: structuredClone(frontier.checkpoint),
      checkpointCrossing: structuredClone(frontier.checkpointCrossing)
    },
    tenet,
    laws: [
      "DIRECT RELATION VERIFIED, EARLIER GRAPH CHECKPOINTED",
      "FRONTIER != HISTORY",
      "MULTI-PARENT ROOT != AUTHORITY",
      "GRAPH PRUNING != GRAPH ERASURE"
    ]
  };
}

export function addressFrontierDescendantWorldSeed(value) {
  const text = stableStringify(value);
  const bytes = Buffer.from(text, "utf8");
  return {
    address: `sha256:${sha256(bytes)}`,
    bytes
  };
}

export async function verifyFrontierDescendantWorldSeed({
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
    "INVALID_FRONTIER_DESCENDANT_ADDRESS"
  );
  if (`sha256:${sha256(raw)}` !== address) {
    throw new Error("FRONTIER_DESCENDANT_ADDRESS_MISMATCH");
  }

  const text = raw.toString("utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("INVALID_FRONTIER_DESCENDANT_JSON");
  }
  if (stableStringify(parsed) !== text) {
    throw new Error("FRONTIER_DESCENDANT_NOT_CANONICAL");
  }

  const payload = asObject(parsed, "INVALID_FRONTIER_DESCENDANT_PAYLOAD");
  if (payload.schema !== "gro.frontier-descendant-world-seed.v1") {
    throw new Error("INVALID_FRONTIER_DESCENDANT_SCHEMA");
  }

  const inherited = asObject(
    payload.ancestryFrontier,
    "INVALID_FRONTIER_DESCENDANT_ANCESTRY"
  );
  const verifiedFrontier = await verifyGraphFrontierCheckpoint({
    bytes: Buffer.from(stableStringify(inherited.checkpoint), "utf8"),
    expectedAddress: inherited.address,
    checkpointCrossing: inherited.checkpointCrossing,
    verifyRelatteCrossing,
    verifyReceiptSetCommitmentShape
  });

  const parent = asObject(payload.parent, "INVALID_FRONTIER_PARENT");
  if (
    verifiedFrontier.checkpoint.subject.crossingId !== parent.crossingId ||
    verifiedFrontier.checkpoint.subject.payloadAddress !==
      parent.payloadAddress
  ) {
    throw new Error("FRONTIER_PARENT_CHECKPOINT_MISMATCH");
  }

  const action = asObject(
    asObject(payload.action, "INVALID_FRONTIER_ACTION").receipt,
    "INVALID_FRONTIER_ACTION_RECEIPT"
  );
  const response = asObject(
    payload.action.responseTrace,
    "INVALID_FRONTIER_RESPONSE_TRACE"
  );
  const directLineage = asObject(
    payload.directLineage,
    "INVALID_FRONTIER_DIRECT_LINEAGE"
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
    "INVALID_FRONTIER_DESCENDANT_CROSSING"
  );
  if (
    !Array.isArray(crossing.parents) ||
    crossing.parents.length !== 1 ||
    crossing.parents[0] !== parent.crossingId
  ) {
    throw new Error("FRONTIER_DESCENDANT_PARENT_MISMATCH");
  }

  const ref = Array.isArray(crossing.payload_refs)
    ? crossing.payload_refs.find(
        (entry) =>
          entry?.address === address &&
          entry?.media_type === GRO_FRONTIER_DESCENDANT_MEDIA_TYPE
      )
    : null;
  if (!ref) {
    throw new Error("FRONTIER_DESCENDANT_CROSSING_DOES_NOT_BIND_PAYLOAD");
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
    throw new Error("FRONTIER_DIRECT_LINEAGE_VERIFICATION_FAILED");
  }

  return {
    address,
    payload,
    lineageVerified: true,
    lineageMode: "graph-frontier-resumable",
    inheritedGraphRoot: verifiedFrontier.checkpoint.graphRoot,
    inheritedFrontierRoot: verifiedFrontier.checkpoint.parentFrontierRoot,
    frontierParentCount: verifiedFrontier.parentCount
  };
}

export function localizeFrontierDescendantWorldSeed({
  verifiedSeed,
  descendantCrossing,
  dispositionReceipt,
  destination,
  localRules = {}
}) {
  const verified = asObject(
    verifiedSeed,
    "INVALID_VERIFIED_FRONTIER_DESCENDANT"
  );
  if (
    verified.lineageVerified !== true ||
    verified.lineageMode !== "graph-frontier-resumable"
  ) {
    throw new Error("FRONTIER_DESCENDANT_LINEAGE_NOT_VERIFIED");
  }

  const payload = asObject(
    verified.payload,
    "INVALID_VERIFIED_FRONTIER_PAYLOAD"
  );
  const crossing = asObject(
    descendantCrossing,
    "INVALID_FRONTIER_DESCENDANT_CROSSING"
  );
  const receipt = asObject(
    dispositionReceipt,
    "INVALID_FRONTIER_DESCENDANT_ADMISSION"
  );
  const dest = asObject(destination, "INVALID_FRONTIER_DESTINATION");

  if (
    receipt.kind !== "R3_ADMIT" ||
    receipt.crossing_id !== crossing.crossing_id ||
    receipt.world_id !== dest.worldId
  ) {
    throw new Error("FRONTIER_DESCENDANT_NOT_LOCALLY_ADMITTED");
  }

  const sourceTenet = payload.tenet;
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
    receiptId: receipt.receipt_id,
    placeId: dest.placeId,
    sourceActorId: receipt.receiver_particular,
    kind: "tenet",
    tags: ["tenet", "imported-tenet", "frontier-descendant-tenet"],
    authority: "invitation-only",
    tenet: {
      tenetId: `tenet:frontier:${digest.slice(0, 20)}`,
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
      inheritedGraphRoot: verified.inheritedGraphRoot,
      inheritedFrontierRoot: verified.inheritedFrontierRoot,
      frontierParentCount: verified.frontierParentCount,
      lineageMode: verified.lineageMode,
      ancestryAuthority: false
    }
  };
}
