import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { act, resolveField } from "../src/field.js";
import {
  addressGraphFrontierCheckpoint,
  createGraphFrontierCheckpoint,
  makeGraphFrontierCheckpointDraft,
  verifyGraphFrontierCheckpoint
} from "../src/graph-frontier.js";
import {
  addressLineageCheckpoint,
  createLineageCheckpoint,
  makeLineageCheckpointDraft,
  verifyLineageCheckpoint
} from "../src/lineage-checkpoint.js";
import {
  GRO_MINERAL_WORLD_SEED_MEDIA_TYPE,
  addressMineralWorldSeed,
  interpretMineralWorldSeedArrival,
  makeDescendantMineralAncestry,
  makeDescendantMineralWant,
  makeMineralWorldSeed,
  makeMineralWorldSeedTransferSpec,
  verifyMineralWant
} from "../src/mineral-world-seed.js";
import {
  addressRecombinationWorldSeed,
  localizeRecombinationWorldSeed,
  makeRecombinationCrossingDraft,
  makeRecombinationWorldSeed,
  verifyRecombinationWorldSeed
} from "../src/recombination.js";
import {
  readAddressedBytes,
  writeAddressedBytes,
  writeAddressedJson
} from "../src/payload-store.js";
import {
  observeCheckpointFork,
  projectForkLocally
} from "../src/fork.js";
import { stableStringify } from "../src/stable.js";

const relatteRoot = resolve(process.argv[2] ?? ".deps/reLATTE");
const ghotRoot = resolve(process.argv[3] ?? ".deps/GHoT");
const relatte = await import(
  pathToFileURL(resolve(relatteRoot, "src/index.ts")).href
);
const bridge = resolve(ghotRoot, "ghot/gro_mineral_bridge.py");

function runBridge(args) {
  const run = spawnSync("python3", [bridge, ...args], {
    cwd: ghotRoot,
    encoding: "utf8"
  });
  if (run.status !== 0) {
    throw new Error(
      `GHoT bridge failed (${run.status}): ${run.stderr || run.stdout}`
    );
  }
  const lines = run.stdout.trim().split(/\r?\n/).filter(Boolean);
  return JSON.parse(lines.at(-1));
}

async function verifierFromBytes(base, tag, resultBytes, artifactBytes) {
  const resultPath = resolve(base, `${tag}-result.json`);
  const artifactPath = resolve(base, `${tag}-artifact.bin`);
  await writeFile(resultPath, resultBytes);
  await writeFile(artifactPath, artifactBytes);
  const receipt = runBridge([
    "verify-native",
    "--result", resultPath,
    "--artifact", artifactPath
  ]);
  return {
    status: receipt.status,
    claimScope: receipt.claim_scope,
    receipt
  };
}

async function storeNativeMine(providerRoot, mine) {
  const result = JSON.parse(await readFile(mine.result_path, "utf8"));
  const artifact = await readFile(mine.artifact_path);
  const resultStored = await writeAddressedJson(providerRoot, result);
  const artifactStored = await writeAddressedBytes(providerRoot, artifact);
  const verificationStored = await writeAddressedJson(
    providerRoot,
    mine.verification
  );
  return {
    result,
    artifact,
    resultStored,
    artifactStored,
    verificationStored
  };
}

function resolver(root) {
  return (address) => readAddressedBytes(root, address);
}

async function emptyCommitment(world, tag, createdAt) {
  return relatte.createReceiptSetCommitment({
    world_id: world,
    local_history_head: `history:${tag}`,
    receipts: [],
    created_at: createdAt
  });
}

