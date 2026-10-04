import { createHash } from "node:crypto";
import { stableStringify } from "./stable.js";

export const GRO_TENET_FAMILY_REF = "gro:tenet/v1";
export const GRO_TENET_DONOR_CONTRACT = "gro:tenet-crossing/v1";

export const GRO_ADDRESSED_TENET_FAMILY_REF = "gro:tenet-addressed/v1";
export const GRO_ADDRESSED_TENET_DONOR_CONTRACT =
  "gro:tenet-addressed-crossing/v1";
export const GRO_TENET_MEDIA_TYPE = "application/vnd.gro.tenet+json";

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

function requireSha256Address(value, code = "INVALID_SHA256_ADDRESS") {
  const address = nonEmpty(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(address)) throw new Error(code);
  return address;
}

function bytesOf(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  throw new Error("INVALID_PAYLOAD_BYTES");
}

function verifyEnvelopeAndReceipt({ crossing, dispositionReceipt, destination }) {
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

  return { envelope, receipt, dest, adapter };
}

function makeLocalizedTrace({
  envelope,
  receipt,
  dest,
  sourceTenet,
  sourceTraceId,
  sourceReceiptId,
  sourceAuthority,
  localRules = {},
  payloadAddress = null
}) {
  const localBody = {
    crossing_id: envelope.crossing_id,
    destination_world: dest.worldId,
    destination_place: nonEmpty(dest.placeId, "INVALID_DESTINATION_PLACE"),
    receiver_particular: nonEmpty(
      receipt.receiver_particular,
      "INVALID_RECEIVER_PARTICULAR"
    ),
    payload_address: payloadAddress,
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
      sourceTraceId,
      sourceReceiptId,
      sourceAuthority,
      sourceTenet: structuredClone(sourceTenet),
      payloadAddress,
      destinationWorld: dest.worldId,
      localReceiver: receipt.receiver_particular,
      localContractRef: receipt.contract_ref,
      localDisposition: receipt.kind
    }
  };
}

