// GrO GLEAN-001: independent owner-offered remainder encounters.
// This module verifies a structured human claim, never the human's authority.
import {stableStringify} from "./stable.mjs";

const schema="static-os.glean-offer/v0";
export const QUEST_SCHEMA="gro.glean-held-quest/v0";
const keys=[
  "schema","offer_ref","site_ref","steward_ref","owner_claim_ref",
  "material_ref","material_type","description","source_status",
  "purpose","intended_recipient_ref","quantity","valid_from",
  "valid_until","donation_evidence_ref","owner_donation_asserted",
  "hazards","offer_is_authenticated_by_software",
];
const units=new Set(["ITEM","POUND","KILOGRAM","LITER"]);
const hazards=new Set([
  "UNIDENTIFIED_EDIBLE","CONTAMINATION","SPOILED_OR_UNSAFE_FOOD",
  "PROTECTED_RESOURCE","POSTED_OR_LOCKED","UNKNOWN_CHEMICAL",
  "DAMAGED_BATTERY","SHARP_OR_POWERED_EQUIPMENT",
]);
const ref=/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{2,119}$/;
const requireCondition=(value,why)=>{if(!value)throw Error(why);};
const isObject=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const hasKeys=(value,fields)=>isObject(value)&&Object.keys(value).sort().join("|")===fields.slice().sort().join("|");
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
function isoDay(value) {
  requireCondition(typeof value==="string"&&datePattern.test(value),"INVALID_GLEAN_DATE");
  const x=new Date(value+"T00:00:00Z");
  requireCondition(!Number.isNaN(x.getTime())&&x.toISOString().slice(0,10)===value,"INVALID_GLEAN_DATE");
  return value;
}
function word(value) {return typeof value==="string"&&value.length>=3&&value.length<=240&&!value.includes("\0");}
function id(value) {return typeof value==="string"&&ref.test(value);}

export function validateGleanOffer(offer) {
  requireCondition(hasKeys(offer,keys),"GLEAN_OFFER_EXACT_FIELDS_REQUIRED");
  requireCondition(offer.schema===schema&&
    ["offer_ref","site_ref","steward_ref","owner_claim_ref","material_ref",
     "intended_recipient_ref","donation_evidence_ref"].every(k=>id(offer[k]))&&
    word(offer.description)&&
    typeof offer.owner_donation_asserted==="boolean"&&
    offer.offer_is_authenticated_by_software===false,
    "GLEAN_OFFER_INVALID_OR_FORGED_AUTHORITY");
  requireCondition(hasKeys(offer.quantity,["amount","unit"])&&
    Number.isSafeInteger(offer.quantity.amount)&&
    offer.quantity.amount>=1&&offer.quantity.amount<=100000&&
    units.has(offer.quantity.unit),"GLEAN_QUANTITY_INVALID");
  requireCondition(isoDay(offer.valid_from)<=isoDay(offer.valid_until),
    "GLEAN_OFFER_WINDOW_INVALID");
  requireCondition(Array.isArray(offer.hazards)&&
    offer.hazards.every(x=>typeof x==="string"&&hazards.has(x))&&
    new Set(offer.hazards).size===offer.hazards.length,
    "GLEAN_HAZARDS_INVALID");
  if(offer.material_type==="AGRICULTURAL_CROP"){
    requireCondition(offer.source_status==="AFTER_PRIMARY_HARVEST"&&
      offer.purpose==="FREE_DISTRIBUTION",
      "GLEAN_CROP_DONATION_MUST_SERVE_FREE_DISTRIBUTION");
  }else if(offer.material_type==="WORKSHOP_SURPLUS"){
    requireCondition(offer.source_status==="UNUSED_SURPLUS"&&
      offer.purpose==="NONCOMMERCIAL_WORKSHOP_GIFT"&&offer.quantity.unit==="ITEM",
      "GLEAN_WORKSHOP_IS_NOT_FOOD_DONATION");
  }else throw Error("UNKNOWN_GLEAN_MATERIAL_TYPE");
  return offer;
}

async function hexDigest(value,subtle){
  requireCondition(subtle,"SECURE_CONTEXT_REQUIRED_FOR_GLEAN_HASH");
  const input=new TextEncoder().encode(stableStringify(value));
  const b=await subtle.digest("SHA-256",input);
  return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");
}

export async function holdGleanQuest({
  offer,actorId,placeId,subtle=globalThis.crypto?.subtle
}){
  const o=validateGleanOffer(offer);
  requireCondition(id(actorId)&&actorId.startsWith("actor:"),"GRO_ACTOR_REQUIRED");
  requireCondition(placeId===o.site_ref,"GRO_QUEST_LOCALITY_MISMATCH");
  const body={
    schema:QUEST_SCHEMA,
    source_contract:schema,
    offer_fingerprint:"sha256:"+await hexDigest(o,subtle),
    place_id:placeId,
    actor_id:actorId,
    source_material_type:o.material_type,
    source_purpose:o.purpose,
    source_status:o.source_status,
    invitation_kind:"ASK_STEWARD_FOR_BOUNDED_REMAINDER",
    disposition:"HOLD_UNRESOLVED",
    public_world_trace_created:false,
    owner_authenticated:false,
    permission_to_enter_or_collect:false,
    recipient_acceptance_verified:false,
    actual_pickup_reported:false,
    transport_authorized:false,
    machine_motion_authorized:false,
    treasury_credit:0,
    receiver_local_admission:false,
  };
  return {...body,quest_id:"gro:glean-held:sha256:"+await hexDigest(body,subtle)};
}

export async function coldVerifyGleanQuest(args,original){
  requireCondition(isObject(original),"GRO_HELD_QUEST_OBJECT_REQUIRED");
  const expected=await holdGleanQuest(args);
  requireCondition(stableStringify(original)===stableStringify(expected),
    "GRO_GLEAN_ORIGINAL_OFFER_COLD_REPLAY_DISAGREEMENT");
  return expected;
}
