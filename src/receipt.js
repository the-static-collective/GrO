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