export function makeTenetPayload(trace) {
  const source = asObject(trace, "INVALID_TENET_TRACE");
  if (source.kind !== "tenet") throw new Error("TRACE_IS_NOT_TENET");
  if (source.authority !== "invitation-only") {
    throw new Error("TENET_MUST_BE_INVITATION_ONLY");
  }

  const tenet = asObject(source.tenet, "INVALID_TENET_BODY");
  if (tenet.authorControl !== false) {
    throw new Error("TENET_AUTHOR_CONTROL_MUST_BE_FALSE");
  }

  return {
    schema: "gro.tenet-transfer-payload.v1",
    source_trace_id: nonEmpty(source.traceId, "INVALID_SOURCE_TRACE_ID"),
    source_receipt_id: nonEmpty(source.receiptId, "INVALID_SOURCE_RECEIPT_ID"),
    source_authority: source.authority,
    tenet: structuredClone(tenet),
    laws: [
      "TENET != COMMAND",
      "SOURCE AUTHORITY != DESTINATION AUTHORITY",
      "ADDRESS != BYTES",
      "ADDRESS VERIFICATION != ADMISSION"
    ]
  };
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
        media_type: GRO_TENET_MEDIA_TYPE
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

export function makeAddressedTenetTransferSpec({
  trace,
  payloadAddress,
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

  const address = requireSha256Address(payloadAddress);

  const carrierClaim = {
    schema: "gro.tenet-carrier-claim.v1",
    source_trace_id: nonEmpty(source.traceId, "INVALID_SOURCE_TRACE_ID"),
    source_receipt_id: nonEmpty(source.receiptId, "INVALID_SOURCE_RECEIPT_ID"),
    source_authority: source.authority,
    source_author_control: false,
    payload_address: address,
    payload_media_type: GRO_TENET_MEDIA_TYPE,
    laws: [
      "CARRIER CLAIM != PAYLOAD",
      "ADDRESS != BYTES",
      "TRANSPORT != PAYLOAD RESOLUTION",
      "SOURCE AUTHORITY != DESTINATION AUTHORITY"
    ]
  };

  return {
    schema: "relatte.opaque-organ-spec/v0",
    family_ref: GRO_ADDRESSED_TENET_FAMILY_REF,
    donor_contract_ref: GRO_ADDRESSED_TENET_DONOR_CONTRACT,
    artifact_kind: "gro-addressed-tenet-particular",
    source_world: nonEmpty(sourceWorld, "INVALID_SOURCE_WORLD"),
    source_particular: source.traceId,
    source_history_head: sourceHistoryHead,
    payload_refs: [
      {
        address,
        role: "gro-tenet",
        media_type: GRO_TENET_MEDIA_TYPE
      }
    ],
    donor_claims: carrierClaim,
    requested_effect: {
      kind: "candidate-addressed-tenet-ingress",
      authority: "receiver-local",
      playable: false,
      payload_fetch_required: false,
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
  const { envelope, receipt, dest, adapter } = verifyEnvelopeAndReceipt({
    crossing,
    dispositionReceipt,
    destination
  });

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

  return {
    status: "admitted",
    disposition: receipt.kind,
    trace: makeLocalizedTrace({
      envelope,
      receipt,
      dest,
      sourceTenet,
      sourceTraceId: claims.source_trace_id,
      sourceReceiptId: claims.source_receipt_id,
      sourceAuthority: claims.source_authority,
      localRules
    })
  };
}

export async function interpretAddressedTenetArrival({
  crossing,
  dispositionReceipt,
  destination,
  resolvePayloadBytes,
  localRules = {}
}) {
  const { envelope, receipt, dest, adapter } = verifyEnvelopeAndReceipt({
    crossing,
    dispositionReceipt,
    destination
  });

  if (adapter.family_ref !== GRO_ADDRESSED_TENET_FAMILY_REF) {
    throw new Error("UNSUPPORTED_ADDRESSED_TENET_FAMILY");
  }

  const claims = asObject(adapter.donor_claims, "INVALID_TENET_CARRIER_CLAIM");
  if (claims.schema !== "gro.tenet-carrier-claim.v1") {
    throw new Error("INVALID_TENET_CARRIER_SCHEMA");
  }
  if (claims.source_authority !== "invitation-only") {
    throw new Error("SOURCE_AUTHORITY_ESCALATION");
  }
  if (claims.source_author_control !== false) {
    throw new Error("SOURCE_AUTHOR_CONTROL_ESCALATION");
  }

  const address = requireSha256Address(claims.payload_address);
  const refs = Array.isArray(envelope.payload_refs) ? envelope.payload_refs : [];
  const payloadRef = refs.find(
    (entry) =>
      entry?.role === "gro-tenet" &&
      entry?.media_type === GRO_TENET_MEDIA_TYPE
  );
  if (!payloadRef) throw new Error("TENET_PAYLOAD_REF_MISSING");
  if (payloadRef.address !== address) {
    throw new Error("TENET_PAYLOAD_ADDRESS_MISMATCH");
  }

  if (receipt.kind !== "R3_ADMIT") {
    return {
      status: "not-admitted",
      disposition: receipt.kind,
      payloadAddress: address,
      payloadResolved: false,
      trace: null
    };
  }

  if (typeof resolvePayloadBytes !== "function") {
    throw new Error("PAYLOAD_RESOLVER_REQUIRED_AFTER_ADMIT");
  }

  const bytes = bytesOf(await resolvePayloadBytes(address));
  const actualAddress = `sha256:${sha256(bytes)}`;
  if (actualAddress !== address) {
    throw new Error("PAYLOAD_ADDRESS_VERIFICATION_FAILED");
  }

  const text = bytes.toString("utf8");
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("INVALID_TENET_PAYLOAD_JSON");
  }

  if (stableStringify(payload) !== text) {
    throw new Error("TENET_PAYLOAD_NOT_CANONICAL");
  }

  const body = asObject(payload, "INVALID_TENET_PAYLOAD");
  if (body.schema !== "gro.tenet-transfer-payload.v1") {
    throw new Error("INVALID_ADDRESSED_TENET_PAYLOAD_SCHEMA");
  }
  if (body.source_trace_id !== claims.source_trace_id) {
    throw new Error("TENET_SOURCE_TRACE_MISMATCH");
  }
  if (body.source_receipt_id !== claims.source_receipt_id) {
    throw new Error("TENET_SOURCE_RECEIPT_MISMATCH");
  }
  if (body.source_authority !== claims.source_authority) {
    throw new Error("TENET_SOURCE_AUTHORITY_MISMATCH");
  }

  const sourceTenet = asObject(body.tenet, "INVALID_SOURCE_TENET");
  if (sourceTenet.authorControl !== false) {
    throw new Error("TENET_AUTHOR_CONTROL_MUST_BE_FALSE");
  }

  return {
    status: "admitted",
    disposition: receipt.kind,
    payloadAddress: address,
    payloadResolved: true,
    trace: makeLocalizedTrace({
      envelope,
      receipt,
      dest,
      sourceTenet,
      sourceTraceId: body.source_trace_id,
      sourceReceiptId: body.source_receipt_id,
      sourceAuthority: body.source_authority,
      localRules,
      payloadAddress: address
    })
  };
}
