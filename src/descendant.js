import { createHash } from "node:crypto";

import { verifyOccurrenceReceipt } from "./receipt.js";
import { stableStringify } from "./stable.js";

export const GRO_DESCENDANT_MEDIA_TYPE =
  "application/vnd.gro.descendant-world-seed+json";

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

function requireAddress(value, code = "INVALID_DESCENDANT_ADDRESS") {
  const address = nonEmpty(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(address)) throw new Error(code);
  return address;
}

function bytesOf(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  throw new Error("INVALID_DESCENDANT_BYTES");
}

function normalizeTenet(value, actorId) {
  const tenet = asObject(value, "INVALID_DESCENDANT_TENET");
  if (tenet.authorControl !== false) {
    throw new Error("DESCENDANT_AUTHOR_CONTROL_MUST_BE_FALSE");
  }
  if (tenet.authorId !== actorId) {
    throw new Error("DESCENDANT_AUTHOR_MUST_BE_ACTION_ACTOR");
  }

  return {
    seedId: nonEmpty(tenet.seedId, "INVALID_DESCENDANT_SEED_ID"),
    label: nonEmpty(tenet.label, "INVALID_DESCENDANT_LABEL"),
    offeredActionLabel: nonEmpty(
      tenet.offeredActionLabel,
      "INVALID_DESCENDANT_ACTION_LABEL"
    ),
    requiredHeldKind: tenet.requiredHeldKind ?? null,
    authorId: actorId,
    authorControl: false,
    dispositions: ["notice", "hold", "ignore", "act-through"]
  };
}

function verifyEvidenceLinks({
  ancestor,
  action,
  response,
  evidence,
  descendantTenet
}) {
  const ancestorCrossing = asObject(
    evidence.ancestorCrossing,
    "INVALID_ANCESTOR_CROSSING"
  );
  const admission = asObject(
    evidence.ancestorAdmissionReceipt,
    "INVALID_ANCESTOR_ADMISSION"
  );
  const field = asObject(
    evidence.fieldProjection,
    "INVALID_LINEAGE_FIELD"
  );
  const uptake = asObject(evidence.uptake, "INVALID_LINEAGE_UPTAKE");

  if (ancestorCrossing.crossing_id !== ancestor.crossingId) {
    throw new Error("ANCESTOR_CROSSING_ID_MISMATCH");
  }
  if (admission.receipt_id !== ancestor.localAdmissionReceiptId) {
    throw new Error("ANCESTOR_ADMISSION_ID_MISMATCH");
  }
  if (admission.crossing_id !== ancestor.crossingId) {
    throw new Error("ANCESTOR_ADMISSION_CROSSING_MISMATCH");
  }
  if (uptake.ancestor_crossing_id !== ancestor.crossingId) {
    throw new Error("UPTAKE_ANCESTOR_MISMATCH");
  }
  if (uptake.admitted_receipt_id !== admission.receipt_id) {
    throw new Error("UPTAKE_ADMISSION_MISMATCH");
  }
  if (uptake.field_projection_id !== field.projection_id) {
    throw new Error("UPTAKE_FIELD_PROJECTION_MISMATCH");
  }
  if (uptake.field_history_root !== field.history_root) {
    throw new Error("UPTAKE_FIELD_HISTORY_MISMATCH");
  }

  const payloadRef = Array.isArray(ancestorCrossing.payload_refs)
    ? ancestorCrossing.payload_refs.find(
        (entry) => entry?.address === ancestor.payloadAddress
      )
    : null;
  if (!payloadRef) {
    throw new Error("ANCESTOR_PAYLOAD_ADDRESS_NOT_BOUND");
  }

  if (!verifyOccurrenceReceipt(action)) {
    throw new Error("INVALID_DESCENDANT_ACTION_RECEIPT");
  }
  if (action.action !== "act-through-tenet") {
    throw new Error("DESCENDANT_REQUIRES_ACT_THROUGH_TENET");
  }
  if (!action.inputs.includes(admission.receipt_id)) {
    throw new Error("DESCENDANT_ACTION_NOT_LINKED_TO_ADMISSION");
  }

  if (response.kind !== "tenet-response") {
    throw new Error("INVALID_DESCENDANT_RESPONSE_TRACE");
  }
  if (response.receiptId !== action.receiptId) {
    throw new Error("DESCENDANT_RESPONSE_RECEIPT_MISMATCH");
  }
  if (response.relatedTenetTraceId !== ancestor.localTraceId) {
    throw new Error("DESCENDANT_RESPONSE_ANCESTOR_TRACE_MISMATCH");
  }
  if (response.sourceActorId !== action.actorId) {
    throw new Error("DESCENDANT_RESPONSE_ACTOR_MISMATCH");
  }

  if (descendantTenet.authorId !== action.actorId) {
    throw new Error("DESCENDANT_TENET_ACTOR_MISMATCH");
  }

  return { ancestorCrossing, admission, field, uptake };
}

