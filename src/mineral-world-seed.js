import { createHash } from "node:crypto";

import { verifyOccurrenceReceipt } from "./receipt.js";
import { stableStringify } from "./stable.js";

export const GRO_MINERAL_WORLD_SEED_FAMILY_REF =
  "gro:mineral-world-seed/v0";
export const GRO_MINERAL_WORLD_SEED_DONOR_CONTRACT =
  "gro:mineral-world-seed-crossing/v0";
export const GRO_MINERAL_WORLD_SEED_MEDIA_TYPE =
  "application/vnd.gro.mineral-world-seed+json";
export const GRO_MINERAL_WANT_MEDIA_TYPE =
  "application/vnd.gro.mineral-want+json";

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

function requireAddress(value, code = "INVALID_MINERAL_ADDRESS") {
  const address = nonEmpty(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(address)) throw new Error(code);
  return address;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function bytesOf(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  throw new Error("INVALID_MINERAL_BYTES");
}

function addressBytes(bytes) {
  return `sha256:${sha256(bytes)}`;
}

function parseCanonicalJson(bytes, expectedAddress, code) {
  const raw = bytesOf(bytes);
  if (addressBytes(raw) !== requireAddress(expectedAddress)) {
    throw new Error(`${code}_ADDRESS_MISMATCH`);
  }
  const text = raw.toString("utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${code}_INVALID_JSON`);
  }
  if (stableStringify(parsed) !== text) {
    throw new Error(`${code}_NOT_CANONICAL`);
  }
  return parsed;
}

function normalizeEvidence(value) {
  const evidence = asObject(value, "INVALID_MINERAL_VERIFICATION");
  if (evidence.status !== "OK") {
    throw new Error("MINERAL_WORLD_SEED_REQUIRES_VERIFIED_EVIDENCE");
  }
  return {
    verifier: nonEmpty(evidence.verifier, "INVALID_MINERAL_VERIFIER"),
    status: "OK",
    claimScope: nonEmpty(
      evidence.claimScope,
      "INVALID_MINERAL_CLAIM_SCOPE"
    ),
    receiptAddress: requireAddress(
      evidence.receiptAddress,
      "INVALID_MINERAL_VERIFICATION_RECEIPT_ADDRESS"
    )
  };
}

function normalizeAncestry(value) {
  if (value == null) return null;
  const ancestry = asObject(value, "INVALID_MINERAL_ANCESTRY");
  return {
    kind: "gro.mineral-descendant/v0",
    ancestorSeedAddress: requireAddress(
      ancestry.ancestorSeedAddress,
      "INVALID_MINERAL_ANCESTOR_SEED_ADDRESS"
    ),
    ancestorCrossingId: nonEmpty(
      ancestry.ancestorCrossingId,
      "INVALID_MINERAL_ANCESTOR_CROSSING"
    ),
    actionReceiptId: nonEmpty(
      ancestry.actionReceiptId,
      "INVALID_MINERAL_ANCESTOR_ACTION_RECEIPT"
    ),
    responseTraceId: nonEmpty(
      ancestry.responseTraceId,
      "INVALID_MINERAL_ANCESTOR_RESPONSE_TRACE"
    ),
    wantId: nonEmpty(
      ancestry.wantId,
      "INVALID_MINERAL_ANCESTOR_WANT"
    )
  };
}

export function makeMineralWorldSeed({
  mineralId,
  capability,
  workAddress,
  artifactAddress,
  artifactMediaType,
  sourceResultAddress,
  verification,
  ancestry = null,
  createdAt
}) {
  return {
    schema: "gro.mineral-world-seed.v0",
    mineral: {
      mineralId: nonEmpty(mineralId, "INVALID_MINERAL_ID"),
      capability: nonEmpty(capability, "INVALID_MINERAL_CAPABILITY"),
      workAddress: requireAddress(workAddress, "INVALID_MINERAL_WORK_ADDRESS"),
      artifactAddress: requireAddress(
        artifactAddress,
        "INVALID_MINERAL_ARTIFACT_ADDRESS"
      ),
      artifactMediaType: nonEmpty(
        artifactMediaType,
        "INVALID_MINERAL_ARTIFACT_MEDIA_TYPE"
      ),
      sourceResultAddress: requireAddress(
        sourceResultAddress,
        "INVALID_MINERAL_RESULT_ADDRESS"
      )
    },
    verification: normalizeEvidence(verification),
    ancestry: normalizeAncestry(ancestry),
    createdAt: nonEmpty(createdAt, "INVALID_MINERAL_SEED_CREATED_AT"),
    semanticEffect: "none",
    authority: null,
    laws: [
      "MINERAL != CONSEQUENCE",
      "VERIFIED ARTIFACT != LOCAL VALUE",
      "ADDRESS != BYTES",
      "VERIFICATION != ADMISSION",
      "ADMISSION != ACTION",
      "SOURCE AUTHORITY != LOCAL AFFORDANCE"
    ]
  };
}

export function addressMineralWorldSeed(seed) {
  const text = stableStringify(seed);
  const bytes = Buffer.from(text, "utf8");
  return {
    address: addressBytes(bytes),
    bytes
  };
}

export function makeMineralWorldSeedTransferSpec({
  seed,
  payloadAddress,
  sourceWorld,
  sourceParticular,
  sourceHistoryHead = null,
  createdAt,
  returnAddress = null
}) {
  const payload = asObject(seed, "INVALID_MINERAL_WORLD_SEED");
  if (payload.schema !== "gro.mineral-world-seed.v0") {
    throw new Error("INVALID_MINERAL_WORLD_SEED_SCHEMA");
  }
  const address = requireAddress(payloadAddress);
  const mineral = asObject(payload.mineral, "INVALID_MINERAL_BODY");

  return {
    schema: "relatte.opaque-organ-spec/v0",
    family_ref: GRO_MINERAL_WORLD_SEED_FAMILY_REF,
    donor_contract_ref: GRO_MINERAL_WORLD_SEED_DONOR_CONTRACT,
    artifact_kind: "gro-mineral-world-seed",
    source_world: nonEmpty(sourceWorld, "INVALID_MINERAL_SOURCE_WORLD"),
    source_particular: nonEmpty(
      sourceParticular,
      "INVALID_MINERAL_SOURCE_PARTICULAR"
    ),
    source_history_head: sourceHistoryHead,
    payload_refs: [
      {
        address,
        role: "gro-mineral-world-seed",
        media_type: GRO_MINERAL_WORLD_SEED_MEDIA_TYPE
      }
    ],
    donor_claims: {
      schema: "gro.mineral-world-seed-carrier.v0",
      payload_address: address,
      mineral_id: mineral.mineralId,
      capability: mineral.capability,
      artifact_address: mineral.artifactAddress,
      verification_receipt_address: payload.verification.receiptAddress,
      semantic_effect: "none",
      authority: null,
      laws: [
        "CARRIER != MINERAL",
        "TRANSPORT != ADMISSION",
        "VERIFICATION RECEIPT != LOCAL VALUE"
      ]
    },
    requested_effect: {
      kind: "candidate-mineral-world-seed-ingress",
      authority: "receiver-local",
      playable: false,
      payload_fetch_required: false
    },
    return_address: returnAddress,
    created_at: nonEmpty(createdAt, "INVALID_MINERAL_CROSSING_CREATED_AT")
  };
}

function normalizeLocalActions(actions) {
  if (actions == null) return [];
  if (!Array.isArray(actions)) throw new Error("INVALID_MINERAL_LOCAL_ACTIONS");
  const seen = new Set();
  return actions.map((value) => {
    const action = asObject(value, "INVALID_MINERAL_LOCAL_ACTION");
    const id = nonEmpty(action.id, "INVALID_MINERAL_LOCAL_ACTION_ID");
    if (seen.has(id)) throw new Error("DUPLICATE_MINERAL_LOCAL_ACTION");
    seen.add(id);
    const descendant = action.descendantMineralRequest == null
      ? null
      : {
          capability: nonEmpty(
            action.descendantMineralRequest.capability,
            "INVALID_DESCENDANT_MINERAL_CAPABILITY"
          ),
          payload: structuredClone(
            asObject(
              action.descendantMineralRequest.payload ?? {},
              "INVALID_DESCENDANT_MINERAL_PAYLOAD"
            )
          )
        };
    return {
      id,
      label: nonEmpty(action.label, "INVALID_MINERAL_LOCAL_ACTION_LABEL"),
      effect: nonEmpty(
        action.effect ?? "local-mineral-response",
        "INVALID_MINERAL_LOCAL_ACTION_EFFECT"
      ),
      descendantMineralRequest: descendant
    };
  });
}

export async function interpretMineralWorldSeedArrival({
  crossing,
  dispositionReceipt,
  destination,
  resolvePayloadBytes,
  resolveArtifactBytes,
  resolveResultBytes,
  verifyMineralEvidence,
  verifyDescendantLineage = null,
  localRules = {}
}) {
  const envelope = asObject(crossing, "INVALID_MINERAL_CROSSING");
  const receipt = asObject(
    dispositionReceipt,
    "INVALID_MINERAL_DISPOSITION_RECEIPT"
  );
  const dest = asObject(destination, "INVALID_MINERAL_DESTINATION");

  if (receipt.crossing_id !== envelope.crossing_id) {
    throw new Error("MINERAL_CROSSING_RECEIPT_MISMATCH");
  }
  if (receipt.world_id !== dest.worldId) {
    throw new Error("MINERAL_DESTINATION_WORLD_MISMATCH");
  }

  const adapter =
    envelope.extensions &&
    typeof envelope.extensions === "object" &&
    envelope.extensions.organ_adapter &&
    typeof envelope.extensions.organ_adapter === "object"
      ? envelope.extensions.organ_adapter
      : null;
  if (
    adapter &&
    adapter.family_ref !== GRO_MINERAL_WORLD_SEED_FAMILY_REF
  ) {
    throw new Error("UNSUPPORTED_MINERAL_WORLD_SEED_FAMILY");
  }

  if (receipt.kind !== "R3_ADMIT") {
    return {
      status: "not-admitted",
      disposition: receipt.kind,
      trace: null
    };
  }

  const ref = Array.isArray(envelope.payload_refs)
    ? envelope.payload_refs.find(
        (entry) =>
          entry?.role === "gro-mineral-world-seed" &&
          entry?.media_type === GRO_MINERAL_WORLD_SEED_MEDIA_TYPE
      )
    : null;
  if (!ref) throw new Error("MINERAL_WORLD_SEED_PAYLOAD_REF_REQUIRED");

  if (typeof resolvePayloadBytes !== "function") {
    throw new Error("MINERAL_WORLD_SEED_RESOLVER_REQUIRED");
  }
  if (typeof resolveArtifactBytes !== "function") {
    throw new Error("MINERAL_ARTIFACT_RESOLVER_REQUIRED");
  }
  if (typeof resolveResultBytes !== "function") {
    throw new Error("MINERAL_RESULT_RESOLVER_REQUIRED");
  }
  if (typeof verifyMineralEvidence !== "function") {
    throw new Error("MINERAL_EVIDENCE_VERIFIER_REQUIRED");
  }

  const payloadBytes = bytesOf(await resolvePayloadBytes(ref.address));
  const payload = parseCanonicalJson(
    payloadBytes,
    ref.address,
    "MINERAL_WORLD_SEED"
  );
  if (payload.schema !== "gro.mineral-world-seed.v0") {
    throw new Error("INVALID_MINERAL_WORLD_SEED_SCHEMA");
  }
  if (payload.semanticEffect !== "none" || payload.authority !== null) {
    throw new Error("MINERAL_WORLD_SEED_AUTHORITY_ESCALATION");
  }

  if (!adapter && !payload.ancestry) {
    throw new Error("SOURCE_MINERAL_WORLD_SEED_REQUIRES_ORGAN_ADAPTER");
  }

  const mineral = asObject(payload.mineral, "INVALID_MINERAL_BODY");
  const artifactAddress = requireAddress(mineral.artifactAddress);
  const resultAddress = requireAddress(mineral.sourceResultAddress);

  const artifactBytes = bytesOf(await resolveArtifactBytes(artifactAddress));
  if (addressBytes(artifactBytes) !== artifactAddress) {
    throw new Error("MINERAL_ARTIFACT_ADDRESS_MISMATCH");
  }
  const resultBytes = bytesOf(await resolveResultBytes(resultAddress));
  if (addressBytes(resultBytes) !== resultAddress) {
    throw new Error("MINERAL_RESULT_ADDRESS_MISMATCH");
  }

  const evidence = await verifyMineralEvidence({
    seed: payload,
    artifactBytes,
    resultBytes
  });
  const verified =
    evidence === true ||
    (evidence &&
      typeof evidence === "object" &&
      evidence.status === "OK");
  if (!verified) throw new Error("MINERAL_EVIDENCE_VERIFICATION_FAILED");

  if (evidence && typeof evidence === "object") {
    const evidenceReceipt =
      evidence.receipt && typeof evidence.receipt === "object"
        ? evidence.receipt
        : evidence;
    const receiptAddress = addressBytes(
      Buffer.from(stableStringify(evidenceReceipt), "utf8")
    );
    if (receiptAddress !== payload.verification.receiptAddress) {
      throw new Error("MINERAL_VERIFICATION_RECEIPT_ADDRESS_MISMATCH");
    }
    const observedScope =
      evidence.claimScope ??
      evidence.claim_scope ??
      evidenceReceipt.claim_scope ??
      evidenceReceipt.result?.claim_scope ??
      null;
    if (observedScope !== payload.verification.claimScope) {
      throw new Error("MINERAL_VERIFICATION_SCOPE_MISMATCH");
    }
  }

  if (payload.ancestry) {
    if (typeof verifyDescendantLineage !== "function") {
      throw new Error("MINERAL_DESCENDANT_LINEAGE_VERIFIER_REQUIRED");
    }
    if ((await verifyDescendantLineage({
      seed: payload,
      crossing: envelope
    })) !== true) {
      throw new Error("MINERAL_DESCENDANT_LINEAGE_VERIFICATION_FAILED");
    }
    if (
      !Array.isArray(envelope.parents) ||
      !envelope.parents.includes(payload.ancestry.ancestorCrossingId)
    ) {
      throw new Error("MINERAL_DESCENDANT_PARENT_NOT_BOUND");
    }
  }

  const actions = normalizeLocalActions(localRules.actions);
  const localBody = {
    crossingId: envelope.crossing_id,
    payloadAddress: ref.address,
    destinationWorld: dest.worldId,
    destinationPlace: nonEmpty(dest.placeId, "INVALID_MINERAL_DESTINATION_PLACE"),
    receiverParticular: nonEmpty(
      receipt.receiver_particular,
      "INVALID_MINERAL_RECEIVER"
    ),
    label:
      localRules.label ??
      `Verified mineral: ${mineral.mineralId}`,
    actions
  };
  const digest = sha256(Buffer.from(stableStringify(localBody), "utf8"));

  return {
    status: "admitted",
    disposition: receipt.kind,
    trace: {
      schema: "gro.trace.v0",
      traceId: `trace:${digest.slice(0, 20)}`,
      receiptId: nonEmpty(
        receipt.receipt_id,
        "INVALID_MINERAL_ADMISSION_RECEIPT"
      ),
      placeId: dest.placeId,
      sourceActorId: receipt.receiver_particular,
      kind: "mineral",
      tags: [
        "mineral",
        "verified-mineral",
        mineral.mineralId,
        mineral.capability
      ],
      authority: "invitation-only",
      mineral: {
        seedAddress: ref.address,
        mineralId: mineral.mineralId,
        capability: mineral.capability,
        workAddress: mineral.workAddress,
        artifactAddress,
        artifactMediaType: mineral.artifactMediaType,
        sourceResultAddress: resultAddress,
        verification: structuredClone(payload.verification),
        ancestry: structuredClone(payload.ancestry),
        label: localBody.label,
        actions
      },
      crossing: {
        crossingId: envelope.crossing_id,
        sourceWorld: envelope.source_world,
        payloadAddress: ref.address,
        destinationWorld: dest.worldId,
        localReceiver: receipt.receiver_particular,
        localContractRef: receipt.contract_ref,
        localDisposition: receipt.kind
      }
    }
  };
}

export function makeDescendantMineralWant({
  sourceTrace,
  actionReceipt,
  responseTrace
}) {
  const trace = asObject(sourceTrace, "INVALID_MINERAL_SOURCE_TRACE");
  if (trace.kind !== "mineral") {
    throw new Error("DESCENDANT_MINERAL_REQUIRES_MINERAL_TRACE");
  }
  const mineral = asObject(trace.mineral, "INVALID_MINERAL_TRACE_BODY");
  const receipt = asObject(
    actionReceipt,
    "INVALID_MINERAL_ACTION_RECEIPT"
  );
  const response = asObject(
    responseTrace,
    "INVALID_MINERAL_RESPONSE_TRACE"
  );
  if (!verifyOccurrenceReceipt(receipt)) {
    throw new Error("INVALID_MINERAL_ACTION_OCCURRENCE");
  }
  if (receipt.action !== "act-through-mineral") {
    throw new Error("DESCENDANT_MINERAL_REQUIRES_MINERAL_ACTION");
  }
  if (response.kind !== "mineral-response") {
    throw new Error("INVALID_MINERAL_RESPONSE_KIND");
  }
  if (response.receiptId !== receipt.receiptId) {
    throw new Error("MINERAL_RESPONSE_RECEIPT_MISMATCH");
  }
  if (response.relatedMineralTraceId !== trace.traceId) {
    throw new Error("MINERAL_RESPONSE_SOURCE_MISMATCH");
  }

  const localAction = mineral.actions.find(
    (item) => item.id === response.localActionId
  );
  if (!localAction?.descendantMineralRequest) {
    throw new Error("MINERAL_ACTION_DOES_NOT_OPEN_DESCENDANT_WORK");
  }

  const body = {
    schema: "gro.mineral-want.v0",
    ancestor: {
      seedAddress: requireAddress(mineral.seedAddress),
      crossingId: nonEmpty(
        trace.crossing?.crossingId,
        "INVALID_MINERAL_SOURCE_CROSSING"
      ),
      artifactAddress: requireAddress(mineral.artifactAddress)
    },
    action: {
      receiptId: receipt.receiptId,
      responseTraceId: response.traceId,
      localActionId: response.localActionId
    },
    request: structuredClone(localAction.descendantMineralRequest),
    authority: null,
    executable: false,
    laws: [
      "CONSEQUENCE != EXECUTION",
      "WANT != AUTHORIZATION",
      "GRO ACTION != GHOT ASSIGNMENT"
    ]
  };
  return {
    ...body,
    wantId: `gro-mineral-want-v0:${sha256(
      Buffer.from(stableStringify(body), "utf8")
    )}`
  };
}

export function makeDescendantMineralAncestry({
  want,
  sourceTrace,
  actionReceipt,
  responseTrace
}) {
  const candidate = asObject(want, "INVALID_MINERAL_WANT");
  if (candidate.schema !== "gro.mineral-want.v0") {
    throw new Error("INVALID_MINERAL_WANT_SCHEMA");
  }
  return {
    kind: "gro.mineral-descendant/v0",
    ancestorSeedAddress: candidate.ancestor.seedAddress,
    ancestorCrossingId: candidate.ancestor.crossingId,
    actionReceiptId: actionReceipt.receiptId,
    responseTraceId: responseTrace.traceId,
    wantId: candidate.wantId
  };
}

export function verifyMineralWant(value) {
  try {
    const want = asObject(value, "INVALID_MINERAL_WANT");
    if (want.schema !== "gro.mineral-want.v0") return false;
    const { wantId, ...body } = want;
    const expected = `gro-mineral-want-v0:${sha256(
      Buffer.from(stableStringify(body), "utf8")
    )}`;
    return wantId === expected;
  } catch {
    return false;
  }
}
