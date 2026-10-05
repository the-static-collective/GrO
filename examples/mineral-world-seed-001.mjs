import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
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
  writeAddressedBytes,
  writeAddressedJson
} from "../src/payload-store.js";
import {
  closeHttpContentProvider,
  createHttpContentProviderServer,
  fileContentProvider,
  httpContentProvider,
  listenHttpContentProvider,
  retrieveFromProviders
} from "../src/content-road.js";

const relatteRoot = resolve(process.argv[2] ?? ".deps/reLATTE");
const ghotRoot = resolve(process.argv[3] ?? ".deps/GHoT");
const dogramRoot = resolve(process.argv[4] ?? ".deps/Dogram");
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

async function writeEvidenceInput(base, label, resultBytes, artifactBytes, ext) {
  const root = resolve(base, `verify-${label}`);
  await mkdir(root, { recursive: true });
  const resultPath = resolve(root, "result.json");
  const artifactPath = resolve(root, `artifact.${ext}`);
  await writeFile(resultPath, resultBytes);
  await writeFile(artifactPath, artifactBytes);
  return { resultPath, artifactPath };
}

function providerResolver(provider) {
  return async (address) =>
    (await retrieveFromProviders(address, [provider])).bytes;
}

const base = await mkdtemp(resolve(tmpdir(), "gro-mineral-world-seed-001-"));
const sourceWorker = resolve(base, "ghot-source-worker");
const childWorker = resolve(base, "ghot-child-worker");
const sourceA = resolve(base, "source-provider-a");
const sourceB = resolve(base, "source-provider-b");
const childProviderRoot = resolve(base, "child-provider");
const sourceHttpServer = createHttpContentProviderServer({ root: sourceB });

