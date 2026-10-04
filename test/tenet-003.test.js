import test from "node:test";
import assert from "node:assert/strict";

import { act, resolveField } from "../src/field.js";
import { addressJson } from "../src/payload-store.js";
import {
  GRO_ADDRESSED_TENET_FAMILY_REF,
  interpretAddressedTenetArrival,
  makeAddressedTenetTransferSpec,
  makeTenetPayload
} from "../src/crossing.js";

function sourceTrace() {
  const place = { id: "place:source" };
  const author = {
    id: "actor:source",
    held: [
      {
        id: "tenet-seed:003",
        kind: "tenet-seed",
        label: "Carry water forward.",
        offeredActionLabel: "Water the sapling",
        requiredHeldKind: "water"
      }
    ]
  };
  const field = resolveField({ place, actor: author, traces: [] });
  return act({
    place,
    actor: author,
    field,
    actionId: "leave-tenet",
    occurredAt: "2026-10-04T18:30:00Z",
    traces: []
  }).traces.find((trace) => trace.kind === "tenet");
}

function crossingFor(spec) {
  return {
    crossing_id: "relatte-crossing:tenet-003",
    source_world: spec.source_world,
    payload_refs: spec.payload_refs,
    extensions: {
      organ_adapter: {
        family_ref: spec.family_ref,
        donor_claims: spec.donor_claims
      }
    }
  };
}

function receipt(kind) {
  return {
    crossing_id: "relatte-crossing:tenet-003",
    world_id: "world:destination",
    receiver_particular: "receiver:destination",
    contract_ref: "contract:destination/v0",
    kind,
    semantic_effect: kind === "R3_ADMIT" ? "candidate" : "none",
    receipt_id: `receipt:${kind}`
  };
}

test("carrier claims bind an address but do not embed the tenet body", () => {
  const trace = sourceTrace();
  const payload = makeTenetPayload(trace);
  const addressed = addressJson(payload);
  const spec = makeAddressedTenetTransferSpec({
    trace,
    payloadAddress: addressed.address,
    sourceWorld: "world:source",
    createdAt: "2026-10-04T18:31:00Z"
  });

  assert.equal(spec.family_ref, GRO_ADDRESSED_TENET_FAMILY_REF);
  assert.equal(spec.donor_claims.payload_address, addressed.address);
  assert.equal(spec.payload_refs[0].address, addressed.address);
  assert.equal(spec.donor_claims.tenet, undefined);
  assert.equal(spec.requested_effect.payload_fetch_required, false);
});

test("REFUSE does not fetch addressed payload bytes", async () => {
  const trace = sourceTrace();
  const payload = makeTenetPayload(trace);
  const addressed = addressJson(payload);
  const spec = makeAddressedTenetTransferSpec({
    trace,
    payloadAddress: addressed.address,
    sourceWorld: "world:source",
    createdAt: "2026-10-04T18:31:00Z"
  });

  let fetches = 0;
  const result = await interpretAddressedTenetArrival({
    crossing: crossingFor(spec),
    dispositionReceipt: receipt("R3_REFUSE"),
    destination: {
      worldId: "world:destination",
      placeId: "place:destination"
    },
    resolvePayloadBytes: async () => {
      fetches += 1;
      return addressed.bytes;
    }
  });

  assert.equal(result.status, "not-admitted");
  assert.equal(result.payloadResolved, false);
  assert.equal(result.trace, null);
  assert.equal(fetches, 0);
});

test("ADMIT independently verifies addressed bytes before local playability", async () => {
  const trace = sourceTrace();
  const payload = makeTenetPayload(trace);
  const addressed = addressJson(payload);
  const spec = makeAddressedTenetTransferSpec({
    trace,
    payloadAddress: addressed.address,
    sourceWorld: "world:source",
    createdAt: "2026-10-04T18:31:00Z"
  });

  const result = await interpretAddressedTenetArrival({
    crossing: crossingFor(spec),
    dispositionReceipt: receipt("R3_ADMIT"),
    destination: {
      worldId: "world:destination",
      placeId: "place:destination"
    },
    resolvePayloadBytes: async (address) => {
      assert.equal(address, addressed.address);
      return addressed.bytes;
    },
    localRules: {
      offeredActionLabel: "Refill the cistern"
    }
  });

  assert.equal(result.status, "admitted");
  assert.equal(result.payloadResolved, true);
  assert.equal(result.payloadAddress, addressed.address);
  assert.equal(result.trace.tenet.offeredActionLabel, "Refill the cistern");
  assert.equal(result.trace.crossing.payloadAddress, addressed.address);
});

test("ADMIT rejects bytes that do not match the signed content address", async () => {
  const trace = sourceTrace();
  const payload = makeTenetPayload(trace);
  const addressed = addressJson(payload);
  const spec = makeAddressedTenetTransferSpec({
    trace,
    payloadAddress: addressed.address,
    sourceWorld: "world:source",
    createdAt: "2026-10-04T18:31:00Z"
  });

  await assert.rejects(
    () =>
      interpretAddressedTenetArrival({
        crossing: crossingFor(spec),
        dispositionReceipt: receipt("R3_ADMIT"),
        destination: {
          worldId: "world:destination",
          placeId: "place:destination"
        },
        resolvePayloadBytes: async () =>
          Buffer.from('{"tampered":true}', "utf8")
      }),
    /PAYLOAD_ADDRESS_VERIFICATION_FAILED/
  );
});
