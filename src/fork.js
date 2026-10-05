import { createHash } from "node:crypto";

import { stableStringify } from "./stable.js";

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

function digest(value) {
  return createHash("sha256")
    .update(stableStringify(value))
    .digest("hex");
}

function normalizedVerifiedCheckpoint(value) {
  const verified = asObject(value, "INVALID_VERIFIED_CHECKPOINT");
  if (
    verified.checkpointVerified !== true ||
    verified.successionVerified !== true
  ) {
    throw new Error("FORK_REQUIRES_VERIFIED_CHECKPOINT");
  }

  const checkpoint = asObject(
    verified.checkpoint,
    "INVALID_FORK_CHECKPOINT_BODY"
  );
  const predecessor = asObject(
    checkpoint.predecessorAnchor,
    "FORK_REQUIRES_SUCCESSOR_CHECKPOINT"
  );
  const subject = asObject(
    checkpoint.subject,
    "INVALID_FORK_CHECKPOINT_SUBJECT"
  );

  const generation = Number(checkpoint.generation);
  if (!Number.isInteger(generation) || generation < 2) {
    throw new Error("FORK_REQUIRES_SUCCESSOR_GENERATION");
  }

  return {
    checkpointId: nonEmpty(
      checkpoint.checkpointId,
      "INVALID_FORK_CHECKPOINT_ID"
    ),
    checkpointAddress: nonEmpty(
      verified.address,
      "INVALID_FORK_CHECKPOINT_ADDRESS"
    ),
    checkpointCrossingId: nonEmpty(
      verified.checkpointCrossing?.crossing_id,
      "INVALID_FORK_CHECKPOINT_CROSSING_ID"
    ),
    lineageRoot: nonEmpty(
      checkpoint.lineageRoot,
      "INVALID_FORK_LINEAGE_ROOT"
    ),
    previousLineageRoot: nonEmpty(
      checkpoint.previousLineageRoot,
      "INVALID_FORK_PREVIOUS_ROOT"
    ),
    generation,
    subject: {
      crossingId: nonEmpty(
        subject.crossingId,
        "INVALID_FORK_SUBJECT_CROSSING_ID"
      ),
      payloadAddress: nonEmpty(
        subject.payloadAddress,
        "INVALID_FORK_SUBJECT_PAYLOAD_ADDRESS"
      )
    },
    predecessorAnchor: structuredClone(predecessor)
  };
}

export function observeCheckpointFork({ verifiedCheckpoints }) {
  if (!Array.isArray(verifiedCheckpoints) || verifiedCheckpoints.length < 2) {
    throw new Error("FORK_REQUIRES_AT_LEAST_TWO_CHECKPOINTS");
  }

  const byId = new Map();
  for (const value of verifiedCheckpoints) {
    const branch = normalizedVerifiedCheckpoint(value);
    byId.set(branch.checkpointId, branch);
  }

  const branches = [...byId.values()].sort((a, b) =>
    a.checkpointId.localeCompare(b.checkpointId)
  );
  if (branches.length < 2) {
    throw new Error("FORK_REQUIRES_TWO_DISTINCT_CHECKPOINTS");
  }

  const first = branches[0];
  const predecessorKey = stableStringify(first.predecessorAnchor);

  for (const branch of branches.slice(1)) {
    if (branch.generation !== first.generation) {
      throw new Error("FORK_GENERATION_MISMATCH");
    }
    if (branch.previousLineageRoot !== first.previousLineageRoot) {
      throw new Error("FORK_PREVIOUS_ROOT_MISMATCH");
    }
    if (stableStringify(branch.predecessorAnchor) !== predecessorKey) {
      throw new Error("FORK_PREDECESSOR_MISMATCH");
    }
  }

  const distinctSubjects = new Set(
    branches.map((branch) => branch.subject.crossingId)
  );
  const distinctRoots = new Set(
    branches.map((branch) => branch.lineageRoot)
  );

  if (distinctSubjects.size < 2 || distinctRoots.size < 2) {
    throw new Error("FORK_REQUIRES_DISTINCT_SUCCESSORS");
  }

  const forkBody = {
    schema: "gro.lineage-fork.v0",
    generation: first.generation,
    predecessorAnchor: structuredClone(first.predecessorAnchor),
    previousLineageRoot: first.previousLineageRoot,
    branches: branches.map((branch) => ({
      checkpointId: branch.checkpointId,
      checkpointAddress: branch.checkpointAddress,
      checkpointCrossingId: branch.checkpointCrossingId,
      lineageRoot: branch.lineageRoot,
      subject: structuredClone(branch.subject)
    })),
    canonicalBranchId: null,
    conflict: false,
    authority: null,
    laws: [
      "FORK != CONFLICT",
      "FORK != CANON",
      "BRANCH EXISTENCE != BRANCH SELECTION",
      "SHARED ANCESTRY != SHARED AUTHORITY"
    ]
  };

  return {
    ...forkBody,
    forkId: `gro-lineage-fork-v0:${digest(forkBody)}`
  };
}