async function checkpointMineral({
  verifiedSeed,
  subjectCrossing,
  predecessorCheckpoint = null,
  world,
  tag,
  createdAt
}) {
  const checkpoint = createLineageCheckpoint({
    verifiedSeed,
    subjectCrossing,
    predecessorCheckpoint,
    localReceiptSetCommitment: await emptyCommitment(
      world,
      tag,
      createdAt
    ),
    checkpointWorldId: world,
    createdAt
  });
  const addressed = addressLineageCheckpoint(checkpoint);
  const draft = makeLineageCheckpointDraft({
    checkpoint,
    checkpointAddress: addressed.address,
    sourceParticular: `receiver:${world}`,
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
  assert.equal(verified.checkpointVerified, true);
  return verified;
}

const base = await mkdtemp(resolve(tmpdir(), "gro-fork-garden-001-"));
const sourceProvider = resolve(base, "source-provider");

try {
  // ---------------------------------------------------------------------
  // Root Mineral: one exact parameter sweep, verified by GHoT recompute.
  // ---------------------------------------------------------------------
  const sourceMine = runBridge([
    "mine-native",
    "--root", resolve(base, "source-worker"),
    "--capability", "mineral.parameter-sweep/v0",
    "--payload", JSON.stringify({
      r_values: ["3", "13/4", "7/2"],
      x0: "1/2",
      steps: 6
    })
  ]);
  assert.equal(sourceMine.verification.status, "OK");

  const sourceStored = await storeNativeMine(sourceProvider, sourceMine);
  const sourceSeed = makeMineralWorldSeed({
    mineralId: sourceMine.mineral_id,
    capability: sourceMine.capability,
    workAddress: sourceMine.work_address,
    artifactAddress: sourceStored.artifactStored.address,
    artifactMediaType: "application/json",
    sourceResultAddress: sourceStored.resultStored.address,
    verification: {
      verifier: "GHoT exact recompute",
      status: "OK",
      claimScope: sourceMine.verification.claim_scope,
      receiptAddress: sourceStored.verificationStored.address
    },
    createdAt: "2026-10-05T21:10:00.000Z"
  });
  const addressedSource = addressMineralWorldSeed(sourceSeed);
  const storedSourceSeed = await writeAddressedJson(
    sourceProvider,
    sourceSeed
  );
  assert.equal(storedSourceSeed.address, addressedSource.address);

  const sourceSpec = makeMineralWorldSeedTransferSpec({
    seed: sourceSeed,
    payloadAddress: addressedSource.address,
    sourceWorld: "world:mineral-field",
    sourceParticular: "particular:mineral-field",
    sourceHistoryHead: "history:mineral-field:fork-garden",
    createdAt: "2026-10-05T21:10:01.000Z"
  });
  const sourceCrossing = await relatte.sealOpaqueOrganCrossing(
    sourceSpec,
    await relatte.generateP256KeyPair()
  );
  assert.equal(
    await relatte.verifyOpaqueOrganCrossing(sourceCrossing),
    true
  );

  let verifyCount = 0;
  async function verifyNative({ resultBytes, artifactBytes }) {
    verifyCount += 1;
    return verifierFromBytes(
      base,
      `verify-${verifyCount}`,
      resultBytes,
      artifactBytes
    );
  }

  // Root checkpoint is created only after one sovereign locality admits and
  // independently reverifies the source Mineral.
  const rootReceiver = await relatte.LocalReceiver.create(
    resolve(base, "root-receiver"),
    {
      world_id: "world:garden-root",
      receiver_particular: "receiver:garden-root",
      contract_ref: "contract:gro-mineral/v0"
    }
  );
  await rootReceiver.receive(
    sourceCrossing,
    "2026-10-05T21:10:02.000Z"
  );
  const rootAdmit = await rootReceiver.dispose(
    sourceCrossing.crossing_id,
    "ADMIT",
    "2026-10-05T21:10:03.000Z",
    { admit_effect: "fork-garden-root-mineral" }
  );
  const rootLocal = await interpretMineralWorldSeedArrival({
    crossing: sourceCrossing,
    dispositionReceipt: rootAdmit,
    destination: {
      worldId: "world:garden-root",
      placeId: "place:garden-root"
    },
    resolvePayloadBytes: resolver(sourceProvider),
    resolveArtifactBytes: resolver(sourceProvider),
    resolveResultBytes: resolver(sourceProvider),
    verifyMineralEvidence: verifyNative,
    localRules: {
      label: "A verified dynamical root waits without choosing a branch.",
      actions: []
    }
  });
  assert.equal(rootLocal.verifiedSeed.lineageVerified, true);

  const rootCheckpoint = await checkpointMineral({
    verifiedSeed: rootLocal.verifiedSeed,
    subjectCrossing: sourceCrossing,
    world: "world:garden-root-checkpoint",
    tag: "root",
    createdAt: "2026-10-05T21:10:04.000Z"
  });
  assert.equal(rootCheckpoint.checkpoint.generation, 1);
  assert.equal(rootCheckpoint.checkpoint.directParent, null);

  // ---------------------------------------------------------------------
  // Three sovereign rooms encounter the same source and choose differently.
  // ---------------------------------------------------------------------
  const branchSpecs = [
    {
      key: "a",
      room: "optimization",
      capability: "mineral.optimization.landscape/v0",
      payload: { xmin: -3, xmax: 3, ymin: -3, ymax: 3 },
      actionId: "seek-landscape",
      actionLabel: "Grow an optimization landscape",
      effect: "optimization-branch",
      fact: "optimization"
    },
    {
      key: "b",
      room: "terrain",
      capability: "mineral.procedural-world.chunk/v0",
      payload: {
        seed: "fork-garden-001",
        chunk_x: 2,
        chunk_y: -1,
        size: 12
      },
      actionId: "grow-terrain",
      actionLabel: "Grow a procedural terrain chunk",
      effect: "terrain-branch",
      fact: "procedural-world"
    },
    {
      key: "c",
      room: "fractal",
      capability: "mineral.fractal.tile/v0",
      payload: { width: 20, height: 16, max_iter: 36 },
      actionId: "grow-fractal",
      actionLabel: "Grow a fractal tile",
      effect: "fractal-branch",
      fact: "fractal"
    }
  ];

  async function growBranch(spec, index) {
    const sourceWorld = `world:garden-${spec.room}`;
    const sourcePlace = `place:garden-${spec.room}`;
    const sourceReceiver = await relatte.LocalReceiver.create(
      resolve(base, `source-room-${spec.key}`),
      {
        world_id: sourceWorld,
        receiver_particular: `receiver:garden-${spec.room}`,
        contract_ref: "contract:gro-mineral/v0"
      }
    );
    await sourceReceiver.receive(
      sourceCrossing,
      `2026-10-05T21:11:0${index}.000Z`
    );
    const sourceAdmit = await sourceReceiver.dispose(
      sourceCrossing.crossing_id,
      "ADMIT",
      `2026-10-05T21:11:1${index}.000Z`,
      { admit_effect: `fork-garden-${spec.room}-source` }
    );

    const local = await interpretMineralWorldSeedArrival({
      crossing: sourceCrossing,
      dispositionReceipt: sourceAdmit,
      destination: {
        worldId: sourceWorld,
        placeId: sourcePlace
      },
      resolvePayloadBytes: resolver(sourceProvider),
      resolveArtifactBytes: resolver(sourceProvider),
      resolveResultBytes: resolver(sourceProvider),
      verifyMineralEvidence: verifyNative,
      localRules: {
        label: `The same root becomes ${spec.room} possibility here.`,
        actions: [{
          id: spec.actionId,
          label: spec.actionLabel,
          effect: spec.effect,
          descendantMineralRequest: {
            capability: spec.capability,
            payload: spec.payload
          }
        }]
      }
    });

    const field = resolveField({
      place: { id: sourcePlace },
      actor: { id: `actor:garden-${spec.room}`, held: [] },
      traces: [local.trace]
    });
    const affordance = field.affordances.find(
      (item) => item.mineralActionId === spec.actionId
    );
    assert.ok(affordance);

    const acted = act({
      place: { id: sourcePlace },
      actor: { id: `actor:garden-${spec.room}`, held: [] },
      field,
      actionId: affordance.id,
      occurredAt: `2026-10-05T21:12:0${index}.000Z`,
      traces: [local.trace]
    });
    const response = acted.traces.at(-1);
    const want = makeDescendantMineralWant({
      sourceTrace: local.trace,
      actionReceipt: acted.receipt,
      responseTrace: response
    });
    assert.equal(verifyMineralWant(want), true);
    assert.equal(want.request.capability, spec.capability);

    const lens = relatte.sealFieldLens({
      schema: "relatte.field-lens/v0",
      world_id: sourceWorld,
      title: `Fork Garden ${spec.room} consequence`,
      channels: [{
        name: "growth",
        weights: {
          admitted_receipts: 1,
          admitted_descendants: 1
        }
      }],
      created_at: `2026-10-05T21:12:1${index}.000Z`,
      laws: [
        "LENS != HISTORY",
        "LOCAL CONSEQUENCE != UNIVERSAL VALUE"
      ]
    });
    const projection = await relatte.projectField({
      lens,
      admitted_receipts: [sourceAdmit]
    });
    const uptake = await relatte.createCulturalUptake({
      ancestor_crossing: sourceCrossing,
      admitted_receipt: sourceAdmit,
      field_projection: projection,
      world_id: sourceWorld,
      local_particular: `particular:garden-${spec.room}`,
      variation: {
        preserved: [
          "verified source mineral",
          "local choice",
          "invitation-only consequence"
        ],
        varied: [
          `root mineral becomes ${spec.fact} work`
        ],
        introduced: [
          `${spec.fact} descendant mineral WANT`
        ],
        retired: []
      },
      note: `Fork Garden ${spec.room} branch opens independently.`,
      created_at: `2026-10-05T21:12:2${index}.000Z`
    });

    const mine = runBridge([
      "mine-native",
      "--root", resolve(base, `worker-${spec.key}`),
      "--capability", want.request.capability,
      "--payload", JSON.stringify(want.request.payload)
    ]);
    assert.equal(mine.verification.status, "OK");

    const providerRoot = resolve(base, `provider-${spec.key}`);
    const stored = await storeNativeMine(providerRoot, mine);
    const ancestry = makeDescendantMineralAncestry({
      want,
      sourceTrace: local.trace,
      actionReceipt: acted.receipt,
      responseTrace: response
    });
    const childSeed = makeMineralWorldSeed({
      mineralId: mine.mineral_id,
      capability: mine.capability,
      workAddress: mine.work_address,
      artifactAddress: stored.artifactStored.address,
      artifactMediaType:
        mine.capability === "mineral.fractal.tile/v0"
          ? "image/x-portable-graymap"
          : "application/json",
      sourceResultAddress: stored.resultStored.address,
      verification: {
        verifier: "GHoT exact recompute",
        status: "OK",
        claimScope: mine.verification.claim_scope,
        receiptAddress: stored.verificationStored.address
      },
      ancestry,
      createdAt: `2026-10-05T21:13:0${index}.000Z`
    });
    const addressedChild = addressMineralWorldSeed(childSeed);
    const storedSeed = await writeAddressedJson(providerRoot, childSeed);
    assert.equal(storedSeed.address, addressedChild.address);

    const draft = relatte.buildCulturalDescendantDraft({
      uptake,
      descendant_payload_ref: {
        address: addressedChild.address,
        media_type: GRO_MINERAL_WORLD_SEED_MEDIA_TYPE
      },
      created_at: `2026-10-05T21:13:1${index}.000Z`
    });
    const childCrossing = await relatte.sealCrossingEnvelope(
      draft,
      await relatte.generateP256KeyPair()
    );
    assert.equal(
      await relatte.verifyCulturalDescendant({
        ancestor_crossing: sourceCrossing,
        admitted_receipt: sourceAdmit,
        field_projection: projection,
        uptake,
        descendant_crossing: childCrossing
      }),
      true
    );

    const childWorld = `world:branch-${spec.key}`;
    const childReceiver = await relatte.LocalReceiver.create(
      resolve(base, `child-room-${spec.key}`),
      {
        world_id: childWorld,
        receiver_particular: `receiver:branch-${spec.key}`,
        contract_ref: "contract:gro-mineral-descendant/v0"
      }
    );
    await childReceiver.receive(
      childCrossing,
      `2026-10-05T21:13:2${index}.000Z`
    );
    const childAdmit = await childReceiver.dispose(
      childCrossing.crossing_id,
      "ADMIT",
      `2026-10-05T21:13:3${index}.000Z`,
      { admit_effect: `fork-garden-branch-${spec.key}` }
    );

    const childLocal = await interpretMineralWorldSeedArrival({
      crossing: childCrossing,
      dispositionReceipt: childAdmit,
      destination: {
        worldId: childWorld,
        placeId: `place:branch-${spec.key}`
      },
      resolvePayloadBytes: resolver(providerRoot),
      resolveArtifactBytes: resolver(providerRoot),
      resolveResultBytes: resolver(providerRoot),
      verifyMineralEvidence: verifyNative,
      verifyDescendantLineage: () =>
        relatte.verifyCulturalDescendant({
          ancestor_crossing: sourceCrossing,
          admitted_receipt: sourceAdmit,
          field_projection: projection,
          uptake,
          descendant_crossing: childCrossing
        }),
      localRules: {
        label: `Verified ${spec.fact} branch descendant.`,
        actions: []
      }
    });
    assert.equal(childLocal.verifiedSeed.lineageVerified, true);

    const checkpoint = await checkpointMineral({
      verifiedSeed: childLocal.verifiedSeed,
      subjectCrossing: childCrossing,
      predecessorCheckpoint: rootCheckpoint,
      world: `world:checkpoint-${spec.key}`,
      tag: `branch-${spec.key}`,
      createdAt: `2026-10-05T21:14:0${index}.000Z`
    });
    assert.equal(checkpoint.checkpoint.generation, 2);
    assert.equal(
      checkpoint.checkpoint.previousLineageRoot,
      rootCheckpoint.checkpoint.lineageRoot
    );

    return {
      ...spec,
      sourceAdmit,
      local,
      acted,
      response,
      want,
      projection,
      uptake,
      mine,
      providerRoot,
      childSeed,
      addressedChild,
      childCrossing,
      childAdmit,
      childLocal,
      checkpoint
    };
  }

  const branches = [];
  for (let index = 0; index < branchSpecs.length; index += 1) {
    branches.push(await growBranch(branchSpecs[index], index));
  }

  assert.deepEqual(
    branches.map((branch) => branch.mine.capability).sort(),
    [
      "mineral.fractal.tile/v0",
      "mineral.optimization.landscape/v0",
      "mineral.procedural-world.chunk/v0"
    ]
  );

  // ---------------------------------------------------------------------
  // TENET 010: all three verified Mineral descendants are one lawful fork.
  // ---------------------------------------------------------------------
  const gardenFork = observeCheckpointFork({
    verifiedCheckpoints: branches.map((branch) => branch.checkpoint)
  });
  assert.equal(gardenFork.branches.length, 3);
  assert.equal(gardenFork.conflict, false);
  assert.equal(gardenFork.canonicalBranchId, null);

  const candidates = branches.map((branch) => ({
    checkpointId: branch.checkpoint.checkpoint.checkpointId,
    facts: {
      mineralClass: branch.fact
    }
  }));
  const coexist = projectForkLocally({
    fork: gardenFork,
    candidates
  });
  assert.equal(coexist.eligibleBranchIds.length, 3);
  assert.equal(coexist.localConflict, false);

  const exclusive = projectForkLocally({
    fork: gardenFork,
    candidates,
    localRule: {
      kind: "exclusive-key",
      key: "mineralClass"
    }
  });
  assert.equal(exclusive.localConflict, true);
  assert.equal(exclusive.canonicalBranchId, null);
  assert.equal(exclusive.heldBranchIds.length, 3);

  // ---------------------------------------------------------------------
  // TENET 011: one locality recombines only A+B. C remains a lawful sibling.
  // ---------------------------------------------------------------------
  const pair = branches.slice(0, 2);
  const pairFork = observeCheckpointFork({
    verifiedCheckpoints: pair.map((branch) => branch.checkpoint)
  });
  const pairProjection = projectForkLocally({
    fork: pairFork,
    candidates: pair.map((branch) => ({
      checkpointId: branch.checkpoint.checkpoint.checkpointId,
      facts: { mineralClass: branch.fact }
    }))
  });
  assert.equal(pairProjection.eligibleBranchIds.length, 2);

  const composerWorld = "world:fork-garden-composer";
  const composer = await relatte.LocalReceiver.create(
    resolve(base, "composer-room"),
    {
      world_id: composerWorld,
      receiver_particular: "receiver:fork-garden-composer",
      contract_ref: "contract:fork-garden-composer/v0"
    }
  );

  const pairAdmissions = [];
  for (let i = 0; i < pair.length; i += 1) {
    const branch = pair[i];
    await composer.receive(
      branch.childCrossing,
      `2026-10-05T21:15:0${i}.000Z`
    );
    pairAdmissions.push(
      await composer.dispose(
        branch.childCrossing.crossing_id,
        "ADMIT",
        `2026-10-05T21:15:1${i}.000Z`,
        { admit_effect: `fork-garden-parent-${branch.key}` }
      )
    );
  }

  const parentBefore = pair.map((branch) =>
    stableStringify(branch.childCrossing)
  );
  const siblingBefore = stableStringify(branches[2].childCrossing);

  const recombinant = makeRecombinationWorldSeed({
    fork: pairFork,
    localProjection: pairProjection,
    parentAdmissions: pairAdmissions,
    worldId: composerWorld,
    placeId: "place:fork-garden-hybrid",
    actorId: "actor:fork-garden-composer",
    occurredAt: "2026-10-05T21:15:30.000Z",
    composition: {
      parents: [
        {
          checkpointId: pair[0].checkpoint.checkpoint.checkpointId,
          preserved: [
            "optimization branch remains independently attributable"
          ],
          varied: [
            "optimization structure becomes a constraint grammar for terrain"
          ],
          retired: []
        },
        {
          checkpointId: pair[1].checkpoint.checkpoint.checkpointId,
          preserved: [
            "procedural-world branch remains independently attributable"
          ],
          varied: [
            "terrain cells become carriers for optimization structure"
          ],
          retired: []
        }
      ],
      introduced: [
        "an optimization-shaped terrain invitation"
      ]
    },
    descendantTenet: {
      seedId: "tenet-seed:fork-garden-hybrid",
      label: "Two Mineral branches compose without becoming the only branch.",
      offeredActionLabel: "Enter the optimization-shaped terrain",
      requiredHeldKind: null,
      authorId: "actor:fork-garden-composer",
      authorControl: false
    }
  });
  const addressedRecombinant = addressRecombinationWorldSeed(recombinant);
  const recombinantDraft = makeRecombinationCrossingDraft({
    seed: recombinant,
    payloadAddress: addressedRecombinant.address,
    sourceHistoryHead: composer.snapshot().history_head,
    createdAt: "2026-10-05T21:15:31.000Z"
  });
  const recombinantCrossing = await relatte.sealCrossingEnvelope(
    recombinantDraft,
    await relatte.generateP256KeyPair()
  );
  const verifiedRecombinant = await verifyRecombinationWorldSeed({
    bytes: addressedRecombinant.bytes,
    expectedAddress: addressedRecombinant.address,
    crossing: recombinantCrossing,
    verifyRelatteCrossing: (value) =>
      relatte.verifyCrossingEnvelope(value),
    verifyRelatteReceipt: (value) =>
      relatte.verifyReceipt(value)
  });

  assert.equal(verifiedRecombinant.recombinationVerified, true);
  assert.equal(verifiedRecombinant.canonicalizesParents, false);
  assert.equal(verifiedRecombinant.erasesParents, false);
  assert.deepEqual(
    recombinantCrossing.parents,
    pair.map((branch) => branch.childCrossing.crossing_id).sort()
  );
  assert.equal(
    recombinantCrossing.parents.includes(
      branches[2].childCrossing.crossing_id
    ),
    false
  );

  assert.deepEqual(
    pair.map((branch) => stableStringify(branch.childCrossing)),
    parentBefore
  );
  assert.equal(
    stableStringify(branches[2].childCrossing),
    siblingBefore
  );

  // The recombination remains a fresh invitation requiring its own local ADMIT.
  const hybridReceiver = await relatte.LocalReceiver.create(
    resolve(base, "hybrid-room"),
    {
      world_id: "world:fork-garden-hybrid",
      receiver_particular: "receiver:fork-garden-hybrid",
      contract_ref: "contract:fork-garden-hybrid/v0"
    }
  );
  await hybridReceiver.receive(
    recombinantCrossing,
    "2026-10-05T21:15:40.000Z"
  );
  const hybridAdmit = await hybridReceiver.dispose(
    recombinantCrossing.crossing_id,
    "ADMIT",
    "2026-10-05T21:15:41.000Z",
    { admit_effect: "fork-garden-hybrid-candidate" }
  );
  const hybridTrace = localizeRecombinationWorldSeed({
    verifiedSeed: verifiedRecombinant,
    crossing: recombinantCrossing,
    dispositionReceipt: hybridAdmit,
    destination: {
      worldId: "world:fork-garden-hybrid",
      placeId: "place:fork-garden-hybrid"
    },
    localRules: {
      label: "Two branches became a third invitation; the fractal sibling remains.",
      offeredActionLabel: "Enter the hybrid",
      requiredHeldKind: null
    }
  });
  const hybridField = resolveField({
    place: { id: "place:fork-garden-hybrid" },
    actor: { id: "actor:hybrid", held: [] },
    traces: [hybridTrace]
  });
  assert.ok(
    hybridField.affordances.some((item) =>
      item.id.startsWith("through-tenet:")
    )
  );

  // ---------------------------------------------------------------------
  // TENET 012: compact only the two recombined parent roots into a frontier.
  // ---------------------------------------------------------------------
  const frontierCommitment = await relatte.createReceiptSetCommitment({
    world_id: composerWorld,
    local_history_head: composer.snapshot().history_head,
    receipts: pairAdmissions,
    created_at: "2026-10-05T21:16:00.000Z"
  });
  const frontierCheckpoint = createGraphFrontierCheckpoint({
    verifiedRecombination: verifiedRecombinant,
    subjectCrossing: recombinantCrossing,
    verifiedParentCheckpoints: pair.map((branch) => branch.checkpoint),
    localReceiptSetCommitment: frontierCommitment,
    checkpointWorldId: composerWorld,
    createdAt: "2026-10-05T21:16:01.000Z"
  });
  const addressedFrontier = addressGraphFrontierCheckpoint(
    frontierCheckpoint
  );
  const frontierDraft = makeGraphFrontierCheckpointDraft({
    checkpoint: frontierCheckpoint,
    checkpointAddress: addressedFrontier.address,
    sourceParticular: "receiver:fork-garden-composer",
    createdAt: "2026-10-05T21:16:02.000Z"
  });
  const frontierCrossing = await relatte.sealCrossingEnvelope(
    frontierDraft,
    await relatte.generateP256KeyPair()
  );
  const verifiedFrontier = await verifyGraphFrontierCheckpoint({
    bytes: addressedFrontier.bytes,
    expectedAddress: addressedFrontier.address,
    checkpointCrossing: frontierCrossing,
    verifyRelatteCrossing: (value) =>
      relatte.verifyCrossingEnvelope(value),
    verifyReceiptSetCommitmentShape: (value) =>
      relatte.verifyReceiptSetCommitmentShape(value)
  });
  assert.equal(verifiedFrontier.graphFrontierVerified, true);
  assert.equal(verifiedFrontier.parentCount, 2);

  const frontierParentIds = new Set(
    frontierCheckpoint.parentFrontier.map(
      (anchor) => anchor.checkpointId
    )
  );
  assert.equal(
    frontierParentIds.has(branches[0].checkpoint.checkpoint.checkpointId),
    true
  );
  assert.equal(
    frontierParentIds.has(branches[1].checkpoint.checkpoint.checkpointId),
    true
  );
  assert.equal(
    frontierParentIds.has(branches[2].checkpoint.checkpoint.checkpointId),
    false
  );

  console.log(JSON.stringify({
    schema: "gro.fork-garden-001-witness.v0",
    root: {
      mineral_id: sourceMine.mineral_id,
      capability: sourceMine.capability,
      seed_address: addressedSource.address,
      checkpoint_id: rootCheckpoint.checkpoint.checkpointId,
      generation: rootCheckpoint.checkpoint.generation
    },
    garden: {
      branch_count: gardenFork.branches.length,
      canonical_branch_id: gardenFork.canonicalBranchId,
      global_conflict: gardenFork.conflict,
      local_coexistence_count: coexist.eligibleBranchIds.length,
      local_exclusive_conflict: exclusive.localConflict,
      exclusive_created_global_canon: false
    },
    branches: branches.map((branch) => ({
      key: branch.key,
      capability: branch.mine.capability,
      want_id: branch.want.wantId,
      crossing_id: branch.childCrossing.crossing_id,
      checkpoint_id: branch.checkpoint.checkpoint.checkpointId,
      lineage_root: branch.checkpoint.checkpoint.lineageRoot,
      generation: branch.checkpoint.checkpoint.generation
    })),
    recombination: {
      parent_count: verifiedRecombinant.parentCount,
      parent_crossings: recombinantCrossing.parents,
      third_sibling_crossing: branches[2].childCrossing.crossing_id,
      third_sibling_inherited: false,
      canonicalizes_parents: verifiedRecombinant.canonicalizesParents,
      erases_parents: verifiedRecombinant.erasesParents,
      playable_after_fresh_admit: true
    },
    graph_frontier: {
      checkpoint_id: frontierCheckpoint.checkpointId,
      graph_root: frontierCheckpoint.graphRoot,
      parent_count: verifiedFrontier.parentCount,
      bounded_parent_checkpoint_ids: [
        ...frontierParentIds
      ].sort(),
      third_sibling_pruned_or_erased: false
    },
    loop: [
      "ONE VERIFIED MINERAL",
      "THREE LOCAL CONSEQUENCES",
      "THREE MINERAL WANTS",
      "THREE GHOT MINES",
      "THREE VERIFIED DESCENDANTS",
      "NONCANONICAL FORK",
      "TWO-BRANCH RECOMBINATION",
      "BOUNDED GRAPH FRONTIER"
    ],
    laws: [
      "FORK != CONFLICT",
      "LOCAL PROJECTION != GLOBAL CANON",
      "COMPOSITION != CANONIZATION",
      "MERGE != ERASURE",
      "MULTI-PARENT ANCESTRY != SHARED AUTHORITY",
      "UNCOMPOSED SIBLING != REJECTED HISTORY",
      "FRONTIER != HISTORY"
    ]
  }, null, 2));
} finally {
  await rm(base, { recursive: true, force: true });
}
