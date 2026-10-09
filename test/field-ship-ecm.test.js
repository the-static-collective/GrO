import test from "node:test";
import assert from "node:assert/strict";
import { makePropertyCandidate } from "../src/property-readiness.js";
import {
  makeEcmRecoveryPacket, assessEcmRecovery, ECM_STEPS,
  ECM_ACQUISITION_CHECKS, makeEcmDeskStudyCandidate,
} from "../src/field-ship-ecm.js";
const at="2026-10-09T20:30:00.000Z";
const before="2026-10-09T19:30:00.000Z";
const past="2026-10-09T20:00:00.000Z";
const after="2026-10-09T21:00:00.000Z";
const vehicle=()=>{
  const c=makePropertyCandidate("VERY_PRIVATE_BUS_NAME");
  c.asset_kind="vehicle";c.activity="vehicle-inspection";
  c.private_notes="VERY_PRIVATE_VIN_AND_TITLE_NUMBERS";
  c.private_location="VERY_PRIVATE_FAMILY_LOCATION";
  return c;
};
const reviewed=()=>({state:"reviewed",reviewed_at:before,expires_at:null,revoked_at:null});
const complete=()=>{
  const p=makeEcmRecoveryPacket();
  for(const k of ECM_STEPS)p.records[k]=reviewed();
  return p;
};

