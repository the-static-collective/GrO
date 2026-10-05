import { createHash } from "node:crypto";

import { verifyOccurrenceReceipt, makeReceipt } from "./receipt.js";
import { stableStringify } from "./stable.js";

export const GRO_RECOMBINANT_MEDIA_TYPE =
  "application/vnd.gro.recombinant-world-seed+json";

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

function stringArray(value, code, { nonEmptyRequired = false } = {}) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string" || entry.trim() === "")
  ) {
    throw new Error(code);
  }
  if (nonEmptyRequired && value.length === 0) throw new Error(code);
  return [...value];
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function requireAddress(value, code = "INVALID_RECOMBINATION_ADDRESS") {
  const address = nonEmpty(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(address)) throw new Error(code);
  return address;
}

function bytesOf(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  throw new Error("INVALID_RECOMBINATION_BYTES");
}

function forkIdentityBody(fork) {
  return {
    schema: "gro.lineage-fork.v0",
    generation: fork.generation,
    predecessorAnchor: fork.predecessorAnchor,
    previousLineageRoot: fork.previousLineageRoot,
    branches: fork.branches,
    canonicalBranchId: null,
    conflict: false,
    authority: null,
    laws: fork.laws
  };
}

function verifyForkShape(value) {
  const fork = asObject(value, "INVALID_RECOMBINATION_FORK");
  if (
    fork.schema !== "gro.lineage-fork.v0" ||
    fork.canonicalBranchId !== null ||
    fork.conflict !== false ||
    fork.authority !== null
  ) {
    throw new Error("INVALID_RECOMBINATION_FORK");
  }

  if (!Array.isArray(fork.branches) || fork.branches.length < 2) {
    throw new Error("RECOMBINATION_REQUIRES_FORK_BRANCHES");
  }

  const expected = `gro-lineage-fork-v0:${sha256(
    Buffer.from(stableStringify(forkIdentityBody(fork)), "utf8")
  )}`;
  if (fork.forkId !== expected) throw new Error("RECOMBINATION_FORK_ID_MISMATCH");

  const branchIds = new Set();
  const subjectIds = new Set();
  for (const branchValue of fork.branches) {
    const branch = asObject(branchValue, "INVALID_RECOMBINATION_FORK_BRANCH");
    branchIds.add(nonEmpty(branch.checkpointId, "INVALID_FORK_CHECKPOINT_ID"));
    subjectIds.add(
      nonEmpty(branch.subject?.crossingId, "INVALID_FORK_SUBJECT_CROSSING_ID")
    );
    requireAddress(branch.checkpointAddress, "INVALID_FORK_CHECKPOINT_ADDRESS");
    nonEmpty(branch.checkpointCrossingId, "INVALID_FORK_CHECKPOINT_CROSSING_ID");
    nonEmpty(branch.lineageRoot, "INVALID_FORK_LINEAGE_ROOT");
    requireAddress(branch.subject?.payloadAddress, "INVALID_FORK_SUBJECT_ADDRESS");
  }

  if (
    branchIds.size !== fork.branches.length ||
    subjectIds.size !== fork.branches.length
  ) {
    throw new Error("RECOMBINATION_FORK_BRANCHES_NOT_DISTINCT");
  }

  return fork;
}

function verifyProjectionShape(value, fork) {
  const projection = asObject(value, "INVALID_RECOMBINATION_PROJECTION");
  if (
    projection.schema !== "gro.local-fork-projection.v0" ||
    projection.forkId !== fork.forkId ||
    projection.localConflict !== false ||
    projection.canonicalBranchId !== null ||
    projection.authority !== "local-only"
  ) {
    throw new Error("RECOMBINATION_REQUIRES_NONCONFLICT_LOCAL_PROJECTION");
  }

  const eligible = new Set(projection.eligibleBranchIds ?? []);
  const branchIds = fork.branches.map((branch) => branch.checkpointId);
  if (!branchIds.every((id) => eligible.has(id))) {
    throw new Error("RECOMBINATION_REQUIRES_ALL_PARENTS_ELIGIBLE");
  }

  return projection;
}

