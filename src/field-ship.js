import { randomBytes, createHash } from "node:crypto";
import { stableStringify } from "./stable.js";
import { assessPropertyCandidate, validatePropertyIntake, PROPERTY_PRIVATE_SCHEMA } from "./property-readiness.js";

export const FIELD_SHIP_SCHEMA = "gro.field-ship-003/v0";
export const SHIP_TRANSPORT_MODES = Object.freeze(["undecided","self-propelled","professional-tow"]);
export const SHIP_STAGING_PERMISSIONS = Object.freeze([
  "continued_storage","inspection_access","repair_access","house_utility_connection",
  "departure_access",
]);
export const SHIP_CHECKS = Object.freeze([
  "structural_integrity","tires_wheels_axles","service_and_parking_brakes",
  "steering_suspension","powertrain_cooling","fuel_and_fluid_leaks",
  "electrical_lighting","battery_and_starting","weight_dimensions",
  "qualified_driver","road_route_and_restrictions",
  "towing_points_and_equipment","qualified_tow_operator",
]);
const DRIVE_CHECKS = [
  "structural_integrity","tires_wheels_axles","service_and_parking_brakes",
  "steering_suspension","powertrain_cooling","fuel_and_fluid_leaks",
  "electrical_lighting","battery_and_starting","weight_dimensions",
  "qualified_driver","road_route_and_restrictions",
];
const TOW_CHECKS = [
  "structural_integrity","tires_wheels_axles","service_and_parking_brakes",
  "steering_suspension","weight_dimensions","towing_points_and_equipment",
  "qualified_tow_operator","road_route_and_restrictions",
];
const BASE_ID = /^staging-base:[0-9a-f]{32}$/;
const DATE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/;
const SHA = x => createHash("sha256").update(x).digest("hex");
function time(t){
  if(typeof t!=="string"||!DATE.test(t)||!Number.isFinite(Date.parse(t)))
    throw new Error("FIELD_SHIP_BAD_DATE");
  return Date.parse(t);
}
function strict(o,fields,code){
  if(!o || typeof o!=="object" || Array.isArray(o) ||
     Object.keys(o).sort().join("|")!==[...fields].sort().join("|"))throw new Error(code);
}
const STATUSES=["missing","claimed","reviewed"];
export function blankShipEvidence(){
  return {state:"missing",reviewed_at:null,expires_at:null,revoked_at:null};
}
function assessOne(v,at) {
  strict(v,["state","reviewed_at","expires_at","revoked_at"],"FIELD_SHIP_RECORD_FIELDS");
  if(!STATUSES.includes(v.state))throw new Error("FIELD_SHIP_BAD_EVIDENCE_STATE");
  for(const k of ["reviewed_at","expires_at","revoked_at"]){
    if(v[k]!==null)time(v[k]);
  }
  if(v.state==="missing" && (v.reviewed_at!==null||v.expires_at!==null||v.revoked_at!==null))
    throw new Error("FIELD_SHIP_MISSING_RECORD_WITH_DATES");
  if(v.state==="claimed" && v.reviewed_at!==null)
    throw new Error("FIELD_SHIP_CLAIM_NOT_A_REVIEW");
  if(v.state==="reviewed" && v.reviewed_at===null)
    throw new Error("FIELD_SHIP_REVIEW_NEEDS_DATE");
  if(v.state==="reviewed" && v.expires_at!==null &&
     time(v.expires_at)<=time(v.reviewed_at))throw new Error("FIELD_SHIP_INVALID_EXPIRY");
  if(v.revoked_at!==null && time(v.revoked_at)<=time(at))return "revoked";
  if(v.expires_at!==null && time(v.expires_at)<=time(at))return "expired";
  if(v.state==="reviewed" && time(v.reviewed_at)>time(at))return "claimed";
  return v.state;
}
export function makeStagingBase(){
  return {
    schema:"gro.field-ship-staging-base/v0",
    base_id:"staging-base:"+randomBytes(16).toString("hex"),
    relation_to_other_land_candidate:"unresolved",
    permission_reviews:Object.fromEntries(
      SHIP_STAGING_PERMISSIONS.map(k=>[k,blankShipEvidence()]),
    ),
    title_to_vehicle_claimed:false,
    vehicle_movement_authorized:false,
    house_utilities_authorized:false,
  };
}
export function makeFieldShipChecklist(){
  return Object.fromEntries(SHIP_CHECKS.map(k=>[k,blankShipEvidence()]));
}
function checkBase(base){
  strict(base,["schema","base_id","relation_to_other_land_candidate","permission_reviews",
    "title_to_vehicle_claimed","vehicle_movement_authorized","house_utilities_authorized"],
  "FIELD_SHIP_BASE_FIELDS");
  if(base.schema!=="gro.field-ship-staging-base/v0"||!BASE_ID.test(base.base_id)||
     base.relation_to_other_land_candidate!=="unresolved" ||
     base.title_to_vehicle_claimed!==false ||
     base.vehicle_movement_authorized!==false ||
     base.house_utilities_authorized!==false)
    throw new Error("FIELD_SHIP_BASE_CANNOT_MINT_RIGHTS");
  strict(base.permission_reviews,SHIP_STAGING_PERMISSIONS,"FIELD_SHIP_BASE_PERMISSION_FIELDS");
}
function checkEvidence(evidence){
  strict(evidence,SHIP_CHECKS,"FIELD_SHIP_CHECKLIST_FIELDS");
}
export function assessFieldShip({vehicle,base,checks,transportMode="undecided",at}){
  time(at);
  if(!SHIP_TRANSPORT_MODES.includes(transportMode))throw new Error("FIELD_SHIP_BAD_MODE");
  validatePropertyIntake({schema:PROPERTY_PRIVATE_SCHEMA,candidates:[vehicle]});
  if(vehicle.asset_kind!=="vehicle")throw new Error("FIELD_SHIP_NOT_A_VEHICLE");
  if(!["vehicle-inspection","vehicle-relocation","vehicle-stationary-use"].includes(vehicle.activity))
    throw new Error("FIELD_SHIP_INCOMPATIBLE_ACTIVITY");
  checkBase(base);checkEvidence(checks);
  if(transportMode!=="undecided" && vehicle.activity!=="vehicle-relocation")
    throw new Error("FIELD_SHIP_MOVE_REQUIRES_RELOCATION_REVIEW");
  const audit=assessPropertyCandidate(vehicle,at);
  const needed=transportMode==="self-propelled" ? DRIVE_CHECKS :
    transportMode==="professional-tow" ? TOW_CHECKS : [];
  const checkStates=Object.fromEntries(SHIP_CHECKS.map(k=>[k,assessOne(checks[k],at)]));
  const permissionStates=Object.fromEntries(SHIP_STAGING_PERMISSIONS.map(
    k=>[k,assessOne(base.permission_reviews[k],at)]));
  // A parent's ownership of the *land* is not automatically a permission
  // to operate or repair a vehicle, connect the house or depart onto roads.
  const baseNeeded=transportMode==="undecided"?
    ["continued_storage","inspection_access"] :
    ["continued_storage","inspection_access","repair_access","departure_access"];
  const holdChecks=needed.filter(k=>checkStates[k]!=="reviewed");
  const holdPermissions=baseNeeded.filter(k=>permissionStates[k]!=="reviewed");
  const docs=transportMode==="undecided" ? [] : [...audit.blocking_topics];
  const hold=transportMode==="undecided" || docs.length>0 ||
    holdChecks.length>0 || holdPermissions.length>0;
  const reviewState=transportMode==="undecided" ? "INSPECTION_PLAN_ONLY" :
    hold ? "HOLD" : "READY_FOR_SEPARATE_QUALIFIED_HUMAN_DECISION";
  return {
    schema:FIELD_SHIP_SCHEMA,
    vehicle_candidate_id:vehicle.candidate_id,
    staging_base_id:base.base_id,
    other_land_candidate_linked:false,
    transport_mode:transportMode,
    reviewed_at:at,
    documentary_blockers:docs,
    mechanical_and_operator_blockers:holdChecks,
    staging_permission_blockers:holdPermissions,
    evidence_check_states:checkStates,
    staging_review_states:permissionStates,
    review_state:reviewState,
    steps:[
      {id:"0",title:"Desktop inventory and privacy-safe records",physical_action:false},
      {id:"1",title:"Independent vehicle records and staging permission",physical_action:false},
      {id:"2",title:"Authorized professional non-operating inspection",physical_action:true},
      {id:"3",title:"Separate repair estimates and human-approved work plan",physical_action:true},
      {id:"4",title:"Qualified road-move or professional-tow plan",physical_action:true},
      {id:"5",title:"Road-use documentation and supervised test if suitable",physical_action:true},
      {id:"6",title:"Mobile power, GHoT, GrO and reLATTE fit-out",physical_action:true},
    ],
    unsigned_human_release_required:true,
    completed_vehicle_inspection_proven:false,
    qualified_repair_proven:false,
    legal_road_permission_proven:false,
    vehicle_safe_to_drive_certified:false,
    vehicle_safe_to_tow_certified:false,
    land_entry_authorized:false,
    vehicle_operation_authorized:false,
    vehicle_tow_authorized:false,
    house_utility_connection_authorized:false,
    ghot_actuation_authorized:false,
  };
}