export function makeDescendantWorldSeed({
  ancestorPayloadAddress,
  ancestorLocalTrace,
  actionReceipt,
  actionResponseTrace,
  descendantTenet,
  lineageEvidence
}) {
  const ancestorTrace = asObject(
    ancestorLocalTrace,
    "INVALID_ANCESTOR_LOCAL_TRACE"
  );
  if (ancestorTrace.kind !== "tenet") {
    throw new Error("ANCESTOR_LOCAL_TRACE_NOT_TENET");
  }
  if (ancestorTrace.authority !== "invitation-only") {
    throw new Error("ANCESTOR_LOCAL_TRACE_AUTHORITY_ESCALATION");
  }

  const crossing = asObject(
    ancestorTrace.crossing,
    "ANCESTOR_LOCAL_TRACE_MISSING_CROSSING"
  );
  const ancestorAddress = requireAddress(ancestorPayloadAddress);
  if (crossing.payloadAddress !== ancestorAddress) {
    throw new Error("ANCESTOR_LOCAL_TRACE_ADDRESS_MISMATCH");
  }

  const action = asObject(actionReceipt, "INVALID_DESCENDANT_ACTION_RECEIPT");
  const response = asObject(
    actionResponseTrace,
    "INVALID_DESCENDANT_RESPONSE_TRACE"
  );
  const evidence = asObject(lineageEvidence, "INVALID_LINEAGE_EVIDENCE");

  const tenet = normalizeTenet(descendantTenet, action.actorId);

  const ancestor = {
    payloadAddress: ancestorAddress,
    crossingId: nonEmpty(
      crossing.crossingId,
      "INVALID_ANCESTOR_CROSSING_ID"
    ),
    localTraceId: nonEmpty(
      ancestorTrace.traceId,
      "INVALID_ANCESTOR_LOCAL_TRACE_ID"
    ),
    localAdmissionReceiptId: nonEmpty(
      ancestorTrace.receiptId,
      "INVALID_ANCESTOR_ADMISSION_RECEIPT_ID"
    )
  };

  verifyEvidenceLinks({
    ancestor,
    action,
    response,
    evidence,
    descendantTenet: tenet
  });

  return {
    schema: "gro.descendant-world-seed.v1",
    ancestor,
    action: {
      receipt: structuredClone(action),
      responseTrace: structuredClone(response)
    },
    lineage: {
      ancestorCrossing: structuredClone(evidence.ancestorCrossing),
      ancestorAdmissionReceipt: structuredClone(
        evidence.ancestorAdmissionReceipt
      ),
      fieldProjection: structuredClone(evidence.fieldProjection),
      uptake: structuredClone(evidence.uptake)
    },
    tenet,
    laws: [
      "DESCENDANT != ANCESTOR",
      "ANCESTRY != AUTHORITY",
      "LINEAGE != CENTRAL REGISTRY",
      "ACTION != INHERITED AUTHORITY",
      "ANCESTOR PAYLOAD != DESCENDANT PAYLOAD"
    ]
  };
}

export function addressDescendantWorldSeed(value) {
  const text = stableStringify(value);
  const bytes = Buffer.from(text, "utf8");
  return {
    address: `sha256:${sha256(bytes)}`,
    bytes
  };
}

