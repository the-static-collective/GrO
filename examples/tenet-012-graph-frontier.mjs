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
import { act, resolveField } from "../src/field.js";
import { stableStringify } from "../src/stable.js";
import {
  addressRecombinationWorldSeed,
  localizeRecombinationWorldSeed,
  makeRecombinationCrossingDraft,
  makeRecombinationWorldSeed,
  verifyRecombinationWorldSeed
} from "../src/recombination.js";
import { writeAddressedJson } from "../src/payload-store.js";
import {
  GRO_FRONTIER_DESCENDANT_MEDIA_TYPE,
  addressFrontierDescendantWorldSeed,
  addressGraphFrontierCheckpoint,
  createGraphFrontierCheckpoint,
  localizeFrontierDescendantWorldSeed,
  makeFrontierDescendantWorldSeed,
  makeGraphFrontierCheckpointDraft,
  verifyFrontierDescendantWorldSeed,
  verifyGraphFrontierCheckpoint
} from "../src/graph-frontier.js";

const relatteRoot = resolve(process.argv[2] ?? ".deps/reLATTE");
const relatte = await import(
  pathToFileURL(resolve(relatteRoot, "src/index.ts")).href
);

const base = await mkdtemp(resolve(tmpdir(), "gro-tenet-012-"));
const branchAStore = resolve(base, "branch-a-checkpoint-store");
const branchBStore = resolve(base, "branch-b-checkpoint-store");
const vStore = resolve(base, "v-store");

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

  // Room E can recombine because both branches are locally ADMITted and eligible.
  const parentABefore = stableStringify(branchA.crossing);
  const parentBBefore = stableStringify(branchB.crossing);

  const seedW = makeRecombinationWorldSeed({
    fork,
    localProjection: coexist,
    parentAdmissions: [admitA, admitB],
    worldId: "world:e",
    placeId: "place:e-rain-song",
    actorId: "actor:e-composer",
    occurredAt: "2026-10-04T20:15:00.000Z",
    composition: {
      parents: [
        {
          checkpointId: branchA.checkpoint.checkpointId,
          preserved: [
            "orchard care",
            "the invitation remains optional"
          ],
          varied: [
            "the orchard route becomes the rhythmic half of a shared rain-song"
          ],
          retired: [
            "branch A as the only available continuation"
          ]
        },
        {
          checkpointId: branchB.checkpoint.checkpointId,
          preserved: [
            "creek witness",
            "the invitation remains optional"
          ],
          varied: [
            "the creek route becomes the melodic half of a shared rain-song"
          ],
          retired: [
            "branch B as the only available continuation"
          ]
        }
      ],
      introduced: [
        "a new rain-song bridge between orchard and creek"
      ]
    },
    descendantTenet: {
      seedId: "tenet-seed:w",
      label: "Two lawful routes became a third invitation.",
      offeredActionLabel: "Carry the rain-song bridge",
      requiredHeldKind: "water",
      authorId: "actor:e-composer",
      authorControl: false
    }
  });

  const addressedW = addressRecombinationWorldSeed(seedW);
  const draftW = makeRecombinationCrossingDraft({
    seed: seedW,
    payloadAddress: addressedW.address,
    sourceHistoryHead: receiverE.snapshot().history_head,
    createdAt: "2026-10-04T20:15:01.000Z"
  });
  const crossingW = await relatte.sealCrossingEnvelope(
    draftW,
    await relatte.generateP256KeyPair()
  );

  assert.equal(await relatte.verifyCrossingEnvelope(crossingW), true);
  assert.deepEqual(
    crossingW.parents,
    [branchA.crossing.crossing_id, branchB.crossing.crossing_id].sort()
  );

  const verifiedW = await verifyRecombinationWorldSeed({
    bytes: addressedW.bytes,
    expectedAddress: addressedW.address,
    crossing: crossingW,
    verifyRelatteCrossing: (value) =>
      relatte.verifyCrossingEnvelope(value),
    verifyRelatteReceipt: (value) =>
      relatte.verifyReceipt(value)
  });

  assert.equal(verifiedW.recombinationVerified, true);
  assert.equal(verifiedW.parentCount, 2);
  assert.equal(verifiedW.authorityInherited, false);
  assert.equal(verifiedW.canonicalizesParents, false);
  assert.equal(verifiedW.erasesParents, false);

  // Creating W does not mutate or rewrite either parent.
  assert.equal(stableStringify(branchA.crossing), parentABefore);
  assert.equal(stableStringify(branchB.crossing), parentBBefore);

  // Room H receives W as a fresh candidate. Parent ADMITs do not propagate.
  const receiverH = await relatte.LocalReceiver.create(
    resolve(base, "room-h"),
    {
      world_id: "world:h",
      receiver_particular: "receiver:h",
      contract_ref: "contract:h/v0"
    }
  );
  const receiveW = await receiverH.receive(
    crossingW,
    "2026-10-04T20:16:00.000Z"
  );
  assert.equal(receiveW.kind, "RECEIVED");
  assert.equal(receiveW.semantic_effect, "none");

  const admitW = await receiverH.dispose(
    crossingW.crossing_id,
    "ADMIT",
    "2026-10-04T20:16:01.000Z",
    {
      admit_effect: "gro-recombinant-tenet-candidate"
    }
  );
  assert.equal(admitW.kind, "R3_ADMIT");

  const localW = localizeRecombinationWorldSeed({
    verifiedSeed: verifiedW,
    crossing: crossingW,
    dispositionReceipt: admitW,
    destination: {
      worldId: "world:h",
      placeId: "place:h-rain-song"
    },
    localRules: {
      label: "A recombined invitation arrived from two lawful parents.",
      offeredActionLabel: "Carry the rain-song bridge",
      requiredHeldKind: "water"
    }
  });

  const fieldH = resolveField({
    place: { id: "place:h-rain-song" },
    actor: {
      id: "actor:h",
      held: [{ id: "water:h", kind: "water" }]
    },
    traces: [localW]
  });
  assert.ok(
    fieldH.affordances.some((item) =>
      item.id.startsWith("through-tenet:")
    )
  );

  // Persist the two branch checkpoint bodies long enough to prove the frontier
  // was created from fully verified parent checkpoints.
  const storedCheckpointA = await writeAddressedJson(
    branchAStore,
    branchA.verifiedCheckpoint.checkpoint
  );
  const storedCheckpointB = await writeAddressedJson(
    branchBStore,
    branchB.verifiedCheckpoint.checkpoint
  );
  assert.equal(
    storedCheckpointA.address,
    branchA.verifiedCheckpoint.address
  );
  assert.equal(
    storedCheckpointB.address,
    branchB.verifiedCheckpoint.address
  );

  // Room H checkpoints recombinant W into one bounded multi-parent frontier.
  const commitmentH = await relatte.createReceiptSetCommitment({
    world_id: "world:h",
    local_history_head: receiverH.snapshot().history_head,
    receipts: [receiveW, admitW],
    created_at: "2026-10-04T20:16:02.000Z"
  });

  const frontierW = createGraphFrontierCheckpoint({
    verifiedRecombination: verifiedW,
    subjectCrossing: crossingW,
    verifiedParentCheckpoints: [
      branchA.verifiedCheckpoint,
      branchB.verifiedCheckpoint
    ],
    localReceiptSetCommitment: commitmentH,
    checkpointWorldId: "world:h",
    createdAt: "2026-10-04T20:16:03.000Z"
  });
  const addressedFrontierW = addressGraphFrontierCheckpoint(frontierW);
  const frontierDraftW = makeGraphFrontierCheckpointDraft({
    checkpoint: frontierW,
    checkpointAddress: addressedFrontierW.address,
    sourceParticular: "receiver:h",
    createdAt: "2026-10-04T20:16:04.000Z"
  });
  const frontierCrossingW = await relatte.sealCrossingEnvelope(
    frontierDraftW,
    await relatte.generateP256KeyPair()
  );

  const verifiedFrontierW = await verifyGraphFrontierCheckpoint({
    bytes: addressedFrontierW.bytes,
    expectedAddress: addressedFrontierW.address,
    checkpointCrossing: frontierCrossingW,
    verifyRelatteCrossing: (value) =>
      relatte.verifyCrossingEnvelope(value),
    verifyReceiptSetCommitmentShape: (value) =>
      relatte.verifyReceiptSetCommitmentShape(value)
  });

  assert.equal(verifiedFrontierW.graphFrontierVerified, true);
  assert.equal(verifiedFrontierW.parentCount, 2);
  assert.equal(frontierW.authority, null);
  assert.equal(frontierW.semanticEffect, "none");

  const frontierText = stableStringify(frontierW);
  assert.equal(
    frontierText.split('"schema":"gro.lineage-checkpoint.v0"').length - 1,
    0
  );

  // H acts through W to create V. Direct W→V evidence stays detailed;
  // ZA/ZB ancestry is now carried only through the graph frontier.
  const actorH = {
    id: "actor:h",
    held: [{ id: "water:h", kind: "water" }]
  };
  const throughW = fieldH.affordances.find((item) =>
    item.id.startsWith("through-tenet:")
  );
  const actedW = act({
    place: { id: "place:h-rain-song" },
    actor: actorH,
    field: fieldH,
    actionId: throughW.id,
    occurredAt: "2026-10-04T20:17:00.000Z",
    traces: [localW]
  });
  const responseW = actedW.traces.at(-1);

  const lensH = relatte.sealFieldLens({
    schema: "relatte.field-lens/v0",
    world_id: "world:h",
    title: "Recombinant frontier generation",
    channels: [
      {
        name: "growth",
        weights: {
          admitted_receipts: 1,
          admitted_descendants: 1
        }
      }
    ],
    created_at: "2026-10-04T20:17:01.000Z",
    laws: ["LENS != HISTORY", "LOCAL WEIGHT != UNIVERSAL VALUE"]
  });
  const fieldProjectionH = await relatte.projectField({
    lens: lensH,
    admitted_receipts: [admitW]
  });
  const uptakeWV = await relatte.createCulturalUptake({
    ancestor_crossing: crossingW,
    admitted_receipt: admitW,
    field_projection: fieldProjectionH,
    world_id: "world:h",
    local_particular: "particular:h-grower",
    variation: {
      preserved: [
        "rain-song bridge",
        "multi-parent ancestry remains attributable"
      ],
      varied: [
        "the bridge becomes a downstream creek-garden invitation"
      ],
      introduced: [
        "frontier descendant V"
      ],
      retired: [
        "recursive carry of both branch checkpoint bodies"
      ]
    },
    note: "H acts through W while carrying ZA/ZB ancestry as one bounded graph frontier.",
    created_at: "2026-10-04T20:17:02.000Z"
  });

  const payloadV = makeFrontierDescendantWorldSeed({
    parentLocalTrace: localW,
    actionReceipt: actedW.receipt,
    actionResponseTrace: responseW,
    descendantTenet: {
      seedId: "tenet-seed:v",
      label: "The rain-song crossed into the creek garden.",
      offeredActionLabel: "Carry water into the creek garden",
      requiredHeldKind: "water",
      authorId: actorH.id,
      authorControl: false
    },
    directLineageEvidence: {
      parentCrossing: crossingW,
      parentAdmissionReceipt: admitW,
      fieldProjection: fieldProjectionH,
      uptake: uptakeWV
    },
    ancestryFrontier: verifiedFrontierW
  });

  const addressedV = addressFrontierDescendantWorldSeed(payloadV);
  const storedV = await writeAddressedJson(vStore, payloadV);
  assert.equal(storedV.address, addressedV.address);

  const draftV = relatte.buildCulturalDescendantDraft({
    uptake: uptakeWV,
    descendant_payload_ref: {
      address: addressedV.address,
      media_type: GRO_FRONTIER_DESCENDANT_MEDIA_TYPE
    },
    created_at: "2026-10-04T20:18:00.000Z"
  });
  const crossingV = await relatte.sealCrossingEnvelope(
    draftV,
    await relatte.generateP256KeyPair()
  );
  assert.equal(
    await relatte.verifyCulturalDescendant({
      ancestor_crossing: crossingW,
      admitted_receipt: admitW,
      field_projection: fieldProjectionH,
      uptake: uptakeWV,
      descendant_crossing: crossingV
    }),
    true
  );

  const vText = stableStringify(payloadV);
  assert.equal(
    vText.split('"schema":"gro.graph-frontier-checkpoint.v0"').length - 1,
    1
  );
  assert.equal(
    vText.split('"schema":"gro.lineage-checkpoint.v0"').length - 1,
    0
  );

  // The original parent checkpoint bodies can now disappear.
  await rm(branchAStore, { recursive: true, force: true });
  await rm(branchBStore, { recursive: true, force: true });

  const receiverI = await relatte.LocalReceiver.create(
    resolve(base, "room-i"),
    {
      world_id: "world:i",
      receiver_particular: "receiver:i",
      contract_ref: "contract:i/v0"
    }
  );
  await receiverI.receive(
    crossingV,
    "2026-10-04T20:19:00.000Z"
  );
  const admitV = await receiverI.dispose(
    crossingV.crossing_id,
    "ADMIT",
    "2026-10-04T20:19:01.000Z",
    {
      admit_effect: "gro-frontier-descendant-candidate"
    }
  );

  const verifiedV = await verifyFrontierDescendantWorldSeed({
    bytes: storedV.bytes,
    expectedAddress: storedV.address,
    descendantCrossing: crossingV,
    verifyRelatteLineage: (args) =>
      relatte.verifyCulturalDescendant(args),
    verifyRelatteCrossing: (value) =>
      relatte.verifyCrossingEnvelope(value),
    verifyReceiptSetCommitmentShape: (value) =>
      relatte.verifyReceiptSetCommitmentShape(value)
  });

  assert.equal(verifiedV.lineageVerified, true);
  assert.equal(verifiedV.lineageMode, "graph-frontier-resumable");
  assert.equal(verifiedV.frontierParentCount, 2);

  const localV = localizeFrontierDescendantWorldSeed({
    verifiedSeed: verifiedV,
    descendantCrossing: crossingV,
    dispositionReceipt: admitV,
    destination: {
      worldId: "world:i",
      placeId: "place:i-creek-garden"
    },
    localRules: {
      label: "A graph-frontier descendant arrived.",
      offeredActionLabel: "Carry water through the creek garden",
      requiredHeldKind: "water"
    }
  });

  const fieldI = resolveField({
    place: { id: "place:i-creek-garden" },
    actor: {
      id: "actor:i",
      held: [{ id: "water:i", kind: "water" }]
    },
    traces: [localV]
  });
  assert.ok(
    fieldI.affordances.some((item) =>
      item.id.startsWith("through-tenet:")
    )
  );

  console.log(JSON.stringify({
    schema: "gro.tenet-012-witness.v0",
    graph_frontier: {
      checkpoint_id: frontierW.checkpointId,
      graph_root: frontierW.graphRoot,
      parent_frontier_root: frontierW.parentFrontierRoot,
      parent_count: frontierW.parentFrontier.length,
      parent_checkpoint_ids: frontierW.parentFrontier.map((anchor) => anchor.checkpointId),
      parent_lineage_roots: frontierW.parentFrontier.map((anchor) => anchor.lineageRoot),
      contains_parent_checkpoint_bodies: false,
      authority: frontierW.authority,
      semantic_effect: frontierW.semanticEffect
    },
    descendant_v: {
      seed_address: addressedV.address,
      crossing_id: crossingV.crossing_id,
      lineage_mode: verifiedV.lineageMode,
      frontier_parent_count: verifiedV.frontierParentCount,
      old_branch_checkpoint_stores_alive: false,
      graph_frontier_bodies_carried: 1,
      lineage_checkpoint_bodies_carried: 0,
      fresh_room_i_admit: admitV.kind,
      playable_in_room_i: fieldI.affordances.some((item) =>
        item.id.startsWith("through-tenet:")
      )
    },
    predecessor: {
      checkpoint_id: checkpointY.checkpointId,
      lineage_root: checkpointY.lineageRoot
    },
    recombinant: {
      seed_address: addressedW.address,
      crossing_id: crossingW.crossing_id,
      parent_crossing_ids: crossingW.parents,
      parent_checkpoint_ids: seedW.parents.map((parent) => parent.checkpointId),
      action_receipt_id: seedW.action.receipt.receiptId,
      inherited_authority: verifiedW.authorityInherited,
      canonicalizes_parents: verifiedW.canonicalizesParents,
      erases_parents: verifiedW.erasesParents,
      fresh_room_h_admit: admitW.kind,
      playable_in_room_h: fieldH.affordances.some((item) =>
        item.id.startsWith("through-tenet:")
      )
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
      "FRONTIER != HISTORY",
      "FRONTIER ROOT != AUTHORITY",
      "MULTI-PARENT ROOT != CANON",
      "FULL PARENT VERIFICATION PRECEDES FRONTIER PRUNING",
      "PARENT CHECKPOINT ANCHOR != PARENT CHECKPOINT BODY",
      "GRAPH PRUNING != GRAPH ERASURE",
      "DIRECT RELATION VERIFIED, EARLIER GRAPH CHECKPOINTED"
    ]
  }, null, 2));
} finally {
  await rm(base, { recursive: true, force: true });
}
