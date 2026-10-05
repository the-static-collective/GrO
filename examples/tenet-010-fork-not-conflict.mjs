import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  GRO_DESCENDANT_MEDIA_TYPE,
  addressDescendantWorldSeed
} from "../src/descendant.js";
import {
  GRO_PRUNED_DESCENDANT_MEDIA_TYPE,
  addressLineageCheckpoint,
  addressPrunedDescendantWorldSeed,
  createLineageCheckpoint,
  makeLineageCheckpointDraft,
  verifyLineageCheckpoint
} from "../src/lineage-checkpoint.js";
import {
  observeCheckpointFork,
  projectForkLocally
} from "../src/fork.js";

const relatteRoot = resolve(process.argv[2] ?? ".deps/reLATTE");
const relatte = await import(
  pathToFileURL(resolve(relatteRoot, "src/index.ts")).href
);

const base = await mkdtemp(resolve(tmpdir(), "gro-tenet-010-"));

function crossingDraft({
  sourceWorld,
  sourceParticular,
  parent,
  address,
  mediaType,
  createdAt
}) {
  return {
    schema: "relatte.crossing-envelope/v0",
    protocol_version: "0",
    source_particular: sourceParticular,
    source_world: sourceWorld,
    source_history_head: `history:${sourceWorld}`,
    parents: [parent],
    declared_kind: "R10_CULTURAL_DESCENDANT",
    payload_refs: [
      {
        address,
        role: "cultural-descendant",
        media_type: mediaType
      }
    ],
    requested_effect: {
      kind: "fresh-candidate-local-uptake",
      authority: "receiver-local"
    },
    capability_ref: null,
    privacy_policy: null,
    audience_policy: null,
    return_address: null,
    created_at: createdAt,
    extensions: {}
  };
}

async function emptyCommitment(world, tag, createdAt) {
  return relatte.createReceiptSetCommitment({
    world_id: world,
    local_history_head: `history:${tag}`,
    receipts: [],
    created_at: createdAt
  });
}

async function sealAndVerifyCheckpoint({
  checkpoint,
  sourceParticular,
  createdAt
}) {
  const addressed = addressLineageCheckpoint(checkpoint);
  const draft = makeLineageCheckpointDraft({
    checkpoint,
    checkpointAddress: addressed.address,
    sourceParticular,
    createdAt
  });
  const crossing = await relatte.sealCrossingEnvelope(
    draft,
    await relatte.generateP256KeyPair()
  );
  const verified = await verifyLineageCheckpoint({
    bytes: addressed.bytes,
    expectedAddress: addressed.address,
    checkpointCrossing: crossing,
    verifyRelatteCrossing: (value) =>
      relatte.verifyCrossingEnvelope(value),
    verifyReceiptSetCommitmentShape: (value) =>
      relatte.verifyReceiptSetCommitmentShape(value)
  });
  return { addressed, crossing, verified };
}