export async function verifyDescendantWorldSeed({
  bytes,
  expectedAddress,
  descendantCrossing,
  verifyRelatteLineage
}) {
  const raw = bytesOf(bytes);
  const address = requireAddress(expectedAddress);
  const actual = `sha256:${sha256(raw)}`;
  if (actual !== address) {
    throw new Error("DESCENDANT_PAYLOAD_ADDRESS_MISMATCH");
  }

  const text = raw.toString("utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("INVALID_DESCENDANT_PAYLOAD_JSON");
  }
  if (stableStringify(parsed) !== text) {
    throw new Error("DESCENDANT_PAYLOAD_NOT_CANONICAL");
  }

  const payload = asObject(parsed, "INVALID_DESCENDANT_PAYLOAD");
  if (payload.schema !== "gro.descendant-world-seed.v1") {
    throw new Error("INVALID_DESCENDANT_PAYLOAD_SCHEMA");
  }

  const ancestor = asObject(payload.ancestor, "INVALID_DESCENDANT_ANCESTOR");
  const actionEnvelope = asObject(payload.action, "INVALID_DESCENDANT_ACTION");
  const action = asObject(
    actionEnvelope.receipt,
    "INVALID_DESCENDANT_ACTION_RECEIPT"
  );
  const response = asObject(
    actionEnvelope.responseTrace,
    "INVALID_DESCENDANT_RESPONSE_TRACE"
  );
  const evidence = asObject(payload.lineage, "INVALID_LINEAGE_EVIDENCE");
  const tenet = normalizeTenet(payload.tenet, action.actorId);

  const linked = verifyEvidenceLinks({
    ancestor,
    action,
    response,
    evidence,
    descendantTenet: tenet
  });

  const crossing = asObject(
    descendantCrossing,
    "INVALID_DESCENDANT_CROSSING"
  );
  if (!Array.isArray(crossing.parents) || crossing.parents.length !== 1) {
    throw new Error("DESCENDANT_REQUIRES_ONE_PARENT");
  }
  if (crossing.parents[0] !== ancestor.crossingId) {
    throw new Error("DESCENDANT_PARENT_MISMATCH");
  }

  const descendantRef = Array.isArray(crossing.payload_refs)
    ? crossing.payload_refs.find(
        (entry) =>
          entry?.address === address &&
          entry?.media_type === GRO_DESCENDANT_MEDIA_TYPE
      )
    : null;
  if (!descendantRef) {
    throw new Error("DESCENDANT_CROSSING_DOES_NOT_BIND_PAYLOAD");
  }

  if (typeof verifyRelatteLineage !== "function") {
    throw new Error("RELATTE_LINEAGE_VERIFIER_REQUIRED");
  }

  const lineageVerified = await verifyRelatteLineage({
    ancestor_crossing: linked.ancestorCrossing,
    admitted_receipt: linked.admission,
    field_projection: linked.field,
    uptake: linked.uptake,
    descendant_crossing: crossing
  });
  if (lineageVerified !== true) {
    throw new Error("RELATTE_LINEAGE_VERIFICATION_FAILED");
  }

  return {
    address,
    payload,
    lineageVerified: true
  };
}

export function localizeDescendantWorldSeed({
  verifiedSeed,
  descendantCrossing,
  dispositionReceipt,
  destination,
  localRules = {}
}) {
  const verified = asObject(verifiedSeed, "INVALID_VERIFIED_DESCENDANT_SEED");
  if (verified.lineageVerified !== true) {
    throw new Error("DESCENDANT_LINEAGE_NOT_VERIFIED");
  }

  const payload = asObject(verified.payload, "INVALID_DESCENDANT_PAYLOAD");
  const crossing = asObject(
    descendantCrossing,
    "INVALID_DESCENDANT_CROSSING"
  );
  const receipt = asObject(
    dispositionReceipt,
    "INVALID_DESCENDANT_DISPOSITION_RECEIPT"
  );
  const dest = asObject(destination, "INVALID_DESCENDANT_DESTINATION");

  if (
    receipt.kind !== "R3_ADMIT" ||
    receipt.crossing_id !== crossing.crossing_id
  ) {
    throw new Error("DESCENDANT_NOT_LOCALLY_ADMITTED");
  }
  if (receipt.world_id !== dest.worldId) {
    throw new Error("DESCENDANT_DESTINATION_WORLD_MISMATCH");
  }

  const sourceTenet = asObject(payload.tenet, "INVALID_DESCENDANT_TENET");
  const localBody = {
    crossingId: nonEmpty(crossing.crossing_id, "INVALID_DESCENDANT_CROSSING_ID"),
    payloadAddress: requireAddress(verified.address),
    destinationWorld: nonEmpty(dest.worldId, "INVALID_DESCENDANT_WORLD"),
    destinationPlace: nonEmpty(dest.placeId, "INVALID_DESCENDANT_PLACE"),
    receiverParticular: nonEmpty(
      receipt.receiver_particular,
      "INVALID_DESCENDANT_RECEIVER"
    ),
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
      "INVALID_DESCENDANT_ADMISSION_RECEIPT_ID"
    ),
    placeId: dest.placeId,
    sourceActorId: receipt.receiver_particular,
    kind: "tenet",
    tags: ["tenet", "imported-tenet", "descendant-tenet"],
    authority: "invitation-only",
    tenet: {
      tenetId: `tenet:descendant:${digest.slice(0, 20)}`,
      seedId: sourceTenet.seedId,
      label: localBody.label,
      offeredActionLabel: localBody.offeredActionLabel,
      requiredHeldKind: localBody.requiredHeldKind,
      authorId: sourceTenet.authorId,
      authorControl: false,
      dispositions: ["notice", "hold", "ignore", "act-through"]
    },
    lineage: {
      ancestorPayloadAddress: payload.ancestor.payloadAddress,
      ancestorCrossingId: payload.ancestor.crossingId,
      descendantCrossingId: crossing.crossing_id,
      descendantPayloadAddress: verified.address,
      uptakeId: payload.lineage.uptake.uptake_id,
      ancestryAuthority: false
    }
  };
}
