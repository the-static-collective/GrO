import test from "node:test";
import assert from "node:assert/strict";

import {
  observeCheckpointFork,
  projectForkLocally
} from "../src/fork.js";

function verified({
  id,
  address,
  crossingId,
  root,
  subjectCrossingId,
  predecessor
}) {
  return {
    checkpointVerified: true,
    successionVerified: true,
    address,
    checkpointCrossing: {
      crossing_id: crossingId
    },
    checkpoint: {
      checkpointId: id,
      generation: 2,
      previousLineageRoot: predecessor.lineageRoot,
      predecessorAnchor: predecessor,
      subject: {
        crossingId: subjectCrossingId,
        payloadAddress:
          "sha256:" +
          (subjectCrossingId.endsWith("a") ? "a" : "b").repeat(64)
      },
      lineageRoot: root
    }
  };
}

function fixture() {
  const predecessor = {
    checkpointId: "checkpoint:y",
    checkpointAddress: "sha256:" + "c".repeat(64),
    checkpointCrossingId: "crossing:checkpoint-y",
    lineageRoot: "gro-lineage-root-v0:" + "d".repeat(64),
    generation: 1
  };

  const a = verified({
    id: "checkpoint:za",
    address: "sha256:" + "e".repeat(64),
    crossingId: "crossing:checkpoint-za",
    root: "gro-lineage-root-v0:" + "1".repeat(64),
    subjectCrossingId: "crossing:za",
    predecessor
  });
  const b = verified({
    id: "checkpoint:zb",
    address: "sha256:" + "f".repeat(64),
    crossingId: "crossing:checkpoint-zb",
    root: "gro-lineage-root-v0:" + "2".repeat(64),
    subjectCrossingId: "crossing:zb",
    predecessor
  });

  return { predecessor, a, b };
}

test("two valid successors of one predecessor are observed as fork, not conflict", () => {
  const { a, b } = fixture();
  const fork = observeCheckpointFork({
    verifiedCheckpoints: [b, a]
  });

  assert.equal(fork.schema, "gro.lineage-fork.v0");
  assert.equal(fork.conflict, false);
  assert.equal(fork.canonicalBranchId, null);
  assert.equal(fork.branches.length, 2);
  assert.notEqual(
    fork.branches[0].lineageRoot,
    fork.branches[1].lineageRoot
  );
});

test("default local projection preserves both branches", () => {
  const { a, b } = fixture();
  const fork = observeCheckpointFork({
    verifiedCheckpoints: [a, b]
  });

  const projected = projectForkLocally({
    fork,
    candidates: [
      { checkpointId: "checkpoint:za", facts: { route: "orchard" } },
      { checkpointId: "checkpoint:zb", facts: { route: "creek" } }
    ]
  });

  assert.equal(projected.localConflict, false);
  assert.equal(projected.eligibleBranchIds.length, 2);
  assert.equal(projected.canonicalBranchId, null);
});

test("a locality may hold one branch without making the other globally canonical", () => {
  const { a, b } = fixture();
  const fork = observeCheckpointFork({
    verifiedCheckpoints: [a, b]
  });

  const projected = projectForkLocally({
    fork,
    candidates: [
      { checkpointId: "checkpoint:za", facts: { route: "orchard" } },
      { checkpointId: "checkpoint:zb", facts: { route: "creek" } }
    ],
    localRule: {
      kind: "allow-subset",
      branchIds: ["checkpoint:za"]
    }
  });

  assert.deepEqual(projected.eligibleBranchIds, ["checkpoint:za"]);
  assert.deepEqual(projected.heldBranchIds, ["checkpoint:zb"]);
  assert.equal(projected.localConflict, false);
  assert.equal(projected.canonicalBranchId, null);
});

test("conflict appears only when a declared local exclusivity rule makes branches incompatible", () => {
  const { a, b } = fixture();
  const fork = observeCheckpointFork({
    verifiedCheckpoints: [a, b]
  });

  const projected = projectForkLocally({
    fork,
    candidates: [
      { checkpointId: "checkpoint:za", facts: { route: "orchard" } },
      { checkpointId: "checkpoint:zb", facts: { route: "creek" } }
    ],
    localRule: {
      kind: "exclusive-key",
      key: "route"
    }
  });

  assert.equal(projected.localConflict, true);
  assert.deepEqual(projected.eligibleBranchIds, []);
  assert.equal(projected.heldBranchIds.length, 2);
  assert.equal(projected.canonicalBranchId, null);
});

test("checkpoints from different predecessor anchors are not one fork", () => {
  const { a, b } = fixture();
  b.checkpoint.predecessorAnchor = {
    ...b.checkpoint.predecessorAnchor,
    checkpointId: "checkpoint:other"
  };

  assert.throws(
    () =>
      observeCheckpointFork({
        verifiedCheckpoints: [a, b]
      }),
    /FORK_PREDECESSOR_MISMATCH/
  );
});
