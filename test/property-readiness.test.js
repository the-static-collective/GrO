import test from "node:test";
import assert from "node:assert/strict";
import {
  PROPERTY_PRIVATE_SCHEMA, PROPERTY_PUBLIC_SCHEMA, PROPERTY_TOPICS,
  makePropertyCandidate, makePropertyIntake, validatePropertyIntake,
  assessPropertyCandidate, generatePropertyPrivacyKey,
  makePropertyPublicReport, verifyPropertyPublicReport,
  makePropertyDesktopStudyTask,
} from "../src/property-readiness.js";
import { createLandIdentity, publicKeyFingerprint } from "../src/land-crossing.js";

const at="2026-10-09T18:00:00.000Z";
const later="2026-10-09T20:00:00.000Z";
const earlier="2026-10-09T16:00:00.000Z";
const updateEvidence = (candidate,topic,state="reviewed",extra={}) => {
  const c=structuredClone(candidate);
  c.evidence[topic]={
    state,local_reference:state==="missing"?"":"private:stored-offline-"+topic,
    reviewed_at:state==="reviewed"?earlier:null,
    expires_at:null,revoked_at:null,...extra,
  };
  return c;
};
const withReviewedTopics = (candidate,topics) =>
  topics.reduce((c,t)=>updateEvidence(c,t),candidate);

test("private fixture is two unrelated opaque candidates with all missing evidence",()=>{
  const intake=makePropertyIntake();
  assert.equal(validatePropertyIntake(intake),true);
  assert.equal(intake.schema,PROPERTY_PRIVATE_SCHEMA);
  assert.equal(intake.candidates.length,2);
  assert.notEqual(intake.candidates[0].candidate_id,intake.candidates[1].candidate_id);
  assert.ok(intake.candidates.every(c=>Object.keys(c.evidence).length===PROPERTY_TOPICS.length));
  assert.ok(intake.candidates.every(c=>!c.private_location && !c.private_contact));
});

test("private fields and human-readable references never leak into redacted public report",()=>{
  const intake=makePropertyIntake();
  const secret="123 Secret Lane, confidential recipient information - not to be published";
  intake.candidates[0].private_label="Personal Back Garden";
  intake.candidates[0].private_location=secret;
  intake.candidates[0].private_contact="private+person@example.test";
  intake.candidates[0].private_notes="private-note: family arrangements";
  intake.candidates[0]=updateEvidence(intake.candidates[0],"authority","claimed",{
    local_reference:"/secret/private/deed-123.pdf",
  });
  const identity=createLandIdentity();
  const privacyKey=generatePropertyPrivacyKey();
  const publicReport=makePropertyPublicReport({intake,privacyKey,identity,at});
  const data=JSON.stringify(publicReport);
  for(const privateText of [secret,"Personal Back Garden","private+person@example.test",
    "family arrangements","deed-123.pdf"]){
    assert.equal(data.includes(privateText),false);
  }
  assert.equal(publicReport.body.schema,PROPERTY_PUBLIC_SCHEMA);
  assert.equal(publicReport.body.grant_of_property_rights,false);
  assert.equal(publicReport.body.field_activity_authorized,false);
  assert.equal(publicReport.body.auto_admission,false);
  assert.equal(verifyPropertyPublicReport(publicReport,identity.publicKey),true);
  assert.equal(verifyPropertyPublicReport(publicReport,createLandIdentity().publicKey),false);
  assert.match(publicKeyFingerprint(identity.publicKey),/^sha256:[0-9a-f]{64}$/);
});

test("an HMAC commitment changes under different unpublished keys",()=>{
  const intake=makePropertyIntake();
  intake.candidates[0]=updateEvidence(intake.candidates[0],"authority","claimed");
  const identity=createLandIdentity();
  const a=makePropertyPublicReport({intake,identity,privacyKey:generatePropertyPrivacyKey(),at});
  const b=makePropertyPublicReport({intake,identity,privacyKey:generatePropertyPrivacyKey(),at});
  assert.notEqual(a.body.candidates[0].private_evidence_commitments[0].commitment,
    b.body.candidates[0].private_evidence_commitments[0].commitment);
});