try {
  // -----------------------------------------------------------------------
  // 1. GHoT mines a real Dogram-verified mineral.
  // -----------------------------------------------------------------------
  const sourceMine = runBridge([
    "mine-ice",
    "--root", sourceWorker,
    "--dogram-repo", dogramRoot,
    "--lucas-index", "2",
    "--width", "12",
    "--height", "12",
    "--max-halley-iter", "8"
  ]);
  assert.equal(sourceMine.verification.status, "OK");

  const sourceResult = JSON.parse(
    await readFile(sourceMine.result_path, "utf8")
  );
  const sourceArtifactBytes = await readFile(sourceMine.artifact_path);
  const sourceVerificationReceipt = sourceMine.verification.receipt;

  const sourceResultA = await writeAddressedJson(sourceA, sourceResult);
  const sourceResultB = await writeAddressedJson(sourceB, sourceResult);
  const sourceArtifactA = await writeAddressedBytes(
    sourceA,
    sourceArtifactBytes
  );
  const sourceArtifactB = await writeAddressedBytes(
    sourceB,
    sourceArtifactBytes
  );
  const sourceVerificationA = await writeAddressedJson(
    sourceA,
    sourceVerificationReceipt
  );
  const sourceVerificationB = await writeAddressedJson(
    sourceB,
    sourceVerificationReceipt
  );
  assert.equal(sourceResultA.address, sourceResultB.address);
  assert.equal(sourceArtifactA.address, sourceArtifactB.address);
  assert.equal(sourceVerificationA.address, sourceVerificationB.address);
  assert.equal(sourceArtifactA.address, sourceMine.artifact_address);

  const sourceSeed = makeMineralWorldSeed({
    mineralId: sourceMine.mineral_id,
    capability: sourceMine.capability,
    workAddress: sourceMine.work_address,
    artifactAddress: sourceArtifactA.address,
    artifactMediaType: "image/x-portable-graymap",
    sourceResultAddress: sourceResultA.address,
    verification: {
      verifier: "Dogram",
      status: "OK",
      claimScope: sourceMine.verification.claim_scope,
      receiptAddress: sourceVerificationA.address
    },
    createdAt: "2026-10-05T19:30:00.000Z"
  });

  const addressedSourceSeed = addressMineralWorldSeed(sourceSeed);
  const storedSeedA = await writeAddressedJson(sourceA, sourceSeed);
  const storedSeedB = await writeAddressedJson(sourceB, sourceSeed);
  assert.equal(storedSeedA.address, addressedSourceSeed.address);
  assert.equal(storedSeedB.address, addressedSourceSeed.address);

  // -----------------------------------------------------------------------
  // 2. reLATTE carries the addressed mineral without deciding its meaning.
  // -----------------------------------------------------------------------
  const sourceSpec = makeMineralWorldSeedTransferSpec({
    seed: sourceSeed,
    payloadAddress: addressedSourceSeed.address,
    sourceWorld: "world:ghot-mineral-field",
    sourceParticular: "particular:ghot-miner",
    sourceHistoryHead: "history:mineral-field:world-seed-001",
    createdAt: "2026-10-05T19:30:01.000Z"
  });
  const sourceCrossing = await relatte.sealOpaqueOrganCrossing(
    sourceSpec,
    await relatte.generateP256KeyPair()
  );
  assert.equal(
    await relatte.verifyOpaqueOrganCrossing(sourceCrossing),
    true
  );

  const mathReceiver = await relatte.LocalReceiver.create(
    resolve(base, "math-receiver"),
    {
      world_id: "world:gro-math-room",
      receiver_particular: "receiver:gro-math-room",
      contract_ref: "contract:gro-mineral/v0"
    }
  );
  const terrainReceiver = await relatte.LocalReceiver.create(
    resolve(base, "terrain-receiver"),
    {
      world_id: "world:gro-terrain-room",
      receiver_particular: "receiver:gro-terrain-room",
      contract_ref: "contract:gro-mineral/v0"
    }
  );

  await mathReceiver.receive(sourceCrossing, "2026-10-05T19:30:02.000Z");
  const admitMath = await mathReceiver.dispose(
    sourceCrossing.crossing_id,
    "ADMIT",
    "2026-10-05T19:30:03.000Z",
    {
      note: "Math Room admits verified mineral candidate",
      admit_effect: "gro-mineral-candidate"
    }
  );
  await terrainReceiver.receive(sourceCrossing, "2026-10-05T19:30:04.000Z");
  const admitTerrain = await terrainReceiver.dispose(
    sourceCrossing.crossing_id,
    "ADMIT",
    "2026-10-05T19:30:05.000Z",
    {
      note: "Terrain Room admits same verified mineral candidate",
      admit_effect: "gro-mineral-candidate"
    }
  );

  const sourceHttpUrl = await listenHttpContentProvider(sourceHttpServer);
  const providerA = fileContentProvider({
    id: "provider:source-file",
    root: sourceA
  });
  const providerB = httpContentProvider({
    id: "provider:source-http",
    baseUrl: sourceHttpUrl
  });

  let verifyCounter = 0;
  async function verifyIceEvidence({ resultBytes, artifactBytes }) {
    verifyCounter += 1;
    const inputs = await writeEvidenceInput(
      base,
      `ice-${verifyCounter}`,
      resultBytes,
      artifactBytes,
      "pgm"
    );
    const verified = runBridge([
      "verify-ice",
      "--result", inputs.resultPath,
      "--artifact", inputs.artifactPath,
      "--dogram-repo", dogramRoot
    ]);
    return {
      status: verified.status,
      claimScope: verified.claim_scope,
      receipt: verified.receipt
    };
  }

  // -----------------------------------------------------------------------
  // 3. Same seed, different sovereign local consequences.
  // -----------------------------------------------------------------------
  const mathLocal = await interpretMineralWorldSeedArrival({
    crossing: sourceCrossing,
    dispositionReceipt: admitMath,
    destination: {
      worldId: "world:gro-math-room",
      placeId: "place:math-table"
    },
    resolvePayloadBytes: providerResolver(providerA),
    resolveArtifactBytes: providerResolver(providerA),
    resolveResultBytes: providerResolver(providerA),
    verifyMineralEvidence: verifyIceEvidence,
    localRules: {
      label: "A verified topology mineral opens adjacent dynamics.",
      actions: [
        {
          id: "seek-dynamics",
          label: "Mine a nearby exact parameter sweep",
          effect: "opens-descendant-mineral-want",
          descendantMineralRequest: {
            capability: "mineral.parameter-sweep/v0",
            payload: {
              r_values: ["3", "13/4", "7/2", "15/4"],
              x0: "1/2",
              steps: 9
            }
          }
        }
      ]
    }
  });

  const terrainLocal = await interpretMineralWorldSeedArrival({
    crossing: sourceCrossing,
    dispositionReceipt: admitTerrain,
    destination: {
      worldId: "world:gro-terrain-room",
      placeId: "place:terrain-table"
    },
    resolvePayloadBytes: providerResolver(providerB),
    resolveArtifactBytes: providerResolver(providerB),
    resolveResultBytes: providerResolver(providerB),
    verifyMineralEvidence: verifyIceEvidence,
    localRules: {
      label: "The same verified topology mineral reads as terrain.",
      actions: [
        {
          id: "terrain-door",
          label: "Use the mineral as a terrain grammar",
          effect: "creative-terrain-door"
        }
      ]
    }
  });

  assert.equal(
    mathLocal.trace.mineral.seedAddress,
    terrainLocal.trace.mineral.seedAddress
  );
  assert.equal(
    mathLocal.trace.mineral.artifactAddress,
    terrainLocal.trace.mineral.artifactAddress
  );
  assert.notDeepEqual(
    mathLocal.trace.mineral.actions,
    terrainLocal.trace.mineral.actions
  );

  // Provider A dies; the same addressed seed/result/artifact still resolves
  // from an independent road.
  await rm(sourceA, { recursive: true, force: true });
  const fallbackSeed = await retrieveFromProviders(
    addressedSourceSeed.address,
    [providerA, providerB]
  );
  assert.equal(fallbackSeed.providerId, "provider:source-http");

  // -----------------------------------------------------------------------
  // 4. A human/player acts through the Math Room consequence.
  // -----------------------------------------------------------------------
  const actorMath = { id: "actor:gro-math-player", held: [] };
  const fieldMath = resolveField({
    place: { id: "place:math-table" },
    actor: actorMath,
    traces: [mathLocal.trace]
  });
  const throughMineral = fieldMath.affordances.find(
    (item) => item.mineralActionId === "seek-dynamics"
  );
  assert.ok(throughMineral);

  const acted = act({
    place: { id: "place:math-table" },
    actor: actorMath,
    field: fieldMath,
    actionId: throughMineral.id,
    occurredAt: "2026-10-05T19:31:00.000Z",
    traces: [mathLocal.trace]
  });
  const response = acted.traces.at(-1);
  assert.equal(response.kind, "mineral-response");

  const want = makeDescendantMineralWant({
    sourceTrace: mathLocal.trace,
    actionReceipt: acted.receipt,
    responseTrace: response
  });
  assert.equal(verifyMineralWant(want), true);
  assert.equal(want.authority, null);
  assert.equal(want.executable, false);

  // reLATTE records the local consequence that led to the new candidate.
  const lens = relatte.sealFieldLens({
    schema: "relatte.field-lens/v0",
    world_id: "world:gro-math-room",
    title: "GrO Mineral consequence field",
    channels: [
      {
        name: "growth",
        weights: {
          admitted_receipts: 1,
          admitted_descendants: 1
        }
      }
    ],
    created_at: "2026-10-05T19:31:01.000Z",
    laws: [
      "LENS != HISTORY",
      "LOCAL CONSEQUENCE != UNIVERSAL VALUE"
    ]
  });
  const projection = await relatte.projectField({
    lens,
    admitted_receipts: [admitMath]
  });
  const uptake = await relatte.createCulturalUptake({
    ancestor_crossing: sourceCrossing,
    admitted_receipt: admitMath,
    field_projection: projection,
    world_id: "world:gro-math-room",
    local_particular: "particular:gro-math-player",
    variation: {
      preserved: [
        "verified mineral identity",
        "local choice",
        "invitation-only consequence"
      ],
      varied: [
        "topology encounter becomes an exact parameter-sweep request"
      ],
      introduced: [
        "descendant mineral WANT"
      ],
      retired: [
        "dependence on one content road"
      ]
    },
    note: "A GrO action opens a bounded descendant Mineral request.",
    created_at: "2026-10-05T19:31:02.000Z"
  });

  // -----------------------------------------------------------------------
  // 5. GHoT actually mines the descendant WANT and exactly verifies it.
  // -----------------------------------------------------------------------
  const childMine = runBridge([
    "mine-native",
    "--root", childWorker,
    "--capability", want.request.capability,
    "--payload", JSON.stringify(want.request.payload)
  ]);
  assert.equal(childMine.verification.status, "OK");

  const childResult = JSON.parse(
    await readFile(childMine.result_path, "utf8")
  );
  const childArtifactBytes = await readFile(childMine.artifact_path);
  const childVerificationReceipt = childMine.verification;

  const childResultStored = await writeAddressedJson(
    childProviderRoot,
    childResult
  );
  const childArtifactStored = await writeAddressedBytes(
    childProviderRoot,
    childArtifactBytes
  );
  const childVerificationStored = await writeAddressedJson(
    childProviderRoot,
    childVerificationReceipt
  );

  const ancestry = makeDescendantMineralAncestry({
    want,
    sourceTrace: mathLocal.trace,
    actionReceipt: acted.receipt,
    responseTrace: response
  });

  const childSeed = makeMineralWorldSeed({
    mineralId: childMine.mineral_id,
    capability: childMine.capability,
    workAddress: childMine.work_address,
    artifactAddress: childArtifactStored.address,
    artifactMediaType: "application/json",
    sourceResultAddress: childResultStored.address,
    verification: {
      verifier: "GHoT exact recompute",
      status: "OK",
      claimScope: childVerificationReceipt.claim_scope,
      receiptAddress: childVerificationStored.address
    },
    ancestry,
    createdAt: "2026-10-05T19:32:00.000Z"
  });
  const addressedChild = addressMineralWorldSeed(childSeed);
  const storedChildSeed = await writeAddressedJson(
    childProviderRoot,
    childSeed
  );
  assert.equal(storedChildSeed.address, addressedChild.address);

  const childDraft = relatte.buildCulturalDescendantDraft({
    uptake,
    descendant_payload_ref: {
      address: addressedChild.address,
      media_type: GRO_MINERAL_WORLD_SEED_MEDIA_TYPE
    },
    created_at: "2026-10-05T19:32:01.000Z"
  });
  const childCrossing = await relatte.sealCrossingEnvelope(
    childDraft,
    await relatte.generateP256KeyPair()
  );
  assert.equal(
    await relatte.verifyCulturalDescendant({
      ancestor_crossing: sourceCrossing,
      admitted_receipt: admitMath,
      field_projection: projection,
      uptake,
      descendant_crossing: childCrossing
    }),
    true
  );

  // Ancestor roads can now disappear entirely. The descendant has its own road.
  await closeHttpContentProvider(sourceHttpServer);
  await rm(sourceB, { recursive: true, force: true });

  // -----------------------------------------------------------------------
  // 6. A third locality receives the genuinely mined descendant.
  // -----------------------------------------------------------------------
  const childReceiver = await relatte.LocalReceiver.create(
    resolve(base, "child-receiver"),
    {
      world_id: "world:gro-descendant-room",
      receiver_particular: "receiver:gro-descendant-room",
      contract_ref: "contract:gro-mineral-descendant/v0"
    }
  );
  await childReceiver.receive(childCrossing, "2026-10-05T19:33:00.000Z");
  const admitChild = await childReceiver.dispose(
    childCrossing.crossing_id,
    "ADMIT",
    "2026-10-05T19:33:01.000Z",
    {
      note: "Descendant room admits mined Mineral descendant",
      admit_effect: "gro-mineral-descendant-candidate"
    }
  );

  const childProvider = fileContentProvider({
    id: "provider:child-new-road",
    root: childProviderRoot
  });

  let nativeVerifyCounter = 0;
  async function verifyNativeEvidence({ resultBytes, artifactBytes }) {
    nativeVerifyCounter += 1;
    const inputs = await writeEvidenceInput(
      base,
      `native-${nativeVerifyCounter}`,
      resultBytes,
      artifactBytes,
      "json"
    );
    const receipt = runBridge([
      "verify-native",
      "--result", inputs.resultPath,
      "--artifact", inputs.artifactPath
    ]);
    return {
      status: receipt.status,
      claimScope: receipt.claim_scope,
      receipt
    };
  }

  const childLocal = await interpretMineralWorldSeedArrival({
    crossing: childCrossing,
    dispositionReceipt: admitChild,
    destination: {
      worldId: "world:gro-descendant-room",
      placeId: "place:descendant-table"
    },
    resolvePayloadBytes: providerResolver(childProvider),
    resolveArtifactBytes: providerResolver(childProvider),
    resolveResultBytes: providerResolver(childProvider),
    verifyMineralEvidence: verifyNativeEvidence,
    verifyDescendantLineage: () =>
      relatte.verifyCulturalDescendant({
        ancestor_crossing: sourceCrossing,
        admitted_receipt: admitMath,
        field_projection: projection,
        uptake,
        descendant_crossing: childCrossing
      }),
    localRules: {
      label: "A mined descendant sweep arrived after its ancestor roads died.",
      actions: [
        {
          id: "notice-sweep",
          label: "Read the new dynamical trace",
          effect: "descendant-mineral-play"
        }
      ]
    }
  });

  const childField = resolveField({
    place: { id: "place:descendant-table" },
    actor: { id: "actor:descendant", held: [] },
    traces: [childLocal.trace]
  });
  assert.ok(
    childField.affordances.some(
      (item) => item.mineralActionId === "notice-sweep"
    )
  );

  console.log(JSON.stringify({
    schema: "gro.mineral-world-seed-001-witness.v0",
    source: {
      mineral_id: sourceMine.mineral_id,
      capability: sourceMine.capability,
      seed_address: addressedSourceSeed.address,
      artifact_address: sourceMine.artifact_address,
      dogram_status: sourceMine.verification.status,
      replaceable_roads: 2,
      original_roads_alive_at_end: 0
    },
    locality_divergence: {
      math_trace_id: mathLocal.trace.traceId,
      terrain_trace_id: terrainLocal.trace.traceId,
      same_seed: (
        mathLocal.trace.mineral.seedAddress ===
        terrainLocal.trace.mineral.seedAddress
      ),
      math_action: "seek-dynamics",
      terrain_action: "terrain-door"
    },
    action_to_work: {
      occurrence_receipt: acted.receipt.receiptId,
      want_id: want.wantId,
      want_authority: want.authority,
      want_executable: want.executable,
      requested_capability: want.request.capability
    },
    descendant: {
      mineral_id: childMine.mineral_id,
      capability: childMine.capability,
      seed_address: addressedChild.address,
      artifact_address: childMine.artifact_address,
      verification_status: childMine.verification.status,
      parent_crossing_id: childCrossing.parents[0],
      lineage_verified: true,
      ancestor_roads_required: false,
      playable_in_new_locality: true
    },
    loop: [
      "PLAY",
      "LOCAL CONSEQUENCE",
      "MINERAL WANT",
      "GHOT COMPUTE",
      "VERIFICATION",
      "RELATTE DESCENDANT",
      "GRO PLAY"
    ],
    laws: [
      "MINERAL != CONSEQUENCE",
      "SAME SEED != SAME LOCAL AFFORDANCE",
      "CONSEQUENCE != EXECUTION",
      "WANT != AUTHORIZATION",
      "VERIFICATION != ADMISSION",
      "ANCESTRY != AUTHORITY",
      "DESCENDANT ROAD != ANCESTOR ROAD"
    ]
  }, null, 2));
} finally {
  if (sourceHttpServer.listening) {
    await closeHttpContentProvider(sourceHttpServer);
  }
  await rm(base, { recursive: true, force: true });
}