function normalizeComposition({ fork, composition }) {
  const body = asObject(composition, "INVALID_RECOMBINATION_COMPOSITION");
  if (!Array.isArray(body.parents)) {
    throw new Error("RECOMBINATION_PARENT_COMPOSITIONS_REQUIRED");
  }

  const byId = new Map();
  for (const raw of body.parents) {
    const entry = asObject(raw, "INVALID_RECOMBINATION_PARENT_COMPOSITION");
    const checkpointId = nonEmpty(
      entry.checkpointId,
      "INVALID_RECOMBINATION_PARENT_CHECKPOINT_ID"
    );
    if (byId.has(checkpointId)) {
      throw new Error("DUPLICATE_RECOMBINATION_PARENT_COMPOSITION");
    }

    const preserved = stringArray(
      entry.preserved,
      "INVALID_RECOMBINATION_PRESERVED",
      { nonEmptyRequired: true }
    );
    const varied = stringArray(
      entry.varied,
      "INVALID_RECOMBINATION_VARIED",
      { nonEmptyRequired: true }
    );
    const retired = stringArray(
      entry.retired ?? [],
      "INVALID_RECOMBINATION_RETIRED"
    );

    byId.set(checkpointId, {
      checkpointId,
      preserved,
      varied,
      retired
    });
  }

  const branchIds = fork.branches.map((branch) => branch.checkpointId).sort();
  if (
    stableStringify([...byId.keys()].sort()) !== stableStringify(branchIds)
  ) {
    throw new Error("RECOMBINATION_COMPOSITION_MUST_COVER_ALL_PARENTS");
  }

  return {
    parents: branchIds.map((id) => byId.get(id)),
    introduced: stringArray(
      body.introduced,
      "INVALID_RECOMBINATION_INTRODUCED",
      { nonEmptyRequired: true }
    )
  };
}

function normalizeTenet(value, actorId) {
  const tenet = asObject(value, "INVALID_RECOMBINANT_TENET");
  if (tenet.authorControl !== false) {
    throw new Error("RECOMBINANT_AUTHOR_CONTROL_MUST_BE_FALSE");
  }
  if (tenet.authorId !== actorId) {
    throw new Error("RECOMBINANT_AUTHOR_MUST_BE_COMPOSER");
  }

  return {
    seedId: nonEmpty(tenet.seedId, "INVALID_RECOMBINANT_SEED_ID"),
    label: nonEmpty(tenet.label, "INVALID_RECOMBINANT_LABEL"),
    offeredActionLabel: nonEmpty(
      tenet.offeredActionLabel,
      "INVALID_RECOMBINANT_ACTION_LABEL"
    ),
    requiredHeldKind: tenet.requiredHeldKind ?? null,
    authorId: actorId,
    authorControl: false,
    dispositions: ["notice", "hold", "ignore", "act-through"]
  };
}

function matchAdmissions({ fork, admissions, worldId }) {
  if (!Array.isArray(admissions) || admissions.length !== fork.branches.length) {
    throw new Error("RECOMBINATION_REQUIRES_ONE_ADMISSION_PER_PARENT");
  }

  const byCrossing = new Map();
  for (const raw of admissions) {
    const receipt = asObject(raw, "INVALID_RECOMBINATION_ADMISSION");
    if (receipt.kind !== "R3_ADMIT") {
      throw new Error("RECOMBINATION_PARENT_NOT_ADMITTED");
    }
    if (receipt.world_id !== worldId) {
      throw new Error("RECOMBINATION_ADMISSION_WORLD_MISMATCH");
    }
    const crossingId = nonEmpty(
      receipt.crossing_id,
      "INVALID_RECOMBINATION_ADMISSION_CROSSING"
    );
    if (byCrossing.has(crossingId)) {
      throw new Error("DUPLICATE_RECOMBINATION_ADMISSION");
    }
    byCrossing.set(crossingId, structuredClone(receipt));
  }

  const branchSubjects = fork.branches.map((branch) => branch.subject.crossingId);
  if (!branchSubjects.every((id) => byCrossing.has(id))) {
    throw new Error("RECOMBINATION_ADMISSION_PARENT_MISMATCH");
  }

  return fork.branches.map((branch) => ({
    branch,
    admissionReceipt: byCrossing.get(branch.subject.crossingId)
  }));
}