test("missing, self-claimed, revoked and expired review evidence all HOLD a visit",()=>{
  let c=makePropertyCandidate("Site A");
  c.activity="site-visit";
  assert.equal(assessPropertyCandidate(c,at).review_packet_status,"HOLD");
  c=updateEvidence(c,"authority","claimed");
  assert.ok(assessPropertyCandidate(c,at).blocking_topics.includes("authority"));
  c=withReviewedTopics(c,[
    "authority","steward_consent","occupant_access","activity_scope","local_rules","site_safety",
  ]);
  assert.equal(assessPropertyCandidate(c,at).review_packet_status,"READY_FOR_INDEPENDENT_HUMAN_DECISION");
  assert.equal(assessPropertyCandidate(c,at).entry_authorized,false);
  const expired=updateEvidence(c,"authority","reviewed",{expires_at:earlier.replace("16:","17:")});
  assert.equal(assessPropertyCandidate(expired,at).review_packet_status,"HOLD");
  assert.equal(assessPropertyCandidate(expired,at).evidence_counts.expired,1);
  const revoked=updateEvidence(c,"steward_consent","reviewed",{revoked_at:earlier.replace("16:","17:")});
  assert.equal(assessPropertyCandidate(revoked,at).review_packet_status,"HOLD");
  assert.ok(assessPropertyCandidate(revoked,at).blocking_topics.includes("steward_consent"));
});

test("future-dated reviews cannot satisfy present permission-preparation gates",()=>{
  let c=makePropertyCandidate("Site A");
  c.activity="site-visit";
  c=withReviewedTopics(c,[
    "authority","steward_consent","occupant_access","activity_scope","local_rules","site_safety",
  ]);
  c.evidence.authority.reviewed_at=later;
  const assessment=assessPropertyCandidate(c,at);
  assert.equal(assessment.review_packet_status,"HOLD");
  assert.ok(assessment.blocking_topics.includes("authority"));
  assert.equal(assessment.entry_authorized,false);
});

test("ready packet never means permission even if every evidence topic says reviewed",()=>{
  let c=makePropertyCandidate("Site A");
  c.activity="fabrication";
  c=withReviewedTopics(c,PROPERTY_TOPICS);
  const result=assessPropertyCandidate(c,at);
  assert.equal(result.review_packet_status,"READY_FOR_INDEPENDENT_HUMAN_DECISION");
  for(const k of ["external_identity_certified","legal_permission_proven_by_software",
    "entry_authorized","physical_work_authorized","automated_dispatch_allowed"]){
    assert.equal(result[k],false);
  }
  assert.equal(result.blocking_topics.length,0);
});

test("higher-risk work needs additional environmental and engineering reviews",()=>{
  let c=makePropertyCandidate("Site A");
  c.activity="solar-installation";
  c=withReviewedTopics(c,[
    "authority","steward_consent","occupant_access","activity_scope","local_rules","site_safety",
  ]);
  const assessment=assessPropertyCandidate(c,at);
  assert.equal(assessment.review_packet_status,"HOLD");
  assert.deepEqual(assessment.blocking_topics,["environmental_review","permits_and_engineering"]);
  assert.equal(assessment.physical_work_authorized,false);
});

