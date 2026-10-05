import test from "node:test";
import assert from "node:assert/strict";

import { makeReceipt } from "../src/receipt.js";
import {
  GRO_DESCENDANT_MEDIA_TYPE,
  addressDescendantWorldSeed,
  localizeDescendantWorldSeed,
  makeDescendantWorldSeed,
  verifyDescendantWorldSeed
} from "../src/descendant.js";

function fixture() {
  const ancestorAddress =
    "sha256:" + "a".repeat(64);
  const ancestorCrossing = {
    crossing_id: "crossing:x",
    payload_refs: [
      {
        address: ancestorAddress,
        role: "gro-tenet",
        media_type: "application/vnd.gro.tenet+json"
      }
    ]
  };
  const admission = {
    receipt_id: "receipt:admit-x",
    crossing_id: "crossing:x"
  };
  const field = {
    projection_id: "field:1",
    history_root: "history:1"
  };
  const uptake = {
    uptake_id: "uptake:1",
    ancestor_crossing_id: "crossing:x",
    admitted_receipt_id: "receipt:admit-x",
    field_projection_id: "field:1",
    field_history_root: "history:1"
  };

  const ancestorLocalTrace = {
    schema: "gro.trace.v0",
    traceId: "trace:local-x",
    receiptId: "receipt:admit-x",
    kind: "tenet",
    authority: "invitation-only",
    crossing: {
      crossingId: "crossing:x",
      payloadAddress: ancestorAddress
    }
  };

  const actionReceipt = makeReceipt({
    occurredAt: "2026-10-04T19:15:00Z",
    actorId: "actor:b",
    placeId: "place:b",
    action: "act-through-tenet",
    inputs: ["receipt:admit-x"],
    outputs: ["trace:tenet-response"],
    priorTraceIds: ["trace:local-x"]
  });

  const actionResponseTrace = {
    schema: "gro.trace.v0",
    traceId: "trace:response-y",
    receiptId: actionReceipt.receiptId,
    placeId: "place:b",
    sourceActorId: "actor:b",
    kind: "tenet-response",
    tags: ["tenet-response"],
    relatedTenetTraceId: "trace:local-x",
    authority: "influence-only"
  };

  const payload = makeDescendantWorldSeed({
    ancestorPayloadAddress: ancestorAddress,
    ancestorLocalTrace,
    actionReceipt,
    actionResponseTrace,
    descendantTenet: {
      seedId: "seed:y",
      label: "Water moved forward.",
      offeredActionLabel: "Water the next thirsty tree",
      requiredHeldKind: "water",
      authorId: "actor:b",
      authorControl: false
    },
    lineageEvidence: {
      ancestorCrossing,
      ancestorAdmissionReceipt: admission,
      fieldProjection: field,
      uptake
    }
  });

  const addressed = addressDescendantWorldSeed(payload);
  const descendantCrossing = {
    crossing_id: "crossing:y",
    parents: ["crossing:x"],
    payload_refs: [
      {
        address: addressed.address,
        role: "cultural-descendant",
        media_type: GRO_DESCENDANT_MEDIA_TYPE
      }
    ]
  };

  return {
    ancestorAddress,
    payload,
    addressed,
    descendantCrossing,
    admission
  };
}

test("descendant seed preserves lineage evidence without copying ancestor semantic bytes", () => {
  const { payload, ancestorAddress } = fixture();

  assert.equal(payload.ancestor.payloadAddress, ancestorAddress);
  assert.equal(payload.lineage.ancestorCrossing.crossing_id, "crossing:x");
  assert.equal(payload.tenet.offeredActionLabel, "Water the next thirsty tree");

  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes("application/vnd.gro.tenet+json"), true);
  assert.equal(serialized.includes("Water the sapling"), false);
});

test("descendant verifier closes on address, action link, and lineage callback", async () => {
  const { addressed, descendantCrossing } = fixture();
  let calls = 0;

  const verified = await verifyDescendantWorldSeed({
    bytes: addressed.bytes,
    expectedAddress: addressed.address,
    descendantCrossing,
    verifyRelatteLineage: async (args) => {
      calls += 1;
      assert.equal(args.ancestor_crossing.crossing_id, "crossing:x");
      assert.equal(args.descendant_crossing.crossing_id, "crossing:y");
      return true;
    }
  });

  assert.equal(verified.lineageVerified, true);
  assert.equal(calls, 1);
});

test("tampered descendant bytes fail before lineage verification", async () => {
  const { addressed, descendantCrossing } = fixture();
  let called = false;

  await assert.rejects(
    () =>
      verifyDescendantWorldSeed({
        bytes: Buffer.from('{"tampered":true}', "utf8"),
        expectedAddress: addressed.address,
        descendantCrossing,
        verifyRelatteLineage: async () => {
          called = true;
          return true;
        }
      }),
    /DESCENDANT_PAYLOAD_ADDRESS_MISMATCH/
  );

  assert.equal(called, false);
});

test("verified descendant becomes playable only after its own local ADMIT", async () => {
  const { addressed, descendantCrossing } = fixture();
  const verified = await verifyDescendantWorldSeed({
    bytes: addressed.bytes,
    expectedAddress: addressed.address,
    descendantCrossing,
    verifyRelatteLineage: async () => true
  });

  const trace = localizeDescendantWorldSeed({
    verifiedSeed: verified,
    descendantCrossing,
    dispositionReceipt: {
      receipt_id: "receipt:admit-y",
      crossing_id: "crossing:y",
      world_id: "world:c",
      receiver_particular: "receiver:c",
      kind: "R3_ADMIT"
    },
    destination: {
      worldId: "world:c",
      placeId: "place:c"
    }
  });

  assert.equal(trace.kind, "tenet");
  assert.equal(trace.authority, "invitation-only");
  assert.equal(trace.lineage.ancestorCrossingId, "crossing:x");
  assert.equal(trace.lineage.descendantCrossingId, "crossing:y");
  assert.equal(trace.lineage.ancestryAuthority, false);
});