export function makeRecombinationWorldSeed({
  fork,
  localProjection,
  parentAdmissions,
  worldId,
  placeId,
  actorId,
  occurredAt,
  composition,
  descendantTenet
}) {
  const observedFork = verifyForkShape(fork);
  verifyProjectionShape(localProjection, observedFork);

  const localWorld = nonEmpty(worldId, "INVALID_RECOMBINATION_WORLD");
  const localPlace = nonEmpty(placeId, "INVALID_RECOMBINATION_PLACE");
  const composer = nonEmpty(actorId, "INVALID_RECOMBINATION_ACTOR");
  const parentRecords = matchAdmissions({
    fork: observedFork,
    admissions: parentAdmissions,
    worldId: localWorld
  });
  const compositionRecord = normalizeComposition({
    fork: observedFork,
    composition
  });
  const tenet = normalizeTenet(descendantTenet, composer);

  const inputReceiptIds = parentRecords
    .map(({ admissionReceipt }) =>
      nonEmpty(
        admissionReceipt.receipt_id,
        "INVALID_RECOMBINATION_ADMISSION_RECEIPT_ID"
      )
    )
    .sort();

  const receipt = makeReceipt({
    occurredAt: nonEmpty(occurredAt, "INVALID_RECOMBINATION_OCCURRED_AT"),
    actorId: composer,
    placeId: localPlace,
    action: "compose-fork-branches",
    inputs: inputReceiptIds,
    outputs: ["world-seed:recombinant"],
    priorTraceIds: []
  });

  return {
    schema: "gro.recombinant-world-seed.v1",
    fork: structuredClone(observedFork),
    localProjection: {
      schema: localProjection.schema,
      forkId: localProjection.forkId,
      rule: localProjection.rule,
      eligibleBranchIds: [...localProjection.eligibleBranchIds].sort(),
      heldBranchIds: [...(localProjection.heldBranchIds ?? [])].sort(),
      localConflict: false,
      canonicalBranchId: null,
      authority: "local-only"
    },
    parents: parentRecords.map(({ branch, admissionReceipt }) => {
      const declared = compositionRecord.parents.find(
        (entry) => entry.checkpointId === branch.checkpointId
      );
      return {
        checkpointId: branch.checkpointId,
        checkpointAddress: branch.checkpointAddress,
        checkpointCrossingId: branch.checkpointCrossingId,
        lineageRoot: branch.lineageRoot,
        subject: structuredClone(branch.subject),
        admissionReceipt,
        contribution: structuredClone(declared)
      };
    }),
    action: {
      receipt
    },
    composition: {
      introduced: compositionRecord.introduced
    },
    tenet,
    authority: {
      inheritedFromParents: false,
      inheritedFromFork: false,
      localAuthorRequired: true
    },
    laws: [
      "COMPOSITION != CANONIZATION",
      "MERGE != ERASURE",
      "MULTI-PARENT ANCESTRY != SHARED AUTHORITY",
      "RECOMBINATION REQUIRES LOCAL COELIGIBILITY",
      "PARENT ADMIT != CHILD ADMIT",
      "VARIATION != RETCON",
      "PARENTS REMAIN INTACT"
    ]
  };
}

export function addressRecombinationWorldSeed(value) {
  const text = stableStringify(value);
  const bytes = Buffer.from(text, "utf8");
  return {
    address: `sha256:${sha256(bytes)}`,
    bytes
  };
}

export function makeRecombinationCrossingDraft({
  seed,
  payloadAddress,
  sourceHistoryHead,
  returnAddress = null,
  createdAt
}) {
  const payload = asObject(seed, "INVALID_RECOMBINATION_SEED");
  if (payload.schema !== "gro.recombinant-world-seed.v1") {
    throw new Error("INVALID_RECOMBINATION_SEED_SCHEMA");
  }

  const address = requireAddress(payloadAddress);
  const parentCrossings = payload.parents
    .map((parent) => parent.subject.crossingId)
    .sort();

  return {
    schema: "relatte.crossing-envelope/v0",
    protocol_version: "0",
    source_particular: payload.tenet.authorId,
    source_world: payload.parents[0].admissionReceipt.world_id,
    source_history_head: sourceHistoryHead ?? null,
    parents: parentCrossings,
    declared_kind: "GRO_MULTI_PARENT_RECOMBINATION",
    payload_refs: [
      {
        address,
        role: "recombinant-world-seed",
        media_type: GRO_RECOMBINANT_MEDIA_TYPE
      }
    ],
    requested_effect: {
      kind: "fresh-candidate-local-uptake",
      authority: "receiver-local"
    },
    capability_ref: null,
    privacy_policy: null,
    audience_policy: null,
    return_address: returnAddress,
    created_at: nonEmpty(createdAt, "INVALID_RECOMBINATION_CROSSING_CREATED_AT"),
    extensions: {
      gro_recombination: {
        fork_id: payload.fork.forkId,
        parent_checkpoint_ids: payload.parents
          .map((parent) => parent.checkpointId)
          .sort(),
        parent_lineage_roots: payload.parents
          .map((parent) => parent.lineageRoot)
          .sort(),
        action_receipt_id: payload.action.receipt.receiptId,
        inherited_authority: false,
        canonicalizes_parents: false,
        erases_parents: false,
        laws: [
          "COMPOSITION != CANONIZATION",
          "MERGE != ERASURE",
          "MULTI-PARENT ANCESTRY != SHARED AUTHORITY"
        ]
      }
    }
  };
}

