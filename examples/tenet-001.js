import { act, resolveField } from "../src/field.js";

const place = { id: "place:young-tree" };

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

let traces = [];

const authorField = resolveField({ place, actor: author, traces });
const left = act({
  place,
  actor: author,
  field: authorField,
  actionId: "leave-tenet",
  occurredAt: "2026-10-04T18:05:00Z",
  traces
});
traces = left.traces;

const walker = {
  id: "actor:later-walker",
  held: [{ id: "water:bottle-001", kind: "water" }]
};

const walkerField = resolveField({ place, actor: walker, traces });
const encounter = walkerField.affordances.find((x) =>
  x.id.startsWith("encounter-tenet:")
);
const through = walkerField.affordances.find((x) =>
  x.id.startsWith("through-tenet:")
);

console.log("ENCOUNTER");
console.log(encounter);

console.log("\nOPTIONAL ACTION");
console.log(through);

console.log("\nNOTHING HAPPENS UNTIL THE WALKER CHOOSES.");

const acted = act({
  place,
  actor: walker,
  field: walkerField,
  actionId: through.id,
  occurredAt: "2026-10-04T18:07:00Z",
  traces
});

console.log("\nACTED THROUGH BY");
console.log(acted.receipt.actorId);

console.log("\nAUTHOR AUTHORITY TRANSFERRED?");
console.log(acted.receipt.claims.authority);
