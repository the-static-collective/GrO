#!/usr/bin/env node
// Fictional mobile-bus recovery and hangar simulation only.
// Prints and writes no VIN, plate, address, ownership names, legal assertions,
// ignition commands or real property coordinates.
import { mkdir,writeFile } from "node:fs/promises";
import { makePropertyCandidate } from "../src/property-readiness.js";
import {
  makeStagingBase,makeFieldShipChecklist,assessFieldShip,
  makeFieldShipDeskWorkCandidate,makeFieldShipCrossingDraft,
} from "../src/field-ship.js";

const now="2026-10-09T20:30:00.000Z";
const bus=makePropertyCandidate("synthetic:mobile-asset");
bus.asset_kind="vehicle";
bus.activity="vehicle-relocation";
// A visual document and an insurance *claim* are initial leads, not verified
// present-day title/insurance, operation, or access permission.
bus.evidence.vehicle_title_record={
  state:"claimed",local_reference:"private:mock-image-only",
  reviewed_at:null,expires_at:null,revoked_at:null,
};
bus.evidence.vehicle_insurance_scope={
  state:"claimed",local_reference:"private:mock-rv-policy-claim",
  reviewed_at:null,expires_at:null,revoked_at:null,
};
const hangar=makeStagingBase({relationToOtherLandCandidate:"participant-reported-distinct"}),checks=makeFieldShipChecklist();
const inspection=assessFieldShip({
  vehicle:bus,base:hangar,checks,transportMode:"undecided",at:now,
});
const drive=assessFieldShip({
  vehicle:bus,base:hangar,checks,transportMode:"self-propelled",at:now,
});
const tow=assessFieldShip({
  vehicle:bus,base:hangar,checks,transportMode:"professional-tow",at:now,
});
const work=makeFieldShipDeskWorkCandidate({vehicle:bus,base:hangar,checks,at:now});
const cross=makeFieldShipCrossingDraft({vehicle:bus,base:hangar,checks,at:now});
for(const plan of [inspection,drive,tow]){
  if(plan.vehicle_operation_authorized || plan.vehicle_tow_authorized ||
     plan.land_entry_authorized || plan.house_utility_connection_authorized ||
     plan.ghot_actuation_authorized)throw Error("FIELD_SHIP_AUTHORITY_ESCALATION");
}
if(drive.review_state!=="HOLD" || tow.review_state!=="HOLD" ||
   inspection.review_state!=="INSPECTION_PLAN_ONLY")
  throw Error("FIELD_SHIP_UNGROUNDED_READINESS");
const publicRecord={
  schema:"gro.field-ship-demo-evidence/v0",
  simulation_only:true,
  real_title_or_insurance_verified:false,
  real_staging_property_identity_known:false,
  ship_candidate_id:bus.candidate_id,
  staging_base_id:hangar.base_id,
  separate_nm_property_identity_linked:false,
  other_land_candidate_relation:hangar.relation_to_other_land_candidate,
  separate_land_claim_independently_verified:false,
  inspect:inspection,
  drive,professional_tow:tow,
  ghot_task_candidate:work,
  relatte_crossing_draft:cross.spec,
  relatte_payload_utf8:cross.bytes.toString("utf8"),
  ghot_task_dispatched:false,hardware_tested:false,
  real_world_vehicle_movement_authorized:false,
  physical_work_executed:0,
};
const output=process.argv[2];
if(output){
  await mkdir(output,{recursive:true});
  await writeFile(output+"/synthetic-field-ship-003.json",
    JSON.stringify(publicRecord,null,2)+"\n",{flag:"wx"});
}
console.log(JSON.stringify({
  result:"FIELD-SHIP-003",
  simulation_only:true,
  ship_candidate_id:bus.candidate_id,
  hangar_candidate_id:hangar.base_id,
  inspection:inspection.review_state,
  driving:drive.review_state,
  qualified_tow:tow.review_state,
  ghot_task_proposed:true,
  relatte_signed_crossing_created:false,
  ship_moved:false,
  roadworthy_claim:false,
  property_rights_claim:false,
}));