try {
  // Established upstream generation Y. TENET 007–009 already prove how such a
  // verified seed is lawfully produced; TENET 010 starts at the fork point.
  const payloadY = {
    schema: "gro.descendant-world-seed.v1",
    ancestor: {
      crossingId: "crossing:x",
      payloadAddress: "sha256:" + "a".repeat(64)
    },
    action: {
      receipt: {
        receiptId: "sha256:" + "b".repeat(64),
        actorId: "actor:b"
      }
    },
    lineage: {
      uptake: {
        uptake_id: "uptake:xy"
      }
    },
    tenet: {
      seedId: "seed:y",
      label: "Carry water forward.",
      offeredActionLabel: "Continue from Y",
      requiredHeldKind: "water",
      authorId: "actor:b",
      authorControl: false
    }
  };
  const addressedY = addressDescendantWorldSeed(payloadY);

  const crossingY = await relatte.sealCrossingEnvelope(
    crossingDraft({
      sourceWorld: "world:y",
      sourceParticular: "actor:y",
      parent: "crossing:x",
      address: addressedY.address,
      mediaType: GRO_DESCENDANT_MEDIA_TYPE,
      createdAt: "2026-10-04T20:10:00.000Z"
    }),
    await relatte.generateP256KeyPair()
  );
  assert.equal(await relatte.verifyCrossingEnvelope(crossingY), true);

  const verifiedY = {
    address: addressedY.address,
    payload: payloadY,
    lineageVerified: true
  };

  const checkpointY = createLineageCheckpoint({
    verifiedSeed: verifiedY,
    subjectCrossing: crossingY,
    localReceiptSetCommitment: await emptyCommitment(
      "world:checkpoint-y",
      "checkpoint-y",
      "2026-10-04T20:10:01.000Z"
    ),
    checkpointWorldId: "world:checkpoint-y",
    createdAt: "2026-10-04T20:10:02.000Z"
  });
  const sealedY = await sealAndVerifyCheckpoint({
    checkpoint: checkpointY,
    sourceParticular: "receiver:checkpoint-y",
    createdAt: "2026-10-04T20:10:03.000Z"
  });
  assert.equal(sealedY.verified.checkpointVerified, true);

  async function makeBranch({
    branch,
    world,
    actor,
    route,
    createdBase
  }) {
    const payload = {
      schema: "gro.pruned-descendant-world-seed.v1",
      parent: {
        crossingId: crossingY.crossing_id,
        payloadAddress: addressedY.address
      },
      action: {
        receipt: {
          receiptId: `sha256:${branch.repeat(64)}`,
          actorId: actor
        }
      },
      directLineage: {
        uptake: {
          uptake_id: `uptake:y${branch}`
        }
      },
      ancestryCheckpoint: {
        address: sealedY.verified.address,
        checkpoint: sealedY.verified.checkpoint,
        checkpointCrossing: sealedY.verified.checkpointCrossing
      },
      tenet: {
        seedId: `seed:z${branch}`,
        label: `Branch ${branch.toUpperCase()} carries water ${route}.`,
        offeredActionLabel: `Carry water ${route}`,
        requiredHeldKind: "water",
        authorId: actor,
        authorControl: false
      }
    };

    const addressed = addressPrunedDescendantWorldSeed(payload);
    const crossing = await relatte.sealCrossingEnvelope(
      crossingDraft({
        sourceWorld: world,
        sourceParticular: actor,
        parent: crossingY.crossing_id,
        address: addressed.address,
        mediaType: GRO_PRUNED_DESCENDANT_MEDIA_TYPE,
        createdAt: createdBase
      }),
      await relatte.generateP256KeyPair()
    );
    assert.equal(await relatte.verifyCrossingEnvelope(crossing), true);

    // This fixture begins after each branch's direct lineage verification.
    // 008/009 regression lanes continue to verify that prerequisite.
    const verifiedSeed = {
      address: addressed.address,
      payload,
      lineageVerified: true
    };

    const checkpoint = createLineageCheckpoint({
      verifiedSeed,
      subjectCrossing: crossing,
      localReceiptSetCommitment: await emptyCommitment(
        world,
        `checkpoint-z${branch}`,
        branch === "a"
          ? "2026-10-04T20:11:01.000Z"
          : "2026-10-04T20:12:01.000Z"
      ),
      checkpointWorldId: world,
      createdAt:
        branch === "a"
          ? "2026-10-04T20:11:02.000Z"
          : "2026-10-04T20:12:02.000Z"
    });

    const sealedCheckpoint = await sealAndVerifyCheckpoint({
      checkpoint,
      sourceParticular: `receiver:${world}`,
      createdAt:
        branch === "a"
          ? "2026-10-04T20:11:03.000Z"
          : "2026-10-04T20:12:03.000Z"
    });

    return {
      branch,
      route,
      payload,
      crossing,
      checkpoint,
      verifiedCheckpoint: sealedCheckpoint.verified
    };
  }

  const branchA = await makeBranch({
    branch: "a",
    world: "world:fork-a",
    actor: "actor:fork-a",
    route: "toward the orchard",
    createdBase: "2026-10-04T20:11:00.000Z"
  });
  const branchB = await makeBranch({
    branch: "b",
    world: "world:fork-b",
    actor: "actor:fork-b",
    route: "toward the creek",
    createdBase: "2026-10-04T20:12:00.000Z"
  });

  assert.equal(
    branchA.checkpoint.previousLineageRoot,
    checkpointY.lineageRoot
  );
  assert.equal(
    branchB.checkpoint.previousLineageRoot,
    checkpointY.lineageRoot
  );
  assert.notEqual(
    branchA.checkpoint.lineageRoot,
    branchB.checkpoint.lineageRoot
  );

  const fork = observeCheckpointFork({
    verifiedCheckpoints: [
      branchA.verifiedCheckpoint,
      branchB.verifiedCheckpoint
    ]
  });
  assert.equal(fork.conflict, false);
  assert.equal(fork.canonicalBranchId, null);

  const candidates = [
    {
      checkpointId: branchA.checkpoint.checkpointId,
      facts: { waterRoute: "orchard" }
    },
    {
      checkpointId: branchB.checkpoint.checkpointId,
      facts: { waterRoute: "creek" }
    }
  ];

  const coexist = projectForkLocally({
    fork,
    candidates
  });
  assert.equal(coexist.localConflict, false);
  assert.equal(coexist.eligibleBranchIds.length, 2);

  // Sovereign Room E can actually RECEIVE + ADMIT both branch crossings.
  const receiverE = await relatte.LocalReceiver.create(
    resolve(base, "room-e"),
    {
      world_id: "world:e",
      receiver_particular: "receiver:e",
      contract_ref: "contract:e/v0"
    }
  );
  await receiverE.receive(
    branchA.crossing,
    "2026-10-04T20:13:00.000Z"
  );
  await receiverE.receive(
    branchB.crossing,
    "2026-10-04T20:13:01.000Z"
  );
  const admitA = await receiverE.dispose(
    branchA.crossing.crossing_id,
    "ADMIT",
    "2026-10-04T20:13:02.000Z",
    { admit_effect: "gro-fork-branch-a" }
  );
  const admitB = await receiverE.dispose(
    branchB.crossing.crossing_id,
    "ADMIT",
    "2026-10-04T20:13:03.000Z",
    { admit_effect: "gro-fork-branch-b" }
  );
  assert.equal(admitA.kind, "R3_ADMIT");
  assert.equal(admitB.kind, "R3_ADMIT");

  // Another sovereign room may admit one and HOLD the other.
  const receiverF = await relatte.LocalReceiver.create(
    resolve(base, "room-f"),
    {
      world_id: "world:f",
      receiver_particular: "receiver:f",
      contract_ref: "contract:f/v0"
    }
  );
  await receiverF.receive(
    branchA.crossing,
    "2026-10-04T20:14:00.000Z"
  );
  await receiverF.receive(
    branchB.crossing,
    "2026-10-04T20:14:01.000Z"
  );
  const roomFAdmit = await receiverF.dispose(
    branchA.crossing.crossing_id,
    "ADMIT",
    "2026-10-04T20:14:02.000Z",
    { admit_effect: "gro-local-branch-a" }
  );
  const roomFHold = await receiverF.dispose(
    branchB.crossing.crossing_id,
    "HOLD",
    "2026-10-04T20:14:03.000Z",
    { note: "Room F holds branch B without invalidating it elsewhere." }
  );
  assert.equal(roomFAdmit.kind, "R3_ADMIT");
  assert.equal(roomFHold.kind, "R3_HOLD");

  const oneBranch = projectForkLocally({
    fork,
    candidates,
    localRule: {
      kind: "allow-subset",
      branchIds: [branchA.checkpoint.checkpointId]
    }
  });
  assert.equal(oneBranch.localConflict, false);
  assert.deepEqual(oneBranch.eligibleBranchIds, [
    branchA.checkpoint.checkpointId
  ]);
  assert.deepEqual(oneBranch.heldBranchIds, [
    branchB.checkpoint.checkpointId
  ]);

  // Conflict appears only because Room G declares this dimension exclusive.
  const exclusive = projectForkLocally({
    fork,
    candidates,
    localRule: {
      kind: "exclusive-key",
      key: "waterRoute"
    }
  });
  assert.equal(exclusive.localConflict, true);
  assert.equal(exclusive.canonicalBranchId, null);
  assert.equal(exclusive.heldBranchIds.length, 2);

  console.log(JSON.stringify({
    schema: "gro.tenet-010-witness.v0",
    predecessor: {
      checkpoint_id: checkpointY.checkpointId,
      lineage_root: checkpointY.lineageRoot
    },
    fork: {
      fork_id: fork.forkId,
      conflict_before_local_rule: fork.conflict,
      canonical_branch: fork.canonicalBranchId,
      branch_roots: fork.branches.map((branch) => branch.lineageRoot)
    },
    sovereign_localities: {
      room_e: {
        branch_a: admitA.kind,
        branch_b: admitB.kind,
        projection: "coexist"
      },
      room_f: {
        branch_a: roomFAdmit.kind,
        branch_b: roomFHold.kind,
        global_canon_created: false
      },
      room_g_projection: {
        declared_rule: "exclusive-key:waterRoute",
        local_conflict: exclusive.localConflict,
        branches_held: exclusive.heldBranchIds,
        global_canon_created: false
      }
    },
    laws: [
      "FORK != CONFLICT",
      "FORK != CANON",
      "BRANCH EXISTENCE != BRANCH SELECTION",
      "LOCAL SELECTION != GLOBAL CANON",
      "LOCAL INCOMPATIBILITY != GLOBAL CONFLICT",
      "CONFLICT REQUIRES A DECLARED LOCAL RULE"
    ]
  }, null, 2));
} finally {
  await rm(base, { recursive: true, force: true });
}