function candidateIndex(fork, candidates) {
  if (!Array.isArray(candidates)) {
    throw new Error("FORK_CANDIDATES_REQUIRED");
  }

  const validIds = new Set(
    fork.branches.map((branch) => branch.checkpointId)
  );
  const index = new Map();

  for (const raw of candidates) {
    const candidate = asObject(raw, "INVALID_FORK_CANDIDATE");
    const checkpointId = nonEmpty(
      candidate.checkpointId,
      "INVALID_FORK_CANDIDATE_CHECKPOINT_ID"
    );
    if (!validIds.has(checkpointId)) {
      throw new Error("FORK_CANDIDATE_NOT_IN_FORK");
    }
    if (index.has(checkpointId)) {
      throw new Error("DUPLICATE_FORK_CANDIDATE");
    }

    index.set(checkpointId, {
      checkpointId,
      facts:
        candidate.facts &&
        typeof candidate.facts === "object" &&
        !Array.isArray(candidate.facts)
          ? structuredClone(candidate.facts)
          : {}
    });
  }

  if (index.size !== validIds.size) {
    throw new Error("FORK_CANDIDATES_INCOMPLETE");
  }

  return index;
}

export function projectForkLocally({
  fork,
  candidates,
  localRule = { kind: "coexist" }
}) {
  const observed = asObject(fork, "INVALID_FORK");
  if (
    observed.schema !== "gro.lineage-fork.v0" ||
    observed.conflict !== false ||
    observed.canonicalBranchId !== null
  ) {
    throw new Error("INVALID_FORK_OBSERVATION");
  }

  const index = candidateIndex(observed, candidates);
  const rule = asObject(localRule, "INVALID_FORK_LOCAL_RULE");
  const allIds = observed.branches.map((branch) => branch.checkpointId);

  if (rule.kind === "coexist") {
    return {
      schema: "gro.local-fork-projection.v0",
      forkId: observed.forkId,
      rule: "coexist",
      eligibleBranchIds: [...allIds],
      heldBranchIds: [],
      localConflict: false,
      canonicalBranchId: null,
      authority: "local-only",
      laws: [
        "LOCAL PROJECTION != GLOBAL CANON",
        "COEXISTENCE != COMPOSITION",
        "FORK != CONFLICT"
      ]
    };
  }

  if (rule.kind === "allow-subset") {
    if (!Array.isArray(rule.branchIds)) {
      throw new Error("ALLOW_SUBSET_BRANCH_IDS_REQUIRED");
    }
    const allowed = new Set(rule.branchIds);
    for (const id of allowed) {
      if (!index.has(id)) throw new Error("ALLOW_SUBSET_UNKNOWN_BRANCH");
    }

    return {
      schema: "gro.local-fork-projection.v0",
      forkId: observed.forkId,
      rule: "allow-subset",
      eligibleBranchIds: allIds.filter((id) => allowed.has(id)),
      heldBranchIds: allIds.filter((id) => !allowed.has(id)),
      localConflict: false,
      canonicalBranchId: null,
      authority: "local-only",
      laws: [
        "LOCAL SELECTION != GLOBAL CANON",
        "HOLD != REJECTION OF HISTORY",
        "FORK != CONFLICT"
      ]
    };
  }

  if (rule.kind === "exclusive-key") {
    const key = nonEmpty(rule.key, "EXCLUSIVE_KEY_REQUIRED");
    const values = new Map();

    for (const id of allIds) {
      const candidate = index.get(id);
      if (!Object.prototype.hasOwnProperty.call(candidate.facts, key)) {
        throw new Error("EXCLUSIVE_KEY_FACT_MISSING");
      }
      const valueKey = stableStringify(candidate.facts[key]);
      if (!values.has(valueKey)) values.set(valueKey, []);
      values.get(valueKey).push(id);
    }

    const conflict = values.size > 1;
    return {
      schema: "gro.local-fork-projection.v0",
      forkId: observed.forkId,
      rule: "exclusive-key",
      exclusiveKey: key,
      eligibleBranchIds: conflict ? [] : [...allIds],
      heldBranchIds: conflict ? [...allIds] : [],
      localConflict: conflict,
      canonicalBranchId: null,
      authority: "local-only",
      laws: [
        "LOCAL INCOMPATIBILITY != GLOBAL CONFLICT",
        "CONFLICT REQUIRES A DECLARED LOCAL RULE",
        "HOLD != ERASURE",
        "FORK != CANON"
      ]
    };
  }

  throw new Error("UNSUPPORTED_FORK_LOCAL_RULE");
}