export async function verifyRecombinationWorldSeed({
  bytes,
  expectedAddress,
  crossing,
  verifyRelatteCrossing,
  verifyRelatteReceipt
}) {
  const raw = bytesOf(bytes);
  const address = requireAddress(expectedAddress);
  if (`sha256:${sha256(raw)}` !== address) {
    throw new Error("RECOMBINATION_PAYLOAD_ADDRESS_MISMATCH");
  }

  const text = raw.toString("utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("INVALID_RECOMBINATION_JSON");
  }
  if (stableStringify(parsed) !== text) {
    throw new Error("RECOMBINATION_PAYLOAD_NOT_CANONICAL");
  }

  const payload = asObject(parsed, "INVALID_RECOMBINATION_PAYLOAD");
  if (payload.schema !== "gro.recombinant-world-seed.v1") {
    throw new Error("INVALID_RECOMBINATION_PAYLOAD_SCHEMA");
  }

  const fork = verifyForkShape(payload.fork);
  verifyProjectionShape(payload.localProjection, fork);
  const worldId = payload.parents?.[0]?.admissionReceipt?.world_id;
  const parentRecords = matchAdmissions({
    fork,
    admissions: payload.parents.map((parent) => parent.admissionReceipt),
    worldId
  });

  if (typeof verifyRelatteReceipt !== "function") {
    throw new Error("RELATTE_RECEIPT_VERIFIER_REQUIRED");
  }
  for (const { admissionReceipt } of parentRecords) {
    if ((await verifyRelatteReceipt(admissionReceipt)) !== true) {
      throw new Error("INVALID_RECOMBINATION_PARENT_ADMISSION");
    }
  }

  const action = asObject(
    asObject(payload.action, "INVALID_RECOMBINATION_ACTION").receipt,
    "INVALID_RECOMBINATION_ACTION_RECEIPT"
  );
  if (!verifyOccurrenceReceipt(action)) {
    throw new Error("INVALID_RECOMBINATION_ACTION_RECEIPT");
  }
  if (action.action !== "compose-fork-branches") {
    throw new Error("INVALID_RECOMBINATION_ACTION_KIND");
  }
  if (action.actorId !== payload.tenet.authorId) {
    throw new Error("RECOMBINATION_ACTION_AUTHOR_MISMATCH");
  }

  const admissionIds = payload.parents
    .map((parent) => parent.admissionReceipt.receipt_id)
    .sort();
  if (
    stableStringify([...action.inputs].sort()) !==
    stableStringify(admissionIds)
  ) {
    throw new Error("RECOMBINATION_ACTION_INPUT_MISMATCH");
  }

  normalizeComposition({
    fork,
    composition: {
      parents: payload.parents.map((parent) => parent.contribution),
      introduced: payload.composition?.introduced
    }
  });
  normalizeTenet(payload.tenet, action.actorId);

  const authority = asObject(
    payload.authority,
    "INVALID_RECOMBINATION_AUTHORITY"
  );
  if (
    authority.inheritedFromParents !== false ||
    authority.inheritedFromFork !== false ||
    authority.localAuthorRequired !== true
  ) {
    throw new Error("RECOMBINATION_AUTHORITY_ESCALATION");
  }

  const envelope = asObject(crossing, "INVALID_RECOMBINATION_CROSSING");
  if (typeof verifyRelatteCrossing !== "function") {
    throw new Error("RELATTE_CROSSING_VERIFIER_REQUIRED");
  }
  if ((await verifyRelatteCrossing(envelope)) !== true) {
    throw new Error("INVALID_RECOMBINATION_CROSSING");
  }

  const expectedParents = payload.parents
    .map((parent) => parent.subject.crossingId)
    .sort();
  if (
    envelope.declared_kind !== "GRO_MULTI_PARENT_RECOMBINATION" ||
    stableStringify(envelope.parents) !== stableStringify(expectedParents)
  ) {
    throw new Error("RECOMBINATION_CROSSING_PARENT_MISMATCH");
  }

  const ref = Array.isArray(envelope.payload_refs)
    ? envelope.payload_refs.find(
        (entry) =>
          entry?.address === address &&
          entry?.role === "recombinant-world-seed" &&
          entry?.media_type === GRO_RECOMBINANT_MEDIA_TYPE
      )
    : null;
  if (!ref) throw new Error("RECOMBINATION_CROSSING_DOES_NOT_BIND_PAYLOAD");

  const requested = asObject(
    envelope.requested_effect,
    "INVALID_RECOMBINATION_REQUESTED_EFFECT"
  );
  if (
    requested.kind !== "fresh-candidate-local-uptake" ||
    requested.authority !== "receiver-local"
  ) {
    throw new Error("INVALID_RECOMBINATION_REQUESTED_EFFECT");
  }

  const ext = asObject(
    asObject(envelope.extensions, "INVALID_RECOMBINATION_EXTENSIONS")
      .gro_recombination,
    "INVALID_RECOMBINATION_EXTENSION"
  );
  if (
    ext.fork_id !== fork.forkId ||
    ext.action_receipt_id !== action.receiptId ||
    ext.inherited_authority !== false ||
    ext.canonicalizes_parents !== false ||
    ext.erases_parents !== false ||
    stableStringify(ext.parent_checkpoint_ids) !==
      stableStringify(payload.parents.map((parent) => parent.checkpointId).sort()) ||
    stableStringify(ext.parent_lineage_roots) !==
      stableStringify(payload.parents.map((parent) => parent.lineageRoot).sort())
  ) {
    throw new Error("RECOMBINATION_EXTENSION_MISMATCH");
  }

  return {
    address,
    payload,
    recombinationVerified: true,
    parentCount: payload.parents.length,
    authorityInherited: false,
    canonicalizesParents: false,
    erasesParents: false
  };
}

