import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { act, resolveField } from "../src/field.js";
import {
  addressMineralWorldSeed,
  interpretMineralWorldSeedArrival,
  makeDescendantMineralWant,
  makeMineralWorldSeed,
  makeMineralWorldSeedTransferSpec,
  verifyMineralWant
} from "../src/mineral-world-seed.js";
import { addressJson } from "../src/payload-store.js";
import { stableStringify } from "../src/stable.js";

function addressBytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fixture() {
  const artifactBytes = Buffer.from("mineral-artifact-v0");
  const artifactAddress = addressBytes(artifactBytes);
  const result = {
    kind: "ghot.mineral-result",
    version: "0",
    capability: "mineral.parameter-sweep/v0",
    work_address: "sha256:" + "1".repeat(64),
    artifact_address: artifactAddress
  };
  const resultAddressed = addressJson(result);
  const verificationReceipt = {
    kind: "ghot.mineral-native-verification",
    version: "0",
    status: "OK",
    claim_scope: "deterministic-exact-recompute/v0",
    work_address: result.work_address,
    artifact_address: artifactAddress
  };
  const verificationAddress = addressJson(verificationReceipt).address;

  const seed = makeMineralWorldSeed({
    mineralId: "science.parameter-sweep/v0",
    capability: "mineral.parameter-sweep/v0",
    workAddress: result.work_address,
    artifactAddress,
    artifactMediaType: "application/json",
    sourceResultAddress: resultAddressed.address,
    verification: {
      verifier: "GHoT exact recompute",
      status: "OK",
      claimScope: verificationReceipt.claim_scope,
      receiptAddress: verificationAddress
    },
    createdAt: "2026-10-05T20:00:00Z"
  });
  const addressed = addressMineralWorldSeed(seed);
  const spec = makeMineralWorldSeedTransferSpec({
    seed,
    payloadAddress: addressed.address,
    sourceWorld: "world:source",
    sourceParticular: "particular:source",
    createdAt: "2026-10-05T20:00:01Z"
  });
  const crossing = {
    crossing_id: "crossing:mineral:001",
    source_world: spec.source_world,
    parents: [],
    payload_refs: spec.payload_refs,
    extensions: {
      organ_adapter: {
        family_ref: spec.family_ref,
        donor_claims: spec.donor_claims
      }
    }
  };
  const receipt = {
    crossing_id: crossing.crossing_id,
    world_id: "world:local",
    receiver_particular: "receiver:local",
    contract_ref: "contract:local/v0",
    kind: "R3_ADMIT",
    receipt_id: "receipt:local:mineral"
  };

  return {
    artifactBytes,
    result,
    resultBytes: resultAddressed.bytes,
    verificationReceipt,
    seed,
    addressed,
    crossing,
    receipt
  };
}

test("same verified mineral seed may project different local affordances", async () => {
  const f = fixture();
  const common = {
    crossing: f.crossing,
    dispositionReceipt: f.receipt,
    resolvePayloadBytes: async () => f.addressed.bytes,
    resolveArtifactBytes: async () => f.artifactBytes,
    resolveResultBytes: async () => f.resultBytes,
    verifyMineralEvidence: async () => ({
      status: "OK",
      claimScope: f.verificationReceipt.claim_scope,
      receipt: f.verificationReceipt
    })
  };

  const math = await interpretMineralWorldSeedArrival({
    ...common,
    destination: { worldId: "world:local", placeId: "place:math" },
    localRules: {
      label: "A dynamical specimen opens a nearby sweep.",
      actions: [
        {
          id: "sweep-next",
          label: "Explore the next parameter sweep",
          effect: "opens-descendant-mineral-want",
          descendantMineralRequest: {
            capability: "mineral.parameter-sweep/v0",
            payload: {
              r_values: ["3", "7/2"],
              x0: "1/2",
              steps: 7
            }
          }
        }
      ]
    }
  });

  const art = await interpretMineralWorldSeedArrival({
    ...common,
    dispositionReceipt: {
      ...f.receipt,
      world_id: "world:art",
      receiver_particular: "receiver:art",
      receipt_id: "receipt:art:mineral"
    },
    destination: { worldId: "world:art", placeId: "place:terrain" },
    localRules: {
      label: "The same specimen reads as terrain.",
      actions: [
        {
          id: "terrain",
          label: "Use its shape as terrain",
          effect: "creative-terrain-door"
        }
      ]
    }
  });

  assert.equal(math.trace.mineral.seedAddress, art.trace.mineral.seedAddress);
  assert.equal(math.trace.mineral.artifactAddress, art.trace.mineral.artifactAddress);
  assert.notEqual(math.trace.traceId, art.trace.traceId);
  assert.notDeepEqual(math.trace.mineral.actions, art.trace.mineral.actions);

  const field = resolveField({
    place: { id: "place:math" },
    actor: { id: "actor:math", held: [] },
    traces: [math.trace]
  });
  const through = field.affordances.find((item) =>
    item.id.startsWith("through-mineral:")
  );
  assert.ok(through);

  const acted = act({
    place: { id: "place:math" },
    actor: { id: "actor:math", held: [] },
    field,
    actionId: through.id,
    occurredAt: "2026-10-05T20:01:00Z",
    traces: [math.trace]
  });
  const response = acted.traces.at(-1);
  assert.equal(response.kind, "mineral-response");

  const want = makeDescendantMineralWant({
    sourceTrace: math.trace,
    actionReceipt: acted.receipt,
    responseTrace: response
  });
  assert.equal(verifyMineralWant(want), true);
  assert.equal(want.request.capability, "mineral.parameter-sweep/v0");
  assert.equal(want.authority, null);
  assert.equal(want.executable, false);
});

test("verification receipt address is independently bound", async () => {
  const f = fixture();
  await assert.rejects(
    () =>
      interpretMineralWorldSeedArrival({
        crossing: f.crossing,
        dispositionReceipt: f.receipt,
        destination: { worldId: "world:local", placeId: "place:math" },
        resolvePayloadBytes: async () => f.addressed.bytes,
        resolveArtifactBytes: async () => f.artifactBytes,
        resolveResultBytes: async () => f.resultBytes,
        verifyMineralEvidence: async () => ({
          status: "OK",
          claimScope: f.verificationReceipt.claim_scope,
          receipt: {
            ...f.verificationReceipt,
            artifact_address: "sha256:" + "f".repeat(64)
          }
        })
      }),
    /VERIFICATION_RECEIPT_ADDRESS_MISMATCH/
  );
});
