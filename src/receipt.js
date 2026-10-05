import { createHash } from "node:crypto";
import { stableStringify } from "./stable.js";

export function makeReceipt(event) {
  const body = {
    schema: "gro.occurrence-receipt.v0",
    occurredAt: event.occurredAt,
    actorId: event.actorId,
    placeId: event.placeId,
    action: event.action,
    inputs: event.inputs ?? [],
    outputs: event.outputs ?? [],
    priorTraceIds: [...(event.priorTraceIds ?? [])].sort()
  };

  const digest = createHash("sha256")
    .update(stableStringify(body))
    .digest("hex");

  return {
    ...body,
    receiptId: `sha256:${digest}`,
    claims: {
      occurrence: true,
      value: false,
      authority: false,
      ownership: false
    }
  };
}

export function verifyOccurrenceReceipt(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const recomputed = makeReceipt({
      occurredAt: value.occurredAt,
      actorId: value.actorId,
      placeId: value.placeId,
      action: value.action,
      inputs: value.inputs,
      outputs: value.outputs,
      priorTraceIds: value.priorTraceIds
    });

    return stableStringify(value) === stableStringify(recomputed);
  } catch {
    return false;
  }
}
