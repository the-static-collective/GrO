import test from "node:test";
import assert from "node:assert/strict";

import { act, resolveField } from "../src/field.js";
import {
  GRO_TENET_FAMILY_REF,
  interpretTenetArrival,
  makeTenetTransferSpec
} from "../src/crossing.js";

function sourceTenetTrace() {
  const place = { id: "place:source-garden" };
  const author = {
    id: "actor:source-author",
    held: [
      {
        id: "tenet-seed:water-002",
        kind: "tenet-seed",
        label: "Water can continue what happened here.",
        offeredActionLabel: "Water the young tree",
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
    occurredAt: "2026-10-04T18:20:00Z",
    traces: []
  }).traces.find((trace) => trace.kind === "tenet");
}

function fakeCrossing(spec) {
  return {
    crossing_id: "relatte-crossing:test-tenet-002",
    source_world: spec.source_world,
    extensions: {
      organ_adapter: {
        family_ref: GRO_TENET_FAMILY_REF,
        donor_claims: spec.donor_claims
      }
    }
  };
}

function receipt(kind, worldId) {
  return {
    crossing_id: "relatte-crossing:test-tenet-002",
    world_id: worldId,
    receiver_particular: `receiver:${worldId}`,
    contract_ref: `contract:${worldId}/v0`,
    kind,
    semantic_effect: kind === "R3_ADMIT" ? "gro-local-tenet-candidate" : "none",
    receipt_id: `receipt:${kind}:${worldId}`
  };
}

test("portable tenet requests receiver-local effect without transferring source authority", () => {
  const trace = sourceTenetTrace();
  const spec = makeTenetTransferSpec({
    trace,
    sourceWorld: "world:gro-room-a",
    sourceHistoryHead: "history:room-a:001",
    createdAt: "2026-10-04T18:21:00Z"
  });

  assert.equal(spec.family_ref, GRO_TENET_FAMILY_REF);
  assert.equal(spec.donor_claims.source_authority, "invitation-only");
  assert.equal(spec.donor_claims.tenet.authorControl, false);
  assert.equal(spec.requested_effect.authority, "receiver-local");
  assert.equal(spec.requested_effect.source_authority_transfer, false);
});

test("ADMIT creates a destination-local playable descendant, not a source-controlled copy", () => {
  const trace = sourceTenetTrace();
  const spec = makeTenetTransferSpec({
    trace,
    sourceWorld: "world:gro-room-a",
    createdAt: "2026-10-04T18:21:00Z"
  });
  const crossing = fakeCrossing(spec);

  const result = interpretTenetArrival({
    crossing,
    dispositionReceipt: receipt("R3_ADMIT", "world:gro-room-b"),
    destination: {
      worldId: "world:gro-room-b",
      placeId: "place:rain-room"
    },
    localRules: {
      label: "A carried invitation reached this room.",
      offeredActionLabel: "Refill the rain bowl",
      requiredHeldKind: "water"
    }
  });

  assert.equal(result.status, "admitted");
  assert.equal(result.trace.authority, "invitation-only");
  assert.equal(result.trace.tenet.authorControl, false);
  assert.equal(result.trace.tenet.offeredActionLabel, "Refill the rain bowl");
  assert.equal(
    result.trace.crossing.sourceTenet.offeredActionLabel,
    "Water the young tree"
  );

  const walker = {
    id: "actor:room-b-walker",
    held: [{ id: "water:001", kind: "water" }]
  };
  const field = resolveField({
    place: { id: "place:rain-room" },
    actor: walker,
    traces: [result.trace]
  });

  assert.ok(field.affordances.some((item) =>
    item.id.startsWith("through-tenet:")
  ));
});

test("HOLD and REFUSE do not become playable GrO traces", () => {
  const trace = sourceTenetTrace();
  const spec = makeTenetTransferSpec({
    trace,
    sourceWorld: "world:gro-room-a",
    createdAt: "2026-10-04T18:21:00Z"
  });
  const crossing = fakeCrossing(spec);

  for (const kind of ["R3_HOLD", "R3_REFUSE", "R3_RETURN"]) {
    const result = interpretTenetArrival({
      crossing,
      dispositionReceipt: receipt(kind, "world:gro-room-c"),
      destination: {
        worldId: "world:gro-room-c",
        placeId: "place:quiet-room"
      }
    });

    assert.equal(result.status, "not-admitted");
    assert.equal(result.trace, null);
  }
});
