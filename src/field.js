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

function heldItem(actor, kind) {
  return actor.held?.find((item) => item.kind === kind);
}

function findTrace(traces, traceId) {
  return traces.find((trace) => trace.traceId === traceId);
}

function tenetRequirementMet(actor, tenet) {
  if (!tenet.requiredHeldKind) return true;
  return actorHolds(actor, tenet.requiredHeldKind);
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

  if (actorHolds(actor, "tenet-seed")) {
    affordances.push({
      id: "leave-tenet",
      kind: "action",
      label: "Leave a bounded future possibility",
      because: ["actor-holds-tenet-seed"]
    });
  }

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

  for (const trace of local.filter((item) => item.kind === "tenet")) {
    const tenet = trace.tenet;

    affordances.push({
      id: `encounter-tenet:${trace.traceId}`,
      kind: "encounter",
      label: tenet.label,
      because: ["attributable-tenet-trace"],
      sourceTraceId: trace.traceId,
      dispositions: ["notice", "hold", "ignore", "act-through"]
    });

    affordances.push({
      id: `hold-tenet:${trace.traceId}`,
      kind: "action",
      label: `Hold unresolved: ${tenet.label}`,
      because: ["tenet-may-be-held-without-acceptance"],
      sourceTraceId: trace.traceId
    });

    if (tenetRequirementMet(actor, tenet)) {
      affordances.push({
        id: `through-tenet:${trace.traceId}`,
        kind: "action",
        label: tenet.offeredActionLabel,
        because: [
          "attributable-tenet-trace",
          ...(tenet.requiredHeldKind
            ? [`actor-holds:${tenet.requiredHeldKind}`]
            : [])
        ],
        sourceTraceId: trace.traceId
      });
    }
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

    return { receipt, actor, traces: [...traces, trace] };
  }

  if (actionId === "plant-held-seed") {
    const seed = heldItem(actor, "seed");
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

    return { receipt, actor, traces: [...traces, trace] };
  }

  if (actionId === "leave-tenet") {
    const seed = heldItem(actor, "tenet-seed");
    const receipt = makeReceipt({
      occurredAt,
      actorId: actor.id,
      placeId: place.id,
      action: actionId,
      inputs: [seed.id],
      outputs: ["trace:tenet"],
      priorTraceIds: field.traceIds
    });

    const traceId = `trace:${receipt.receiptId.slice("sha256:".length, "sha256:".length + 20)}`;

    const trace = {
      schema: "gro.trace.v0",
      traceId,
      receiptId: receipt.receiptId,
      placeId: place.id,
      sourceActorId: actor.id,
      kind: "tenet",
      tags: ["tenet"],
      authority: "invitation-only",
      tenet: {
        tenetId: `tenet:${traceId.slice("trace:".length)}`,
        seedId: seed.id,
        label: seed.label,
        offeredActionLabel: seed.offeredActionLabel,
        requiredHeldKind: seed.requiredHeldKind ?? null,
        authorId: actor.id,
        authorControl: false,
        dispositions: ["notice", "hold", "ignore", "act-through"]
      }
    };

    return { receipt, actor, traces: [...traces, trace] };
  }

  if (actionId.startsWith("hold-tenet:")) {
    const traceId = actionId.slice("hold-tenet:".length);
    const source = findTrace(traces, traceId);
    if (!source || source.kind !== "tenet") {
      throw new Error(`Tenet trace not found: ${traceId}`);
    }

    const receipt = makeReceipt({
      occurredAt,
      actorId: actor.id,
      placeId: place.id,
      action: "hold-tenet",
      inputs: [source.receiptId],
      outputs: ["actor-held:tenet"],
      priorTraceIds: field.traceIds
    });

    const alreadyHeld =
      actor.held?.some(
        (item) => item.kind === "held-tenet" && item.sourceTraceId === traceId
      ) ?? false;

    const nextActor = alreadyHeld
      ? actor
      : {
          ...actor,
          held: [
            ...(actor.held ?? []),
            {
              id: source.tenet.tenetId,
              kind: "held-tenet",
              sourceTraceId: traceId,
              status: "held-unresolved",
              authority: "none"
            }
          ]
        };

    // HOLD is actor-local. It does not create a public world trace.
    return { receipt, actor: nextActor, traces };
  }

  if (actionId.startsWith("through-tenet:")) {
    const traceId = actionId.slice("through-tenet:".length);
    const source = findTrace(traces, traceId);
    if (!source || source.kind !== "tenet") {
      throw new Error(`Tenet trace not found: ${traceId}`);
    }

    if (!tenetRequirementMet(actor, source.tenet)) {
      throw new Error("Actor does not satisfy this tenet's bounded requirement");
    }

    const receipt = makeReceipt({
      occurredAt,
      actorId: actor.id,
      placeId: place.id,
      action: "act-through-tenet",
      inputs: [source.receiptId],
      outputs: ["trace:tenet-response"],
      priorTraceIds: field.traceIds
    });

    const response = {
      schema: "gro.trace.v0",
      traceId: `trace:${receipt.receiptId.slice("sha256:".length, "sha256:".length + 20)}`,
      receiptId: receipt.receiptId,
      placeId: place.id,
      sourceActorId: actor.id,
      kind: "tenet-response",
      tags: ["tenet-response"],
      relatedTenetTraceId: traceId,
      authority: "influence-only"
    };

    return { receipt, actor, traces: [...traces, response] };
  }

  throw new Error(`No executor implemented for action: ${actionId}`);
}
