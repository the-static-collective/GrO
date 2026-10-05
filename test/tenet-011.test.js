import test from "node:test";
import assert from "node:assert/strict";

import {
  observeCheckpointFork,
  projectForkLocally
} from "../src/fork.js";
import {
  addressRecombinationWorldSeed,
  localizeRecombinationWorldSeed,
  makeRecombinationCrossingDraft,
  makeRecombinationWorldSeed,
  verifyRecombinationWorldSeed
} from "../src/recombination.js";

function verified({
  id,
  address,
  checkpointCrossingId,
  root,
  subjectCrossingId,
  subjectAddress,
  predecessor
}) {
  return {
    checkpointVerified: true,
    successionVerified: true,
    address,
    checkpointCrossing: { crossing_id: checkpointCrossingId },
    checkpoint: {
      checkpointId: id,
      generation: 2,
      previousLineageRoot: predecessor.lineageRoot,
      predecessorAnchor: predecessor,
      subject: {
        crossingId: subjectCrossingId,
        payloadAddress: subjectAddress
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
  const za = verified({
    id: "checkpoint:za",
    address: "sha256:" + "e".repeat(64),
    checkpointCrossingId: "crossing:checkpoint-za",
    root: "gro-lineage-root-v0:" + "1".repeat(64),
    subjectCrossingId: "crossing:za",
    subjectAddress: "sha256:" + "a".repeat(64),
    predecessor
  });
  const zb = verified({
    id: "checkpoint:zb",
    address: "sha256:" + "f".repeat(64),
    checkpointCrossingId: "crossing:checkpoint-zb",
    root: "gro-lineage-root-v0:" + "2".repeat(64),
    subjectCrossingId: "crossing:zb",
    subjectAddress: "sha256:" + "b".repeat(64),
    predecessor
  });

  const fork = observeCheckpointFork({
    verifiedCheckpoints: [za, zb]
  });
  const projection = projectForkLocally({
    fork,
    candidates: [
      { checkpointId: "checkpoint:za", facts: { route: "orchard" } },
      { checkpointId: "checkpoint:zb", facts: { route: "creek" } }
    ]
  });

  const admissions = [
    {
      receipt_id: "receipt:admit-za",
      crossing_id: "crossing:za",
      world_id: "world:e",
      receiver_particular: "receiver:e",
      kind: "R3_ADMIT"
    },
    {
      receipt_id: "receipt:admit-zb",
      crossing_id: "crossing:zb",
      world_id: "world:e",
      receiver_particular: "receiver:e",
      kind: "R3_ADMIT"
    }
  ];

  const seed = makeRecombinationWorldSeed({
    fork,
    localProjection: projection,
    parentAdmissions: admissions,
    worldId: "world:e",
    placeId: "place:e",
    actorId: "actor:e",
    occurredAt: "2026-10-04T20:20:00Z",
    composition: {
      parents: [
        {
          checkpointId: "checkpoint:za",
          preserved: ["orchard care"],
          varied: ["orchard route becomes rhythm"],
          retired: []
        },
        {
          checkpointId: "checkpoint:zb",
          preserved: ["creek witness"],
          varied: ["creek route becomes melody"],
          retired: []
        }
      ],
      introduced: ["a rain-song bridge between orchard and creek"]
    },
    descendantTenet: {
      seedId: "seed:w",
      label: "Two routes became one new invitation.",
      offeredActionLabel: "Carry the rain-song bridge",
      requiredHeldKind: "water",
      authorId: "actor:e",
      authorControl: false
    }
  });
  const addressed = addressRecombinationWorldSeed(seed);
  const draft = makeRecombinationCrossingDraft({
    seed,
    payloadAddress: addressed.address,
    sourceHistoryHead: "history:e",
    createdAt: "2026-10-04T20:20:01Z"
  });
  const crossing = {
    ...draft,
    crossing_id: "crossing:w"
  };

  return { fork, projection, admissions, seed, addressed, crossing };
}

test("recombination requires both lawful fork branches to be locally eligible", () => {
  const { fork, admissions } = fixture();
  const oneOnly = projectForkLocally({
    fork,
    candidates: [
      { checkpointId: "checkpoint:za", facts: {} },
      { checkpointId: "checkpoint:zb", facts: {} }
    ],
    localRule: {
      kind: "allow-subset",
      branchIds: ["checkpoint:za"]
    }
  });

  assert.throws(
    () =>
      makeRecombinationWorldSeed({
        fork,
        localProjection: oneOnly,
        parentAdmissions: admissions,
        worldId: "world:e",
        placeId: "place:e",
        actorId: "actor:e",
        occurredAt: "2026-10-04T20:20:00Z",
        composition: {
          parents: [
            {
              checkpointId: "checkpoint:za",
              preserved: ["a"],
              varied: ["a2"],
              retired: []
            },
            {
              checkpointId: "checkpoint:zb",
              preserved: ["b"],
              varied: ["b2"],
              retired: []
            }
          ],
          introduced: ["w"]
        },
        descendantTenet: {
          seedId: "seed:w",
          label: "W",
          offeredActionLabel: "Act W",
          authorId: "actor:e",
          authorControl: false
        }
      }),
    /RECOMBINATION_REQUIRES_ALL_PARENTS_ELIGIBLE/
  );
});

test("W explicitly records contribution from both parents without canonicalizing either", () => {
  const { seed } = fixture();

  assert.equal(seed.parents.length, 2);
  assert.equal(seed.authority.inheritedFromParents, false);
  assert.equal(seed.authority.inheritedFromFork, false);
  assert.equal(seed.localProjection.canonicalBranchId, null);
  assert.equal(seed.fork.canonicalBranchId, null);
  assert.equal(seed.parents[0].contribution.preserved.length, 1);
  assert.equal(seed.parents[1].contribution.varied.length, 1);
});

test("recombinant crossing has both parent crossings and fresh receiver-local effect", () => {
  const { seed, addressed, crossing } = fixture();

  assert.deepEqual(crossing.parents, ["crossing:za", "crossing:zb"]);
  assert.equal(crossing.declared_kind, "GRO_MULTI_PARENT_RECOMBINATION");
  assert.equal(crossing.requested_effect.authority, "receiver-local");
  assert.equal(crossing.extensions.gro_recombination.inherited_authority, false);
  assert.equal(crossing.extensions.gro_recombination.canonicalizes_parents, false);
  assert.equal(crossing.extensions.gro_recombination.erases_parents, false);
  assert.equal(crossing.payload_refs[0].address, addressed.address);
  assert.equal(seed.action.receipt.action, "compose-fork-branches");
});

test("verified W still requires a fresh destination ADMIT", async () => {
  const { addressed, crossing } = fixture();

  const verified = await verifyRecombinationWorldSeed({
    bytes: addressed.bytes,
    expectedAddress: addressed.address,
    crossing,
    verifyRelatteCrossing: async () => true,
    verifyRelatteReceipt: async () => true
  });

  assert.equal(verified.recombinationVerified, true);
  assert.equal(verified.parentCount, 2);
  assert.equal(verified.authorityInherited, false);

  const trace = localizeRecombinationWorldSeed({
    verifiedSeed: verified,
    crossing,
    dispositionReceipt: {
      receipt_id: "receipt:admit-w",
      crossing_id: "crossing:w",
      world_id: "world:h",
      receiver_particular: "receiver:h",
      kind: "R3_ADMIT"
    },
    destination: {
      worldId: "world:h",
      placeId: "place:h"
    }
  });

  assert.equal(trace.lineage.multiParent, true);
  assert.equal(trace.lineage.ancestryAuthority, false);
  assert.equal(trace.lineage.canonicalizedParents, false);
  assert.equal(trace.lineage.erasedParents, false);
});