/** Task V0 shape. No vehicle commands, keys, location, VIN or engine control. */
export function makeFieldShipDeskWorkCandidate({vehicle,base,checks,at}){
  const assessment=assessFieldShip({vehicle,base,checks,transportMode:"undecided",at});
  const core={
    kind:"ghot.task",version:"0",capability:"gro.field-ship.desktop-inventory.v0",
    created_at:at,
    requester_node_id:"gro:field-ship-local-review",
    input:{
      schema:"gro.field-ship-desktop-input/v0",
      vehicle_candidate_id:assessment.vehicle_candidate_id,
      staging_base_id:assessment.staging_base_id,
      question:"What offline inspection and documentary facts are still missing?",
      no_private_address_or_vin:true,
      suggested_fields:["brakes","tires","fuel","electrical","cooling","documents","parking_permission"],
      physical_vehicle_action:false,
    },
    constraints:{
      network:false,arbitrary_shell:false,vehicle_actuation:false,
      physical_work:false,property_entry:false,house_utility_connection:false,
      human_authorization_required:true,executor_selected:false,
      installed_capability_confirmed:false,
    },
  };
  return {...core,task_id:"gro-field-ship-task:"+SHA(
    "GrO-FieldShip003-DeskWork-v0|"+stableStringify(core))};
}

