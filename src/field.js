import { makeReceipt } from "./receipt.js";

function tracesAt(placeId, traces) {
  return traces.filter((trace) => trace.placeId === placeId);
}

function hasTag(traces, tag) {
  return traces.some((trace) => trace.tags?.includes(tag));
}

function actorHolds(actor, kind) {
  return actor.held?.some((item) => item.kind === kind) ?? false;
}

/**
 * Resolve what this actor can currently do here.
 *
 * Affordances are relational projections over:
 * PLACE × ACTOR × HELD PARTICULARS × ATTRIBUTABLE TRACE × LOCAL RULES
 *
 * They are not permanent global properties of the place.
 */
export function resolveField({ place, actor, traces = [] }) {
  const local = tracesAt(place.id, traces);
  const affordances = [
    {
      id: "care-for-place",
      kind: "action",
      label: "Care for this place",
      because: ["place-is-addressable"]
    }
  ];

  if (hasTag(local, "care-work")) {
    affordances.push({
      id: "notice-care-trace",
      kind: "encounter",
      label: "Notice prior care",
      because: ["attributable-care-trace"]
    });
  }

  if (hasTag(local, "care-work") && actorHolds(actor, "seed")) {
    affordances.push({
      id: "plant-held-seed",
      kind: "action",
      label: "Plant a held seed",
      because: ["attributable-care-trace", "actor-holds-seed"]
    });
  }

  if (
    hasTag(local, "melody") &&
    hasTag(local, "tree-witness") &&
    hasTag(local, "care-work")
  ) {
    affordances.push({
      id: "grove-song-door",
      kind: "door",
      label: "A grove-song door is possible here",
      because: ["melody", "tree-witness", "care-work"]
    });
  }

  return {
    schema: "gro.field-projection.v0",
    placeId: place.id,
    actorId: actor.id,
    traceIds: local.map((trace) => trace.traceId).sort(),
    affordances
  };
}

export function act({
  place,
  actor,
  field,
  actionId,
  occurredAt,
  traces = []
}) {
  const admitted = field.affordances.find((a) => a.id === actionId);
  if (!admitted || admitted.kind !== "action") {
    throw new Error(`Action is not afforded here: ${actionId}`);
  }

  if (actionId === "care-for-place") {
    const receipt = makeReceipt({
      occurredAt,
      actorId: actor.id,
      placeId: place.id,
      action: actionId,
      inputs: [],
      outputs: ["trace:care-work"],
      priorTraceIds: field.traceIds
    });

    const trace = {
      schema: "gro.trace.v0",
      traceId: `trace:${receipt.receiptId.slice("sha256:".length, "sha256:".length + 20)}`,
      receiptId: receipt.receiptId,
      placeId: place.id,
      sourceActorId: actor.id,
      kind: "workmark",
      tags: ["care-work"],
      authority: "influence-only"
    };

    return { receipt, traces: [...traces, trace] };
  }

  if (actionId === "plant-held-seed") {
    const seed = actor.held.find((item) => item.kind === "seed");
    const receipt = makeReceipt({
      occurredAt,
      actorId: actor.id,
      placeId: place.id,
      action: actionId,
      inputs: [seed.id],
      outputs: ["trace:planted-seed"],
      priorTraceIds: field.traceIds
    });

    const trace = {
      schema: "gro.trace.v0",
      traceId: `trace:${receipt.receiptId.slice("sha256:".length, "sha256:".length + 20)}`,
      receiptId: receipt.receiptId,
      placeId: place.id,
      sourceActorId: actor.id,
      kind: "growth",
      tags: ["planted-seed"],
      authority: "influence-only"
    };

    return { receipt, traces: [...traces, trace] };
  }

  throw new Error(`No executor implemented for action: ${actionId}`);
}
