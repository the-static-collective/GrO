import { createHash } from "node:crypto";
import { stableStringify } from "./stable.js";
import { assessFieldShip, makeFieldShipChecklist, makeStagingBase } from "./field-ship.js";
import { validatePropertyIntake, PROPERTY_PRIVATE_SCHEMA } from "./property-readiness.js";

/**
 * ECM-004: An offline, non-actuating triage instrument for the Static Field Ship.
 * "Needs an ECM" is a reported repair lead, not a proven diagnosis.
 * No VIN, engine serial, calibration file, key, title or private site details
 * are accepted or emitted by public witnesses.
 */
export const ECM_RECOVERY_SCHEMA = "gro.field-ship-ecm-004/v0";
export const ECM_STEPS = Object.freeze([
  "engine_family",
  "original_ecm_hardware_id",
  "existing_fault_diagnosis",
  "battery_and_ecm_supply",
  "ecm_ground_integrity",
  "connectors_and_harness",
  "diagnostic_network_and_other_modules",
  "replacement_hardware_compatibility",
  "authorized_calibration_programming",
  "post_install_fault_recheck",
  "professional_controlled_start_review",
]);
export const ECM_ACQUISITION_CHECKS = Object.freeze([
  "engine_family",
  "original_ecm_hardware_id",
  "existing_fault_diagnosis",
  "battery_and_ecm_supply",
  "ecm_ground_integrity",
  "connectors_and_harness",
  "diagnostic_network_and_other_modules",
  "replacement_hardware_compatibility",
  "authorized_calibration_programming",
]);
export const ECM_INSTALL_CHECKS = Object.freeze([
  ...ECM_ACQUISITION_CHECKS,
  "post_install_fault_recheck",
  "professional_controlled_start_review",
]);
const RECORD_KEYS = ["state","reviewed_at","expires_at","revoked_at"];
const SHAPE = ["schema","diagnosis_source","repair_lead","records","no_privileged_actuation"];
const DATE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/;
function validTime(x) {
  if(typeof x!=="string" || !DATE.test(x) || !Number.isFinite(Date.parse(x)))
    throw Error("ECM_BAD_TIMESTAMP");
  return Date.parse(x);
}
function exact(x,keys,msg){
  if(x===null || typeof x!=="object" || Array.isArray(x) ||
    Object.keys(x).sort().join("|") !== [...keys].sort().join("|"))
    throw Error(msg);
}
export function blankEcmRecord() {
  return {state:"missing",reviewed_at:null,expires_at:null,revoked_at:null};
}
export function makeEcmRecoveryPacket(){
  return {
    schema:ECM_RECOVERY_SCHEMA,
    diagnosis_source:"participant-reported",
    repair_lead:"engine-control-module",
    records:Object.fromEntries(ECM_STEPS.map(k=>[k,blankEcmRecord()])),
    no_privileged_actuation:true,
  };
}
function evidenceStatus(v,at){
  exact(v,RECORD_KEYS,"ECM_UNEXPECTED_EVIDENCE_FIELDS");
  if(!["missing","claimed","reviewed"].includes(v.state))throw Error("ECM_INVALID_EVIDENCE_STATE");
  for(const k of ["reviewed_at","expires_at","revoked_at"])
    if(v[k]!==null)validTime(v[k]);
  if(v.state==="missing" &&
    (v.reviewed_at!==null||v.expires_at!==null||v.revoked_at!==null))
    throw Error("ECM_MISSING_WITH_DATES");
  if(v.state==="claimed" && v.reviewed_at!==null)
    throw Error("ECM_CLAIM_CANNOT_SELF_REVIEW");
  if(v.state==="reviewed" && v.reviewed_at===null)
    throw Error("ECM_REVIEW_NEEDS_DATE");
  if(v.expires_at!==null && v.reviewed_at!==null &&
    validTime(v.expires_at)<=validTime(v.reviewed_at))
    throw Error("ECM_BAD_EXPIRY");
  if(v.revoked_at!==null && validTime(v.revoked_at)<=validTime(at))return "revoked";
  if(v.expires_at!==null && validTime(v.expires_at)<=validTime(at))return "expired";
  if(v.state==="reviewed" && validTime(v.reviewed_at)>validTime(at))return "claimed";
  return v.state;
}
export function assessEcmRecovery({vehicle,packet,at}) {
  validTime(at);
  validatePropertyIntake({schema:PROPERTY_PRIVATE_SCHEMA,candidates:[vehicle]});
  if(vehicle.asset_kind!=="vehicle")throw Error("ECM_NOT_VEHICLE");
  exact(packet,SHAPE,"ECM_PACKET_FIELDS");
  if(packet.schema!==ECM_RECOVERY_SCHEMA ||
    packet.diagnosis_source!=="participant-reported" ||
    packet.repair_lead!=="engine-control-module" ||
    packet.no_privileged_actuation!==true)
    throw Error("ECM_DIAGNOSIS_NOT_AUTHORITY");
  exact(packet.records,ECM_STEPS,"ECM_CHECKLIST_FIELDS");
  const states=Object.fromEntries(ECM_STEPS.map(k=>[k,evidenceStatus(packet.records[k],at)]));
  const beforePurchase=ECM_ACQUISITION_CHECKS.filter(k=>states[k]!=="reviewed");
  const beforeInstall=ECM_INSTALL_CHECKS.filter(k=>states[k]!=="reviewed");
  return {
    schema:"gro.field-ship-ecm-assessment/v0",
    vehicle_candidate_id:vehicle.candidate_id,
    repair_lead:"engine-control-module",
    diagnosis_source:"participant-reported",
    current_date:at,
    review_states:states,
    sourcing_review_blockers:beforePurchase,
    commissioning_review_blockers:beforeInstall,
    next_recommended_stage:beforePurchase.length
      ? "QUALIFIED_DIAGNOSIS_AND_MODULE_IDENTIFICATION"
      : beforeInstall.length
        ? "AUTHORIZED_INSTALLATION_PROGRAMMING_AND_POSTCHECK"
        : "READY_FOR_SEPARATE_QUALIFIED_TECHNICIAN_RELEASE",
    engine_family_independently_confirmed_by_software:false,
    replacement_part_compatibility_independently_confirmed:false,
    oem_calibration_available_confirmed:false,
    purchase_authorized:false,
    programming_authorized:false,
    engine_start_authorized:false,
    propulsion_control_authorized:false,
    vehicle_safe_to_drive_certified:false,
    human_mechanic_signoff_required:true,
  };
}
export function makeEcmDeskStudyCandidate({vehicle,packet,at}){
  const assessment=assessEcmRecovery({vehicle,packet,at});
  const core={
    kind:"ghot.task",version:"0",
    capability:"gro.field-ship.ecm-desk-review.v0",
    created_at:at,
    requester_node_id:"gro:field-ship-private-review",
    input:{
      schema:"gro.field-ship-ecm-desk-input/v0",
      vehicle_candidate_id:vehicle.candidate_id,
      diagnosis_source:"participant-reported",
      review_topics:assessment.sourcing_review_blockers,
      private_part_numbers_included:false,
      no_engine_serial_or_vin:true,
    },
    constraints:{
      network:false,arbitrary_shell:false,vehicle_actuation:false,
      engine_start:false,module_programming:false,
      purchase_authorized:false,
      physical_work:false,worker_selected:false,
    },
  };
  return {...core,task_id:"gro-field-ship-ecm-task:"+
    createHash("sha256").update("GrO-ECM004-Task|"+stableStringify(core)).digest("hex")};
}
