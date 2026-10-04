import { createHash } from "node:crypto";
import { stableStringify } from "./stable.js";

export const GRO_TENET_FAMILY_REF = "gro:tenet/v1";
export const GRO_TENET_DONOR_CONTRACT = "gro:tenet-crossing/v1";

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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function makeTenetTransferSpec({
  trace,
  sourceWorld,
  sourceHistoryHead = null,
  createdAt,
  returnAddress = null
}) {
  const source = asObject(trace, "INVALID_TENET_TRACE");
  if (source.kind !== "tenet") throw new Error("TRACE_IS_NOT_TENET");
  if (source.authority !== "invitation-only") {
    throw new Error("TENET_MUST_BE_INVITATION_ONLY");
  }

  const tenet = asObject(source.tenet, "INVALID_TENET_BODY");
  if (tenet.authorControl !== false) {
    throw new Error("TENET_AUTHOR_CONTROL_MUST_BE_FALSE");
  }

  const portableBody = {
    schema: "gro.tenet-transfer-payload.v0",
    source_trace_id: nonEmpty(source.traceId, "INVALID_SOURCE_TRACE_ID"),
    source_receipt_id: nonEmpty(source.receiptId, "INVALID_SOURCE_RECEIPT_ID"),
    source_authority: source.authority,
    tenet: structuredClone(tenet),
    laws: [
      "TENET != COMMAND",
      "SOURCE AUTHORITY != DESTINATION AUTHORITY",
      "TRANSPORT != ADMISSION",
      "ADMISSION != SOURCE CONTROL"
    ]
  };

  return {
    schema: "relatte.opaque-organ-spec/v0",
    family_ref: GRO_TENET_FAMILY_REF,
    donor_contract_ref: GRO_TENET_DONOR_CONTRACT,
    artifact_kind: "gro-tenet-particular",
    source_world: nonEmpty(sourceWorld, "INVALID_SOURCE_WORLD"),
    source_particular: source.traceId,
    source_history_head: sourceHistoryHead,
    payload_refs: [
      {
        address: `sha256:${sha256(stableStringify(portableBody))}`,
        role: "gro-tenet",
        media_type: "application/vnd.gro.tenet+json"
      }
    ],
    donor_claims: portableBody,
    requested_effect: {
      kind: "candidate-tenet-ingress",
      authority: "receiver-local",
      playable: false,
      source_authority_transfer: false
    },
    return_address: returnAddress,
    created_at: nonEmpty(createdAt, "INVALID_CREATED_AT")
  };
}

export function interpretTenetArrival({
  crossing,
  dispositionReceipt,
  destination,
  localRules = {}
}) {
  const envelope = asObject(crossing, "INVALID_CROSSING");
  const receipt = asObject(dispositionReceipt, "INVALID_DISPOSITION_RECEIPT");
  const dest = asObject(destination, "INVALID_DESTINATION");

  if (receipt.crossing_id !== envelope.crossing_id) {
    throw new Error("CROSSING_RECEIPT_MISMATCH");
  }
  if (receipt.world_id !== dest.worldId) {
    throw new Error("DESTINATION_WORLD_MISMATCH");
  }

  const adapter = asObject(
    asObject(envelope.extensions, "INVALID_CROSSING_EXTENSIONS").organ_adapter,
    "INVALID_ORGAN_ADAPTER"
  );

  if (adapter.family_ref !== GRO_TENET_FAMILY_REF) {
    throw new Error("UNSUPPORTED_TENET_FAMILY");
  }

  const claims = asObject(adapter.donor_claims, "INVALID_TENET_CLAIMS");
  if (claims.schema !== "gro.tenet-transfer-payload.v0") {
    throw new Error("INVALID_TENET_TRANSFER_SCHEMA");
  }
  if (claims.source_authority !== "invitation-only") {
    throw new Error("SOURCE_AUTHORITY_ESCALATION");
  }

  if (receipt.kind !== "R3_ADMIT") {
    return {
      status: "not-admitted",
      disposition: receipt.kind,
      trace: null
    };
  }

  const sourceTenet = asObject(claims.tenet, "INVALID_SOURCE_TENET");
  const localBody = {
    crossing_id: envelope.crossing_id,
    destination_world: dest.worldId,
    destination_place: nonEmpty(dest.placeId, "INVALID_DESTINATION_PLACE"),
    receiver_particular: nonEmpty(
      receipt.receiver_particular,
      "INVALID_RECEIVER_PARTICULAR"
    ),
    label: localRules.label ?? sourceTenet.label,
    offered_action_label:
      localRules.offeredActionLabel ?? sourceTenet.offeredActionLabel,
    required_held_kind:
      Object.prototype.hasOwnProperty.call(localRules, "requiredHeldKind")
        ? localRules.requiredHeldKind
        : sourceTenet.requiredHeldKind ?? null
  };

  const digest = sha256(stableStringify(localBody));
  const localTraceId = `trace:${digest.slice(0, 20)}`;

  return {
    status: "admitted",
    disposition: receipt.kind,
    trace: {
      schema: "gro.trace.v0",
      traceId: localTraceId,
      receiptId: nonEmpty(receipt.receipt_id, "INVALID_ADMISSION_RECEIPT_ID"),
      placeId: dest.placeId,
      sourceActorId: receipt.receiver_particular,
      kind: "tenet",
      tags: ["tenet", "imported-tenet"],
      authority: "invitation-only",
      tenet: {
        tenetId: `tenet:imported:${digest.slice(0, 20)}`,
        seedId: sourceTenet.seedId,
        label: localBody.label,
        offeredActionLabel: localBody.offered_action_label,
        requiredHeldKind: localBody.required_held_kind,
        authorId: sourceTenet.authorId,
        authorControl: false,
        dispositions: ["notice", "hold", "ignore", "act-through"]
      },
      crossing: {
        crossingId: envelope.crossing_id,
        sourceWorld: envelope.source_world,
        sourceTraceId: claims.source_trace_id,
        sourceReceiptId: claims.source_receipt_id,
        sourceAuthority: claims.source_authority,
        sourceTenet: structuredClone(sourceTenet),
        destinationWorld: dest.worldId,
        localReceiver: receipt.receiver_particular,
        localContractRef: receipt.contract_ref,
        localDisposition: receipt.kind
      }
    }
  };
}
