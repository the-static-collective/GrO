// GrO FORAGE-001: add a source-replayed visual prospect as an ENCOUNTER,
// never as an ACT / TAKE affordance. No public trace is written on HOLD.
import {resolveField} from "./field.js";
import {verifyHeldForageEncounter} from "../apps/field-scout/gro-hold.mjs";

export async function projectHeldForageEncounter({
  place, actor, traces = [], lead, evidence, originalBytes,
  worldId, heldEncounter, subtle = globalThis.crypto?.subtle,
}) {
  if (!place || typeof place.id !== "string" || place.id !== lead?.site_ref) {
    throw new Error("FORAGE_PLACE_MUST_MATCH_OBSERVATION");
  }
  if (!actor || typeof actor.id !== "string") {
    throw new Error("GRo_ACTOR_REQUIRED");
  }
  const verified = await verifyHeldForageEncounter({
    lead, evidence, originalBytes, actorId: actor.id,
    placeId: place.id, worldId, subtle,
  }, heldEncounter);
  // The field may already have unrelated GrO actions; this bridge never
  // authorizes a FORAGE pickup / robot use, nor modifies the public traces.
  const field = resolveField({place, actor, traces});
  const offer = {
    id: "forage-observe:" + verified.encounter_id,
    kind: "encounter",
    label: "Inspect a held material prospect",
    sourceEncounterId: verified.encounter_id,
    sourceLeadRef: verified.source_lead_ref,
    because: ["verified-original-photo-digest", "operator-proposed-use-only"],
    dispositions: ["notice", "hold", "ignore"],
    permission: "NOT_GRANTED",
    actorLocal: true,
  };
  return {
    schema: "gro.forage-local-field-projection.v0",
    placeId: place.id,
    actorId: actor.id,
    heldEncounterId: verified.encounter_id,
    field: {...field, affordances: [...field.affordances, offer]},
    permissionToCollect: false,
    authorityToEnter: false,
    publicTraceEmitted: false,
    physicalInventoryChanged: false,
    machineMotionAuthorized: false,
    traces, // exact original list, no mutation
  };
}
