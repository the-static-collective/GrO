import test from "node:test";
import assert from "node:assert/strict";
import { act, resolveField } from "../src/field.js";

test("an attributable action changes what the place affords to a later actor", () => {
  const place = { id: "place:test-garden" };
  const caretaker = { id: "actor:caretaker", held: [] };
  const later = {
    id: "actor:later",
    held: [{ id: "seed:001", kind: "seed" }]
  };

  const before = resolveField({ place, actor: later, traces: [] });
  assert.equal(
    before.affordances.some((x) => x.id === "plant-held-seed"),
    false
  );

  const caretakerField = resolveField({
    place,
    actor: caretaker,
    traces: []
  });

  const result = act({
    place,
    actor: caretaker,
    field: caretakerField,
    actionId: "care-for-place",
    occurredAt: "2026-10-04T17:55:00Z",
    traces: []
  });

  assert.equal(result.receipt.claims.occurrence, true);
  assert.equal(result.receipt.claims.value, false);
  assert.equal(result.receipt.claims.authority, false);
  assert.equal(result.receipt.claims.ownership, false);

  const after = resolveField({
    place,
    actor: later,
    traces: result.traces
  });

  assert.equal(
    after.affordances.some((x) => x.id === "plant-held-seed"),
    true
  );
});

test("the same occurrence yields the same deterministic receipt", () => {
  const event = {
    place: { id: "place:test-garden" },
    actor: { id: "actor:caretaker", held: [] },
    occurredAt: "2026-10-04T17:55:00Z"
  };

  const field = resolveField({
    place: event.place,
    actor: event.actor,
    traces: []
  });

  const a = act({
    ...event,
    field,
    actionId: "care-for-place",
    traces: []
  });

  const b = act({
    ...event,
    field,
    actionId: "care-for-place",
    traces: []
  });

  assert.equal(a.receipt.receiptId, b.receipt.receiptId);
});
