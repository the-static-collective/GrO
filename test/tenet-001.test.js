import test from "node:test";
import assert from "node:assert/strict";
import { act, resolveField } from "../src/field.js";

function leaveWaterTenet() {
  const place = { id: "place:small-garden" };
  const author = {
    id: "actor:author",
    held: [
      {
        id: "tenet-seed:water-001",
        kind: "tenet-seed",
        label: "Someone cared for this young tree.",
        offeredActionLabel: "Water the young tree",
        requiredHeldKind: "water"
      }
    ]
  };

  const field = resolveField({ place, actor: author, traces: [] });
  const result = act({
    place,
    actor: author,
    field,
    actionId: "leave-tenet",
    occurredAt: "2026-10-04T18:05:00Z",
    traces: []
  });

  return { place, author, ...result };
}

test("a tenet leaves an attributable invitation, not transferred authority", () => {
  const { traces } = leaveWaterTenet();
  const tenet = traces.find((trace) => trace.kind === "tenet");

  assert.ok(tenet);
  assert.equal(tenet.authority, "invitation-only");
  assert.equal(tenet.tenet.authorControl, false);
  assert.deepEqual(tenet.tenet.dispositions, [
    "notice",
    "hold",
    "ignore",
    "act-through"
  ]);
});

test("a later actor may notice a tenet without being compelled to act", () => {
  const { place, traces } = leaveWaterTenet();
  const passerby = { id: "actor:passerby", held: [] };

  const beforeCount = traces.length;
  const field = resolveField({ place, actor: passerby, traces });

  assert.ok(
    field.affordances.some((item) => item.id.startsWith("encounter-tenet:"))
  );
  assert.equal(
    field.affordances.some((item) => item.id.startsWith("through-tenet:")),
    false
  );

  // Resolving and ignoring the possibility changes no world state.
  assert.equal(traces.length, beforeCount);
});

test("HOLD is private local disposition and does not create a public trace", () => {
  const { place, traces } = leaveWaterTenet();
  const passerby = { id: "actor:passerby", held: [] };
  const field = resolveField({ place, actor: passerby, traces });
  const hold = field.affordances.find((item) =>
    item.id.startsWith("hold-tenet:")
  );

  const result = act({
    place,
    actor: passerby,
    field,
    actionId: hold.id,
    occurredAt: "2026-10-04T18:06:00Z",
    traces
  });

  assert.equal(result.traces.length, traces.length);
  assert.ok(
    result.actor.held.some(
      (item) => item.kind === "held-tenet" && item.status === "held-unresolved"
    )
  );
  assert.equal(result.receipt.claims.authority, false);
  assert.equal(result.receipt.claims.ownership, false);
});

test("a qualified later actor can act through the tenet under their own agency", () => {
  const { place, traces } = leaveWaterTenet();
  const later = {
    id: "actor:later",
    held: [{ id: "water:bottle-001", kind: "water" }]
  };

  const field = resolveField({ place, actor: later, traces });
  const through = field.affordances.find((item) =>
    item.id.startsWith("through-tenet:")
  );

  assert.ok(through);

  const result = act({
    place,
    actor: later,
    field,
    actionId: through.id,
    occurredAt: "2026-10-04T18:07:00Z",
    traces
  });

  assert.equal(result.receipt.actorId, later.id);
  assert.equal(result.receipt.claims.authority, false);

  const response = result.traces.at(-1);
  assert.equal(response.kind, "tenet-response");
  assert.equal(response.sourceActorId, later.id);
  assert.equal(response.authority, "influence-only");
  assert.equal(
    response.relatedTenetTraceId,
    traces.find((trace) => trace.kind === "tenet").traceId
  );
});