test("private schema rejects unexpected publish flags, duplicate IDs and malformed records",()=>{
  const a=makePropertyIntake();
  assert.throws(()=>validatePropertyIntake({...a,publication_allowed:true}),/PROPERTY_PRIVATE_FIELDS/);
  const copy=structuredClone(a);
  copy.candidates[1].candidate_id=copy.candidates[0].candidate_id;
  assert.throws(()=>validatePropertyIntake(copy),/PROPERTY_INVALID_OR_DUPLICATE_CANDIDATE_ID/);
  const injected=structuredClone(a);
  injected.candidates[0].evidence.authority.legal_owner_confirmed=true;
  assert.throws(()=>validatePropertyIntake(injected),/PROPERTY_EVIDENCE_FIELDS/);
  const missing=structuredClone(a);
  missing.candidates[0].evidence.site_safety.state="missing";
  missing.candidates[0].evidence.site_safety.local_reference="secret";
  assert.throws(()=>validatePropertyIntake(missing),/PROPERTY_MISSING_HAS_HIDDEN_ASSERTIONS/);
});

test("unverified assertions cannot bypass source review requirements",()=>{
  const a=makePropertyCandidate("Site A");
  const c=updateEvidence(a,"steward_consent","reviewed",{local_reference:""});
  assert.throws(()=>assessPropertyCandidate(c,at),/PROPERTY_REVIEW_NEEDS_SOURCE_AND_DATE/);
  const d=updateEvidence(a,"authority","claimed",{reviewed_at:earlier});
  assert.throws(()=>assessPropertyCandidate(d,at),/PROPERTY_CLAIM_IS_NOT_REVIEW/);
  const e=updateEvidence(a,"site_safety","reviewed",{expires_at:earlier});
  assert.throws(()=>assessPropertyCandidate(e,at),/PROPERTY_EXPIRY_BEFORE_REVIEW/);
});

test("a signed public readiness report cannot assert physical entry or real rights",()=>{
  const intake=makePropertyIntake(),identity=createLandIdentity();
  const report=makePropertyPublicReport({intake,identity,privacyKey:generatePropertyPrivacyKey(),at});
  assert.equal(verifyPropertyPublicReport({...report,body:{
    ...report.body,grant_of_property_rights:true,
  }},identity.publicKey),false);
  assert.equal(verifyPropertyPublicReport({...report,body:{
    ...report.body,candidates:report.body.candidates.map((c,i)=>
      i===0?{...c,real_world_access_granted:true}:c),
  }},identity.publicKey),false);
  assert.equal(verifyPropertyPublicReport({...report,body:{
    ...report.body,candidates:report.body.candidates.map((c,i)=>
      i===0?{...c,private_location:"SECRET HOME"}:c),
  }},identity.publicKey),false);
});

test("only desk-only proposals can make GHoT-shaped candidate tasks",()=>{
  const c=makePropertyCandidate("Site A");
  const task=makePropertyDesktopStudyTask(c,at);
  assert.equal(task.kind,"ghot.task");
  assert.equal(task.version,"0");
  assert.equal(task.capability,"gro.property.private-review.v0");
  assert.equal(task.constraints.property_entry,false);
  assert.equal(task.constraints.physical_actuation,false);
  assert.equal(task.constraints.execution_authorized,false);
  assert.equal(task.input.private_details_included,false);
  assert.equal(JSON.stringify(task).includes("Site A"),false);
  c.activity="cleanup";
  assert.throws(()=>makePropertyDesktopStudyTask(c,at),/PROPERTY_DESK_ONLY/);
});


test("two asset categories produce separate evidence paths without assuming title or road use",()=>{
  const vehicle=makePropertyCandidate("Vehicle A");
  vehicle.asset_kind="vehicle";
  vehicle.activity="vehicle-inspection";
  const v=assessPropertyCandidate(vehicle,at);
  assert.equal(v.review_packet_status,"HOLD");
  assert.ok(v.required_topics.includes("vehicle_possession"));
  assert.ok(v.required_topics.includes("parking_permission"));
  assert.equal(v.required_topics.includes("land_title_chain"),false);
  assert.equal(v.entry_authorized,false);
  vehicle.activity="vehicle-relocation";
  const movement=assessPropertyCandidate(vehicle,at);
  assert.ok(movement.required_topics.includes("vehicle_title_record"));
  assert.ok(movement.required_topics.includes("vehicle_insurance_scope"));
  assert.ok(movement.required_topics.includes("vehicle_transport_plan"));
  assert.ok(movement.required_topics.includes("vehicle_condition"));
  assert.equal(movement.physical_work_authorized,false);
  const land=makePropertyCandidate("Land B");
  land.asset_kind="land";
  land.activity="site-visit";
  const l=assessPropertyCandidate(land,at);
  assert.ok(l.required_topics.includes("land_access_basis"));
  assert.ok(l.required_topics.includes("land_use_constraints"));
  assert.equal(l.required_topics.includes("vehicle_registration"),false);
  land.activity="land-title-research";
  const search=assessPropertyCandidate(land,at);
  assert.equal(search.review_packet_status,"DESK_STUDY_ONLY");
  assert.equal(search.entry_authorized,false);
});

