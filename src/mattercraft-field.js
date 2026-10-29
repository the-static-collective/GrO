// MATTERCRAFT-001: strict, read-only GrO locality encounter over claimed physical material.
// This is a source-format candidate, NOT a native PENNY, Full Measure or reLATTE event.
import {createHash} from "node:crypto";
import {resolveField} from "./field.js";

const SCHEMA="gro.mattercraft-material-claim/v0";
const REWARDS=new Set(["BANANA","BOTTLED_WATER","NONE"]);
const MATERIALS=new Map([
  ["WOOD", "WOOD"],["ASH", "ASH"],["FOOD", "FOOD"],["DEVICE", "DEVICE"]
]);
const ID=/^[a-z0-9][a-z0-9._:-]{0,79}$/;
const HEX=/^[a-f0-9]{64}$/;

function keys(obj, expected, label) {
  if(!obj || typeof obj!=="object" || Array.isArray(obj)
    || Object.keys(obj).sort().join("|")!==[...expected].sort().join("|"))
    throw new Error(label+"_BAD_SHAPE");
}
function ref(v,label){if(typeof v!=="string" || !ID.test(v))throw new Error(label+"_BAD_REF");}
function qty(v,label){if(!Number.isSafeInteger(v)||v<1||v>1000000)throw new Error(label+"_BAD_QUANTITY");}
function hash(v,label){if(typeof v!=="string"||!HEX.test(v))throw new Error(label+"_BAD_SHA256");}
function canonical(v){
  if(Array.isArray(v))return "["+v.map(canonical).join(",")+"]";
  if(v && typeof v==="object")return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}";
  return JSON.stringify(v);
}
export function digestClaim(claim){
  validateClaim(claim);
  return createHash("sha256").update(canonical(claim)).digest("hex");
}
function validateClaim(c){
  keys(c,["schema","resourceId","material","quantity","unit","unitStandardRef","placeId","stewardRef","claimStatus"],"CLAIM");
  if(c.schema!==SCHEMA)throw Error("CLAIM_SCHEMA_UNSUPPORTED");
  for(const [label,val] of [["RESOURCE",c.resourceId],["UNIT",c.unit],["UNIT_STANDARD",c.unitStandardRef],
    ["PLACE",c.placeId],["STEWARD",c.stewardRef]])ref(val,label);
  if(!MATERIALS.has(c.material))throw Error("MATERIAL_UNKNOWN");
  qty(c.quantity,"CLAIM");
  if(c.claimStatus!=="OWNER_DECLARED_UNVERIFIED")throw Error("CLAIM_MUST_BE_UNVERIFIED");
}
function validateWitness(w){
  if(w===null)return;
  keys(w,["observerRef","quantityObserved","method","evidenceSha256","status"],"WITNESS");
  ref(w.observerRef,"OBSERVER"); qty(w.quantityObserved,"OBSERVATION");
  if(!["HAND_COUNT","WEIGHED","MEASURED"].includes(w.method))throw Error("OBSERVATION_METHOD_UNKNOWN");
  hash(w.evidenceSha256,"OBSERVATION");
  if(w.status!=="UNSIGNED_WITNESS_CANDIDATE")throw Error("WITNESS_AUTHORITY_UNVERIFIED");
}
function validateAppreciation(a){
  keys(a,["resource","quantity","sponsorRef","state"],"APPRECIATION");
  if(!REWARDS.has(a.resource))throw Error("APPRECIATION_TYPE_UNSUPPORTED");
  if(a.resource==="NONE" ? a.quantity!==0 : a.quantity!==1)throw Error("APPRECIATION_NOT_BOUNDED");
  ref(a.sponsorRef,"SPONSOR");
  if(a.state!=="UNFUNDED_PROPOSAL")throw Error("APPRECIATION_CANNOT_BE_GRANTED");
}

