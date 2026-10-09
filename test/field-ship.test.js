import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  makePropertyCandidate, PROPERTY_TOPICS, assessPropertyCandidate,
} from "../src/property-readiness.js";
import {
  SHIP_STAGING_PERMISSIONS,SHIP_CHECKS,makeStagingBase,
  makeFieldShipChecklist,assessFieldShip,
  makeFieldShipDeskWorkCandidate,makeFieldShipCrossingDraft,
} from "../src/field-ship.js";
const at="2026-10-09T20:30:00.000Z";
const before="2026-10-09T19:30:00.000Z";
const past="2026-10-09T20:00:00.000Z";
const after="2026-10-09T21:00:00.000Z";
const reviewed=()=>({
  state:"reviewed",reviewed_at:before,expires_at:null,revoked_at:null,
});
function vehicle(activity="vehicle-relocation"){
  const c=makePropertyCandidate("PRIVATE_BUS_NICKNAME_DONT_EXPORT");
  c.asset_kind="vehicle";c.activity=activity;
  c.private_location="PRIVATE_PARENTS_ADDRESS_NOT_A_DOCUMENT";
  c.private_notes="PHOTO_TITLE_VIN_PRIVATE_DATA";
  return c;
}
function completeDocs(c){
  const copy=structuredClone(c);
  for(const name of PROPERTY_TOPICS) {
    copy.evidence[name]={
      ...reviewed(),local_reference:"private:locally-reviewed-placeholder-"+name,
    };
  }
  return copy;
}
function fixture(){
  const base=makeStagingBase(),checks=makeFieldShipChecklist();
  const c=completeDocs(vehicle());
  for(const name of SHIP_CHECKS)checks[name]=reviewed();
  for(const name of SHIP_STAGING_PERMISSIONS)base.permission_reviews[name]=reviewed();
  return {vehicle:c,base,checks,at};
}
test("ship and hangar are independent opaque assets; neither implies the NM land site",()=>{
  const a=fixture();
  assert.match(a.vehicle.candidate_id,/^property-candidate:/);
  assert.match(a.base.base_id,/^staging-base:/);
  assert.notEqual(a.vehicle.candidate_id,a.base.base_id);
  assert.equal(a.base.relation_to_other_land_candidate,"unresolved");
  assert.equal(a.base.title_to_vehicle_claimed,false);
  assert.equal(a.base.house_utilities_authorized,false);
  const assessment=assessFieldShip({...a,transportMode:"undecided"});
  assert.equal(assessment.review_state,"INSPECTION_PLAN_ONLY");
  assert.equal(assessment.other_land_candidate_linked,false);
  assert.equal(assessment.vehicle_operation_authorized,false);
  assert.equal(assessment.vehicle_tow_authorized,false);
  assert.equal(assessment.ghot_actuation_authorized,false);
});
test("nonrunning bus needs inspection and vehicle records; a title or RV-insurance claim alone cannot clear road use",()=>{
  const f=fixture();
  const c=vehicle();
  c.evidence.vehicle_title_record={
    state:"claimed",local_reference:"private:title-photo",
    reviewed_at:null,expires_at:null,revoked_at:null,
  };
  c.evidence.vehicle_insurance_scope={
    state:"claimed",local_reference:"private:insurance-description",
    reviewed_at:null,expires_at:null,revoked_at:null,
  };
  const result=assessFieldShip({...f,vehicle:c,transportMode:"self-propelled"});
  assert.equal(result.review_state,"HOLD");
  assert.ok(result.documentary_blockers.includes("vehicle_title_record"));
  assert.ok(result.documentary_blockers.includes("vehicle_insurance_scope"));
  assert.equal(result.vehicle_safe_to_drive_certified,false);
  assert.equal(result.legal_road_permission_proven,false);
});
test("a fictional 100% reviewed packet STILL never authorizes driving, towing, entering or using house power",()=>{
  const f=fixture();
  for(const mode of ["self-propelled","professional-tow"]){
    const result=assessFieldShip({...f,transportMode:mode});
    assert.equal(result.review_state,"READY_FOR_SEPARATE_QUALIFIED_HUMAN_DECISION");
    assert.deepEqual(result.documentary_blockers,[]);
    assert.deepEqual(result.mechanical_and_operator_blockers,[]);
    assert.deepEqual(result.staging_permission_blockers,[]);
    assert.equal(result.vehicle_operation_authorized,false);
    assert.equal(result.vehicle_tow_authorized,false);
    assert.equal(result.house_utility_connection_authorized,false);
    assert.equal(result.land_entry_authorized,false);
    assert.equal(result.completed_vehicle_inspection_proven,false);
    assert.equal(result.vehicle_safe_to_drive_certified,false);
    assert.equal(result.vehicle_safe_to_tow_certified,false);
  }
});
test("drive requires brakes/engine/qualified driver; professional tow has a distinct nonself-propelled review",()=>{
  const f=fixture();
  f.checks.powertrain_cooling={state:"missing",reviewed_at:null,expires_at:null,revoked_at:null};
  f.checks.battery_and_starting={state:"missing",reviewed_at:null,expires_at:null,revoked_at:null};
  f.checks.qualified_driver={state:"missing",reviewed_at:null,expires_at:null,revoked_at:null};
  const drive=assessFieldShip({...f,transportMode:"self-propelled"});
  assert.equal(drive.review_state,"HOLD");
  assert.ok(drive.mechanical_and_operator_blockers.includes("powertrain_cooling"));
  assert.ok(drive.mechanical_and_operator_blockers.includes("qualified_driver"));
  const tow=assessFieldShip({...f,transportMode:"professional-tow"});
  assert.equal(tow.review_state,"READY_FOR_SEPARATE_QUALIFIED_HUMAN_DECISION");
  assert.equal(tow.vehicle_tow_authorized,false);
  f.checks.towing_points_and_equipment={
    state:"claimed",reviewed_at:null,expires_at:null,revoked_at:null,
  };
  assert.ok(assessFieldShip({...f,transportMode:"professional-tow"})
    .mechanical_and_operator_blockers.includes("towing_points_and_equipment"));
});
test("land custodian review is separately required for inspection, repairs, departure and utilities",()=>{
  const f=fixture();
  f.base.permission_reviews.departure_access={state:"missing",reviewed_at:null,expires_at:null,revoked_at:null};
  const move=assessFieldShip({...f,transportMode:"self-propelled"});
  assert.equal(move.review_state,"HOLD");
  assert.deepEqual(move.staging_permission_blockers,["departure_access"]);
  const diff=structuredClone(f);
  diff.base.permission_reviews.inspection_access={
    state:"claimed",reviewed_at:null,expires_at:null,revoked_at:null,
  };
  assert.equal(assessFieldShip({...diff,transportMode:"professional-tow"}).review_state,"HOLD");
  const forged=structuredClone(f);
  forged.base.house_utilities_authorized=true;
  assert.throws(()=>assessFieldShip({...forged,transportMode:"undecided"}),
    /FIELD_SHIP_BASE_CANNOT_MINT_RIGHTS/);
});
test("expired and revoked base permissions and stale mechanical evidence fail closed",()=>{
  const f=fixture();
  f.base.permission_reviews.departure_access={...reviewed(),expires_at:past};
  f.checks.service_and_parking_brakes={...reviewed(),revoked_at:past};
  const v=assessFieldShip({...f,transportMode:"self-propelled"});
  assert.equal(v.review_state,"HOLD");
  assert.deepEqual(v.staging_permission_blockers,["departure_access"]);
  assert.ok(v.mechanical_and_operator_blockers.includes("service_and_parking_brakes"));
  const future=fixture();
  future.checks.qualified_driver={...reviewed(),reviewed_at:after};
  assert.ok(assessFieldShip({...future,transportMode:"self-propelled"})
    .mechanical_and_operator_blockers.includes("qualified_driver"));
});
test("GrO/GHoT and reLATTE bridge proposals disclose only opaque IDs and never actuate",()=>{
  const f=fixture();
  const task=makeFieldShipDeskWorkCandidate(f);
  assert.equal(task.kind,"ghot.task");
  assert.equal(task.version,"0");
  assert.equal(task.capability,"gro.field-ship.desktop-inventory.v0");
  assert.equal(task.constraints.vehicle_actuation,false);
  assert.equal(task.constraints.installed_capability_confirmed,false);
  assert.equal(task.constraints.human_authorization_required,true);
  const crossing=makeFieldShipCrossingDraft(f);
  assert.equal(crossing.spec.schema,"relatte.opaque-organ-spec/v0");
  assert.equal(crossing.spec.requested_effect.authority,"receiver-local");
  assert.equal(crossing.spec.requested_effect.vehicle_actuation,false);
  const hash=createHash("sha256").update(crossing.bytes).digest("hex");
  assert.equal(crossing.spec.payload_refs[0].address,"sha256:"+hash);
  const text=JSON.stringify({task,crossing:{spec:crossing.spec,body:crossing.bytes.toString()}});
  assert.equal(text.includes("PRIVATE_PARENTS_ADDRESS"),false);
  assert.equal(text.includes("PHOTO_TITLE_VIN_PRIVATE_DATA"),false);
  assert.equal(text.includes("PRIVATE_BUS_NICKNAME"),false);
  assert.equal(crossing.spec.donor_claims.property_authority_transfer,false);
});
test("unclassified land assets and invalid mode cannot become a road-going ship",()=>{
  const f=fixture();
  const land=makePropertyCandidate("field");
  land.asset_kind="land";land.activity="land-title-research";
  assert.throws(()=>assessFieldShip({...f,vehicle:land}),/FIELD_SHIP_NOT_A_VEHICLE/);
  assert.throws(()=>assessFieldShip({...f,transportMode:"autonomous-robot"}),
    /FIELD_SHIP_BAD_MODE/);
  const inspect=vehicle("vehicle-inspection");
  assert.throws(()=>assessFieldShip({...f,vehicle:inspect,transportMode:"self-propelled"}),
    /FIELD_SHIP_MOVE_REQUIRES_RELOCATION_REVIEW/);
});