test("mobile bus insurance claim alone never makes vehicle movable or habitable",()=>{
  let vehicle=makePropertyCandidate("Unnamed vehicle");
  vehicle.asset_kind="vehicle";
  vehicle.activity="vehicle-stationary-use";
  vehicle=updateEvidence(vehicle,"vehicle_insurance_scope","claimed");
  assert.equal(assessPropertyCandidate(vehicle,at).review_packet_status,"HOLD");
  assert.ok(assessPropertyCandidate(vehicle,at).blocking_topics.includes("vehicle_insurance_scope"));
  vehicle=updateEvidence(vehicle,"vehicle_insurance_scope","reviewed");
  assert.equal(assessPropertyCandidate(vehicle,at).review_packet_status,"HOLD");
  assert.ok(assessPropertyCandidate(vehicle,at).blocking_topics.includes("parking_permission"));
  assert.equal(assessPropertyCandidate(vehicle,at).physical_work_authorized,false);
});

test("land without a located deed remains in HOLD for work despite a map assertion",()=>{
  let parcel=makePropertyCandidate("Land candidate");
  parcel.asset_kind="land";
  parcel.activity="shared-resource";
  parcel=updateEvidence(parcel,"land_access_basis","claimed");
  assert.equal(assessPropertyCandidate(parcel,at).review_packet_status,"HOLD");
  assert.ok(assessPropertyCandidate(parcel,at).blocking_topics.includes("land_title_chain"));
  assert.ok(assessPropertyCandidate(parcel,at).blocking_topics.includes("land_access_basis"));
  assert.equal(assessPropertyCandidate(parcel,at).legal_permission_proven_by_software,false);
});

test("public report excludes private asset type and private annotations",()=>{
  const intake=makePropertyIntake();
  intake.candidates[0].asset_kind="vehicle";
  intake.candidates[0].activity="vehicle-inspection";
  intake.candidates[0].private_notes="secret vehicle identification internal-only";
  intake.candidates[1].asset_kind="land";
  intake.candidates[1].activity="land-title-research";
  intake.candidates[1].private_notes="secret survey reference internal-only";
  const identity=createLandIdentity();
  const report=makePropertyPublicReport({
    intake,privacyKey:generatePropertyPrivacyKey(),identity,at,
  });
  assert.equal(verifyPropertyPublicReport(report,identity.publicKey),true);
  const blob=JSON.stringify(report);
  assert.equal(blob.includes("secret vehicle identification"),false);
  assert.equal(blob.includes("secret survey reference"),false);
  assert.equal(blob.includes('"asset_kind"'),false);
});

test("vehicle-only activities are refused for land and unclassified sites",()=>{
  const land=makePropertyCandidate("Test");
  land.asset_kind="land";
  land.activity="vehicle-relocation";
  assert.throws(()=>assessPropertyCandidate(land,at),/PROPERTY_ASSET_ACTIVITY_MISMATCH/);
  const unspecified=makePropertyCandidate("Test");
  unspecified.activity="vehicle-inspection";
  assert.throws(()=>assessPropertyCandidate(unspecified,at),/PROPERTY_ASSET_ACTIVITY_MISMATCH/);
});