/** "42 wood" becomes a noticed local POSSIBILITY, not accepted inventory. */
export function projectMattercraftEncounter({
  place,actor,traces=[],claim,expectedClaimSha256,witness=null,
  appreciation={resource:"NONE",quantity:0,sponsorRef:"steward:unset",state:"UNFUNDED_PROPOSAL"}
}) {
  if(!place || typeof place.id!=="string" || !actor || typeof actor.id!=="string")
    throw Error("GRO_PLACE_ACTOR_REQUIRED");
  if(!Array.isArray(traces))throw Error("GRO_TRACES_REQUIRED");
  validateClaim(claim); hash(expectedClaimSha256,"EXPECTED_CLAIM");
  if(createHash("sha256").update(canonical(claim)).digest("hex")!==expectedClaimSha256)
    throw Error("CLAIM_BYTES_CHANGED");
  if(place.id!==claim.placeId)throw Error("CLAIM_PLACE_MISMATCH");
  validateWitness(witness); validateAppreciation(appreciation);
  // This local discrepancy is information, not a new balance or approved inventory.
  const discrepancy=witness===null ? "NO_WITNESS_CANDIDATE"
    : witness.quantityObserved===claim.quantity ? "CLAIMS_AGREE_BUT_UNVERIFIED"
    : "COUNTS_DISAGREE_HOLD";
  const field=resolveField({place,actor,traces});
  const encounter={
    id:"mattercraft:inspect:"+expectedClaimSha256,
    kind:"encounter",
    label:"Inspect offered physical resource",
    sourceClaimSha256:expectedClaimSha256,
    sourceResourceId:claim.resourceId,
    material:claim.material,
    unit:claim.unit,
    declaredQuantity:claim.quantity,
    countDiscrepancy:discrepancy,
    because:["source-bytes-match-candidate-digest","owner-claim-not-physical-proof",
      "witness-not-verified-identity","local-authorization-not-granted"],
    dispositions:["notice","hold","ignore"],
    actorLocal:true,
    authority:"NONE",
  };
  return {
    schema:"gro.mattercraft-field-projection/v0",
    placeId:place.id,actorId:actor.id,sourceClaimSha256:expectedClaimSha256,
    field:{...field,affordances:[...field.affordances,encounter]},
    observations:{
      declared:claim.quantity, witnessCandidate:witness?.quantityObserved??null,
      discrepancy, recognizedSpendableQuantity:0,
    },
    proposedFullMeasureQuest:{
      type:"VERIFY_RESOURCE_CANDIDATE",state:"HOLD_NOT_AWARDED",
      scope:"EXPLICIT_PERMISSION_AND_SAFE_OBSERVATION_REQUIRED",
      outcome:"A disagreement is a valid report; no outcome is preapproved.",
    },
    proposedAppreciation:{...appreciation,releasePermitted:false},
    effects:{
      inventoryChanged:false,physicalAccessAuthorized:false,
      publicTraceCreated:false,fullMeasureDeedGranted:false,
      pennyIssued:false,relatteSent:false,rewardDispensed:false,
      blockchainMinted:false,
    },
    traces // reference passed through unchanged; never write a world trace
  };
}

/** A wood-to-ash what-if. Never retires actual wood or invents measured ash. */
export function previewMaterialTransform({claim,expectedClaimSha256,woodInputQty}){
  validateClaim(claim);hash(expectedClaimSha256,"EXPECTED_CLAIM");
  if(claim.material!=="WOOD")throw Error("TRANSFORM_REQUIRES_WOOD");
  if(digestClaim(claim)!==expectedClaimSha256)throw Error("CLAIM_BYTES_CHANGED");
  qty(woodInputQty,"INPUT");
  if(woodInputQty>claim.quantity)throw Error("TRANSFORM_EXCEEDS_CLAIMED_STOCK");
  return {
    schema:"gro.mattercraft-transition-proposal/v0",
    status:"HOLD_NO_PHYSICAL_OCCURRENCE",
    sourceClaimSha256:expectedClaimSha256,
    input:{material:"WOOD",quantity:woodInputQty,unit:claim.unit,
      inventoryRetired:0},
    modeledOutputs:[
      {kind:"ASH",quantity:null,unit:null,state:"REQUIRES_MEASUREMENT"},
      {kind:"HEAT",quantity:null,unit:null,state:"NOT_MEASURED"},
      {kind:"OTHER_COMBUSTION_PRODUCTS",quantity:null,unit:null,state:"NOT_MEASURED"}
    ],
    nextPossibilities:[
      "Measure remaining ash only after a safe, lawful real-world process",
      "Evaluate any soil-related use independently: ash is not automatically safe soil or fertilizer"
    ],
    permissions:"NONE",physicalBurnAuthorized:false,
    materialInventoryChanged:false,fullMeasureDeedGranted:false,
    newSpendableToken:false,
  };
}
