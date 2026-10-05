import test from "node:test";
import assert from "node:assert/strict";

import {
  createLineageCheckpoint
} from "../src/lineage-checkpoint.js";
import { observeCheckpointFork } from "../src/fork.js";

const ADDR = (ch) => "sha256:" + ch.repeat(64);

function commitment(world, tag) {
  return {
    schema: "relatte.receipt-set-commitment/v0",
    world_id: world,
    local_history_head: `history:${tag}`,
    receipt_count: 0,
    receipt_set_root: ADDR(tag === "root" ? "1" : tag === "a" ? "2" : "3"),
    created_at: "2026-10-05T21:00:00Z"
  };
}

function sourceVerifiedSeed() {
  return {
    address: ADDR("a"),
    lineageVerified: true,
    payload: {
      schema: "gro.mineral-world-seed.v0",
      mineral: {
        mineralId: "science.parameter-sweep/v0",
        capability: "mineral.parameter-sweep/v0",
        workAddress: ADDR("b"),
        artifactAddress: ADDR("c"),
        artifactMediaType: "application/json",
        sourceResultAddress: ADDR("d")
      },
      verification: {
        verifier: "GHoT exact recompute",
        status: "OK",
        claimScope: "deterministic-exact-recompute/v0",
        receiptAddress: ADDR("e")
      },
      ancestry: null,
      createdAt: "2026-10-05T21:00:00Z",
      semanticEffect: "none",
      authority: null,
      laws: []
    }
  };
}

function childVerifiedSeed(seedAddress, sourceCrossing, id) {
  return {
    address: seedAddress,
    lineageVerified: true,
    payload: {
      schema: "gro.mineral-world-seed.v0",
      mineral: {
        mineralId: `mineral:test:${id}`,
        capability: `mineral.test.${id}/v0`,
        workAddress: ADDR(id === "a" ? "4" : "5"),
        artifactAddress: ADDR(id === "a" ? "6" : "7"),
        artifactMediaType: "application/json",
        sourceResultAddress: ADDR(id === "a" ? "8" : "9")
      },
      verification: {
        verifier: "GHoT exact recompute",
        status: "OK",
        claimScope: "deterministic-exact-recompute/v0",
        receiptAddress: ADDR(id === "a" ? "b" : "c")
      },
      ancestry: {
        kind: "gro.mineral-descendant/v0",
        ancestorSeedAddress: ADDR("a"),
        ancestorCrossingId: sourceCrossing,
        actionReceiptId: `receipt:action:${id}`,
        responseTraceId: `trace:response:${id}`,
        wantId: `want:${id}`
      },
      createdAt: "2026-10-05T21:01:00Z",
      semanticEffect: "none",
      authority: null,
      laws: []
    }
  };
}

function verifiedCheckpoint(checkpoint, address, crossingId) {
  return {
    address,
    checkpoint,
    checkpointCrossing: { crossing_id: crossingId },
    checkpointVerified: true,
    successionVerified: true
  };
}

test("verified Mineral children checkpoint as a common noncanonical fork", () => {
  const sourceCrossing = "crossing:source";
  const sourceCheckpoint = createLineageCheckpoint({
    verifiedSeed: sourceVerifiedSeed(),
    subjectCrossing: {
      crossing_id: sourceCrossing,
      payload_refs: [{ address: ADDR("a") }]
    },
    localReceiptSetCommitment: commitment("world:root", "root"),
    checkpointWorldId: "world:root",
    createdAt: "2026-10-05T21:00:01Z"
  });
  assert.equal(sourceCheckpoint.generation, 1);
  assert.equal(sourceCheckpoint.directParent, null);

  const verifiedRoot = verifiedCheckpoint(
    sourceCheckpoint,
    ADDR("f"),
    "crossing:checkpoint:root"
  );

  const childA = createLineageCheckpoint({
    verifiedSeed: childVerifiedSeed(ADDR("d"), sourceCrossing, "a"),
    subjectCrossing: {
      crossing_id: "crossing:child:a",
      payload_refs: [{ address: ADDR("d") }]
    },
    predecessorCheckpoint: verifiedRoot,
    localReceiptSetCommitment: commitment("world:a", "a"),
    checkpointWorldId: "world:a",
    createdAt: "2026-10-05T21:01:01Z"
  });
  const childB = createLineageCheckpoint({
    verifiedSeed: childVerifiedSeed(ADDR("e"), sourceCrossing, "b"),
    subjectCrossing: {
      crossing_id: "crossing:child:b",
      payload_refs: [{ address: ADDR("e") }]
    },
    predecessorCheckpoint: verifiedRoot,
    localReceiptSetCommitment: commitment("world:b", "b"),
    checkpointWorldId: "world:b",
    createdAt: "2026-10-05T21:01:02Z"
  });

  assert.equal(childA.generation, 2);
  assert.equal(childB.generation, 2);
  assert.equal(childA.previousLineageRoot, sourceCheckpoint.lineageRoot);
  assert.deepEqual(childA.directParent, childB.directParent);

  const fork = observeCheckpointFork({
    verifiedCheckpoints: [
      verifiedCheckpoint(childA, ADDR("1"), "crossing:checkpoint:a"),
      verifiedCheckpoint(childB, ADDR("2"), "crossing:checkpoint:b")
    ]
  });
  assert.equal(fork.conflict, false);
  assert.equal(fork.canonicalBranchId, null);
  assert.equal(fork.branches.length, 2);
  assert.deepEqual(fork.branches[0].directParent, fork.branches[1].directParent);

  const poisoned = structuredClone(
    verifiedCheckpoint(childB, ADDR("2"), "crossing:checkpoint:b")
  );
  poisoned.checkpoint.directParent = {
    crossingId: "crossing:other-source",
    payloadAddress: ADDR("9")
  };
  assert.throws(
    () =>
      observeCheckpointFork({
        verifiedCheckpoints: [
          verifiedCheckpoint(childA, ADDR("1"), "crossing:checkpoint:a"),
          poisoned
        ]
      }),
    /FORK_DIRECT_PARENT_MISMATCH/
  );
});