export function localizeRecombinationWorldSeed({
  verifiedSeed,
  crossing,
  dispositionReceipt,
  destination,
  localRules = {}
}) {
  const verified = asObject(
    verifiedSeed,
    "INVALID_VERIFIED_RECOMBINATION"
  );
  if (verified.recombinationVerified !== true) {
    throw new Error("RECOMBINATION_NOT_VERIFIED");
  }

  const payload = asObject(
    verified.payload,
    "INVALID_VERIFIED_RECOMBINATION_PAYLOAD"
  );
  const envelope = asObject(crossing, "INVALID_RECOMBINATION_CROSSING");
  const receipt = asObject(
    dispositionReceipt,
    "INVALID_RECOMBINATION_DISPOSITION"
  );
  const dest = asObject(destination, "INVALID_RECOMBINATION_DESTINATION");

  if (
    receipt.kind !== "R3_ADMIT" ||
    receipt.crossing_id !== envelope.crossing_id ||
    receipt.world_id !== dest.worldId
  ) {
    throw new Error("RECOMBINATION_NOT_LOCALLY_ADMITTED");
  }

  const tenet = payload.tenet;
  const localBody = {
    crossingId: envelope.crossing_id,
    payloadAddress: verified.address,
    destinationWorld: dest.worldId,
    destinationPlace: nonEmpty(dest.placeId, "INVALID_RECOMBINATION_PLACE"),
    receiverParticular: nonEmpty(
      receipt.receiver_particular,
      "INVALID_RECOMBINATION_RECEIVER"
    ),
    label: localRules.label ?? tenet.label,
    offeredActionLabel:
      localRules.offeredActionLabel ?? tenet.offeredActionLabel,
    requiredHeldKind:
      Object.prototype.hasOwnProperty.call(localRules, "requiredHeldKind")
        ? localRules.requiredHeldKind
        : tenet.requiredHeldKind ?? null
  };
  const digest = sha256(Buffer.from(stableStringify(localBody), "utf8"));

  return {
    schema: "gro.trace.v0",
    traceId: `trace:${digest.slice(0, 20)}`,
    receiptId: nonEmpty(
      receipt.receipt_id,
      "INVALID_RECOMBINATION_ADMISSION_ID"
    ),
    placeId: dest.placeId,
    sourceActorId: receipt.receiver_particular,
    kind: "tenet",
    tags: ["tenet", "imported-tenet", "recombinant-tenet"],
    authority: "invitation-only",
    tenet: {
      tenetId: `tenet:recombinant:${digest.slice(0, 20)}`,
      seedId: tenet.seedId,
      label: localBody.label,
      offeredActionLabel: localBody.offeredActionLabel,
      requiredHeldKind: localBody.requiredHeldKind,
      authorId: tenet.authorId,
      authorControl: false,
      dispositions: ["notice", "hold", "ignore", "act-through"]
    },
    lineage: {
      forkId: payload.fork.forkId,
      parentCrossingIds: payload.parents
        .map((parent) => parent.subject.crossingId)
        .sort(),
      parentCheckpointIds: payload.parents
        .map((parent) => parent.checkpointId)
        .sort(),
      recombinantCrossingId: envelope.crossing_id,
      recombinantPayloadAddress: verified.address,
      multiParent: true,
      ancestryAuthority: false,
      canonicalizedParents: false,
      erasedParents: false
    }
  };
}
