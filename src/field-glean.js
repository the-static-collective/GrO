// Project an independently validated donor-offer as a GrO encounter,
// not a new act-through authority or a public trace.
import {resolveField} from "./field.js";
import {coldVerifyGleanQuest} from "../apps/field-scout/glean-quest.mjs";

export async function projectGleanQuest({
  place,actor,traces=[],offer,heldQuest,subtle=globalThis.crypto?.subtle,
}) {
  if(!place||place.id!==offer?.site_ref)throw Error("GRO_QUEST_LOCALITY_MISMATCH");
  if(!actor||typeof actor.id!=="string")throw Error("GRO_ACTOR_REQUIRED");
  const held=await coldVerifyGleanQuest({
    offer,placeId:place.id,actorId:actor.id,subtle,
  },heldQuest);
  const field=resolveField({place,actor,traces});
  const encounter={
    id:"glean-notice:"+held.quest_id,
    kind:"encounter",
    label:"Discover a steward's remaining yield",
    because:["source-offer-content-verified","owner-grant-unverified"],
    dispositions:["notice","hold","ignore"],
    sourceOfferFingerprint:held.offer_fingerprint,
    materialType:held.source_material_type,
    purpose:held.source_purpose,
    authority:"none",
    actorLocal:true,
  };
  return {
    schema:"gro.glean-field-projection/v0",
    placeId:place.id,actorId:actor.id,
    questId:held.quest_id,
    field:{...field,affordances:[...field.affordances,encounter]},
    traces,
    publicTraceCreated:false,
    collectPermitted:false,
    ownerVerified:false,
    inventoryDelta:0,
  };
}