/** Standalone candidate crossing *draft*, not a reLATTE signed CrossingEnvelope. */
export function makeFieldShipCrossingDraft({vehicle,base,checks,at}){
  const task=makeFieldShipDeskWorkCandidate({vehicle,base,checks,at});
  const payload={
    schema:"gro.field-ship-candidate-payload/v0",
    vehicle_candidate_id:vehicle.candidate_id,staging_base_id:base.base_id,
    proposed_task_id:task.task_id,
    transport_authority:false,physical_permission:false,
    no_address_or_vin:true,
  };
  const bytes=Buffer.from(stableStringify(payload),"utf8");
  return {
    spec:{
      schema:"relatte.opaque-organ-spec/v0",
      family_ref:"gro:field-ship-desktop/v0",
      donor_contract_ref:"gro:field-ship-003-crossing/v0",
      artifact_kind:"gro-field-ship-desktop-proposal",
      source_world:"gro:field-ship-local",
      source_particular:vehicle.candidate_id,
      source_history_head:null,
      payload_refs:[{
        address:"sha256:"+SHA(bytes),
        role:"field-ship-desktop-proposal",
        media_type:"application/vnd.gro.field-ship-desktop+json",
      }],
      donor_claims:{
        vehicle_candidate_id:vehicle.candidate_id,
        staging_base_id:base.base_id,
        physical_vehicle_effect:false,road_permission:false,
        property_authority_transfer:false,
      },
      requested_effect:{
        kind:"candidate-desktop-review",
        authority:"receiver-local",playable:false,
        vehicle_actuation:false,physical_entry:false,
      },
      return_address:null,created_at:at,
    },
    bytes,
  };
}