test("a reported ECM failure is a repair lead, never a diagnosed bad controller",()=>{
  const a=assessEcmRecovery({vehicle:vehicle(),packet:makeEcmRecoveryPacket(),at});
  assert.equal(a.repair_lead,"engine-control-module");
  assert.equal(a.diagnosis_source,"participant-reported");
  assert.equal(a.next_recommended_stage,"QUALIFIED_DIAGNOSIS_AND_MODULE_IDENTIFICATION");
  assert.deepEqual(a.sourcing_review_blockers,[...ECM_ACQUISITION_CHECKS]);
  for(const gate of ["purchase_authorized","programming_authorized",
    "engine_start_authorized","propulsion_control_authorized",
    "replacement_part_compatibility_independently_confirmed",
    "vehicle_safe_to_drive_certified"]){
    assert.equal(a[gate],false);
  }
});
test("even reported confirmation of an ECM part number cannot skip power, grounds or harness checks",()=>{
  const packet=makeEcmRecoveryPacket();
  packet.records.original_ecm_hardware_id=reviewed();
  packet.records.engine_family=reviewed();
  packet.records.existing_fault_diagnosis={state:"claimed",
    reviewed_at:null,expires_at:null,revoked_at:null};
  const a=assessEcmRecovery({vehicle:vehicle(),packet,at});
  assert.ok(a.sourcing_review_blockers.includes("existing_fault_diagnosis"));
  assert.ok(a.sourcing_review_blockers.includes("battery_and_ecm_supply"));
  assert.ok(a.sourcing_review_blockers.includes("ecm_ground_integrity"));
  assert.ok(a.sourcing_review_blockers.includes("connectors_and_harness"));
  assert.ok(a.sourcing_review_blockers.includes("authorized_calibration_programming"));
});
test("replacement compatibility requires engine, module and lawful programming review",()=>{
  const packet=complete();
  packet.records.replacement_hardware_compatibility={
    state:"missing",reviewed_at:null,expires_at:null,revoked_at:null};
  packet.records.authorized_calibration_programming={
    state:"claimed",reviewed_at:null,expires_at:null,revoked_at:null};
  const a=assessEcmRecovery({vehicle:vehicle(),packet,at});
  assert.equal(a.next_recommended_stage,"QUALIFIED_DIAGNOSIS_AND_MODULE_IDENTIFICATION");
  assert.ok(a.sourcing_review_blockers.includes("replacement_hardware_compatibility"));
  assert.ok(a.sourcing_review_blockers.includes("authorized_calibration_programming"));
});
test("all sourcing evidence can advance to technician review, never auto-program or crank",()=>{
  const packet=complete();
  packet.records.post_install_fault_recheck={
    state:"missing",reviewed_at:null,expires_at:null,revoked_at:null};
  packet.records.professional_controlled_start_review={
    state:"missing",reviewed_at:null,expires_at:null,revoked_at:null};
  const a=assessEcmRecovery({vehicle:vehicle(),packet,at});
  assert.deepEqual(a.sourcing_review_blockers,[]);
  assert.deepEqual(a.commissioning_review_blockers,[
    "post_install_fault_recheck","professional_controlled_start_review"]);
  assert.equal(a.next_recommended_stage,"AUTHORIZED_INSTALLATION_PROGRAMMING_AND_POSTCHECK");
  assert.equal(a.programming_authorized,false);
  assert.equal(a.engine_start_authorized,false);
});
test("all locally reviewed boxes remain independent of actual mechanical release",()=>{
  const a=assessEcmRecovery({vehicle:vehicle(),packet:complete(),at});
  assert.deepEqual(a.commissioning_review_blockers,[]);
  assert.equal(a.next_recommended_stage,"READY_FOR_SEPARATE_QUALIFIED_TECHNICIAN_RELEASE");
  assert.equal(a.oem_calibration_available_confirmed,false);
  assert.equal(a.engine_start_authorized,false);
  assert.equal(a.vehicle_safe_to_drive_certified,false);
});
test("expired, revoked, future-dated and unverified evidence fail closed",()=>{
  const packet=complete();
  packet.records.ecm_ground_integrity={...reviewed(),revoked_at:past};
  packet.records.battery_and_ecm_supply={...reviewed(),expires_at:past};
  packet.records.connectors_and_harness={...reviewed(),reviewed_at:after};
  const a=assessEcmRecovery({vehicle:vehicle(),packet,at});
  assert.ok(a.sourcing_review_blockers.includes("ecm_ground_integrity"));
  assert.ok(a.sourcing_review_blockers.includes("battery_and_ecm_supply"));
  assert.ok(a.sourcing_review_blockers.includes("connectors_and_harness"));
  assert.equal(a.review_states.ecm_ground_integrity,"revoked");
  assert.equal(a.review_states.battery_and_ecm_supply,"expired");
  assert.equal(a.review_states.connectors_and_harness,"claimed");
});
test("signed diagnosis-sounding claims cannot transform software into a repair permit",()=>{
  const packet=complete();
  packet.diagnosis_source="qualified-mechanic";
  assert.throws(()=>assessEcmRecovery({vehicle:vehicle(),packet,at}),
    /ECM_DIAGNOSIS_NOT_AUTHORITY/);
  const tampered=complete();
  tampered.no_privileged_actuation=false;
  assert.throws(()=>assessEcmRecovery({vehicle:vehicle(),packet:tampered,at}),
    /ECM_DIAGNOSIS_NOT_AUTHORITY/);
  const extra=complete();
  extra.records.engine_family.oem_verified=true;
  assert.throws(()=>assessEcmRecovery({vehicle:vehicle(),packet:extra,at}),
    /ECM_UNEXPECTED_EVIDENCE_FIELDS/);
});
test("GHoT proposal is read-only and cannot leak vehicle-identifying information",()=>{
  const c=vehicle();
  const task=makeEcmDeskStudyCandidate({vehicle:c,packet:makeEcmRecoveryPacket(),at});
  assert.equal(task.kind,"ghot.task");
  assert.equal(task.version,"0");
  assert.equal(task.constraints.vehicle_actuation,false);
  assert.equal(task.constraints.engine_start,false);
  assert.equal(task.constraints.module_programming,false);
  assert.equal(task.constraints.worker_selected,false);
  const bytes=JSON.stringify(task);
  for(const privateText of ["VERY_PRIVATE_VIN_AND_TITLE","VERY_PRIVATE_BUS_NAME",
    "VERY_PRIVATE_FAMILY_LOCATION"])assert.equal(bytes.includes(privateText),false);
});
test("land cannot become a vehicle controller acquisition plan",()=>{
  const land=makePropertyCandidate("land");
  land.asset_kind="land";land.activity="land-title-research";
  assert.throws(()=>assessEcmRecovery({vehicle:land,packet:makeEcmRecoveryPacket(),at}),
    /ECM_NOT_VEHICLE/);
});
