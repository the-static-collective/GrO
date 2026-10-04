import { act, resolveField } from "../src/field.js";

const place = {
  id: "place:ordinary-park"
};

const firstWalker = {
  id: "actor:first-walker",
  held: []
};

const laterWalker = {
  id: "actor:later-walker",
  held: [{ id: "seed:sunflower-001", kind: "seed" }]
};

let traces = [];

const before = resolveField({
  place,
  actor: laterWalker,
  traces
});

const firstField = resolveField({
  place,
  actor: firstWalker,
  traces
});

const consequence = act({
  place,
  actor: firstWalker,
  field: firstField,
  actionId: "care-for-place",
  occurredAt: "2026-10-04T17:55:00Z",
  traces
});

traces = consequence.traces;

const after = resolveField({
  place,
  actor: laterWalker,
  traces
});

console.log("BEFORE");
console.log(before.affordances.map((x) => x.id));

console.log("\nOCCURRENCE RECEIPT");
console.log(consequence.receipt);

console.log("\nAFTER");
console.log(after.affordances.map((x) => x.id));

console.log(
  "\nNEW POSSIBILITY:",
  after.affordances.some((x) => x.id === "plant-held-seed")
    ? "plant-held-seed"
    : "none"
);
