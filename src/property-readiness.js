import { createHash, createHmac, randomBytes } from "node:crypto";
import { stableStringify } from "./stable.js";
import { createLandIdentity, publicKeyFingerprint, signLandEvent, verifyLandEvent } from "./land-crossing.js";

export const PROPERTY_PRIVATE_SCHEMA = "gro.property-002-private-intake/v0";
export const PROPERTY_PUBLIC_SCHEMA = "gro.property-002-redacted-report/v0";
export const PROPERTY_TOPICS = Object.freeze([
  "authority", "steward_consent", "occupant_access", "activity_scope",
  "local_rules", "site_safety", "environmental_review", "permits_and_engineering",
]);
export const PROPERTY_ACTIVITIES = Object.freeze([
  "desk-study", "site-visit", "noninvasive-survey", "cleanup", "gardening",
  "fabrication", "solar-installation", "shared-resource",
]);
const PRIVATE_KEYS = ["schema","candidates"];
const CANDIDATE_KEYS = ["candidate_id","private_label","private_location","private_contact","private_notes","activity","evidence"];
const EVIDENCE_KEYS = ["state","local_reference","reviewed_at","expires_at","revoked_at"];
const REQUIRED_SITE = ["authority","steward_consent","occupant_access","activity_scope","local_rules","site_safety"];
const EXTRA_FOR_PHYSICAL = ["environmental_review","permits_and_engineering"];

const isObj = x => x!==null && typeof x==="object" && !Array.isArray(x);
const exact = (obj,fields,why) => {
  if(!isObj(obj) || Object.keys(obj).sort().join("|")!==[...fields].sort().join("|"))
    throw new Error(why);
};
const timestamp = x => {
  if(typeof x!=="string" ||
     !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(x) ||
     !Number.isFinite(Date.parse(x)))throw new Error("PROPERTY_BAD_TIMESTAMP");
  return Date.parse(x);
};
function optionalTime(x) {if(x!==null) timestamp(x);}
const countOnly = x => typeof x==="string" && x.length<=5000;
const candidateKey = x => typeof x==="string" && /^property-candidate:[0-9a-f]{32}$/.test(x);
const evidenceState = x => ["missing","claimed","reviewed"].includes(x);

export function makePropertyCandidate(label="Site A") {
  if(typeof label!=="string" || label.length===0 || label.length>60)
    throw new Error("PROPERTY_PRIVATE_LABEL_REQUIRED");
  const evidence=Object.fromEntries(PROPERTY_TOPICS.map(topic=>[topic,{
    state:"missing",local_reference:"",reviewed_at:null,expires_at:null,revoked_at:null,
  }]));
  return {
    candidate_id:"property-candidate:"+randomBytes(16).toString("hex"),
    private_label:label,
    private_location:"",
    private_contact:"",
    private_notes:"",
    activity:"desk-study",
    evidence,
  };
}

export function makePropertyIntake() {
  return {
    schema:PROPERTY_PRIVATE_SCHEMA,
    candidates:[makePropertyCandidate("Site A"),makePropertyCandidate("Site B")],
  };
}

export function validatePropertyIntake(intake) {
  exact(intake,PRIVATE_KEYS,"PROPERTY_PRIVATE_FIELDS");
  if(intake.schema!==PROPERTY_PRIVATE_SCHEMA || !Array.isArray(intake.candidates) ||
     intake.candidates.length<1 || intake.candidates.length>12)
    throw new Error("PROPERTY_PRIVATE_SCHEMA");
  const ids=new Set();
  for(const c of intake.candidates) {
    exact(c,CANDIDATE_KEYS,"PROPERTY_CANDIDATE_FIELDS");
    if(!candidateKey(c.candidate_id) || ids.has(c.candidate_id))
      throw new Error("PROPERTY_INVALID_OR_DUPLICATE_CANDIDATE_ID");
    ids.add(c.candidate_id);
    if(![c.private_label,c.private_location,c.private_contact,c.private_notes].every(countOnly) ||
       !c.private_label.trim())throw new Error("PROPERTY_PRIVATE_TEXT_INVALID");
    if(!PROPERTY_ACTIVITIES.includes(c.activity))throw new Error("PROPERTY_UNKNOWN_ACTIVITY");
    exact(c.evidence,PROPERTY_TOPICS,"PROPERTY_EVIDENCE_TOPICS");
    for(const topic of PROPERTY_TOPICS) {
      const e=c.evidence[topic];
      exact(e,EVIDENCE_KEYS,"PROPERTY_EVIDENCE_FIELDS");
      if(!evidenceState(e.state) || typeof e.local_reference!=="string" || e.local_reference.length>2000)
        throw new Error("PROPERTY_EVIDENCE_RECORD");
      optionalTime(e.reviewed_at);optionalTime(e.expires_at);optionalTime(e.revoked_at);
      if(e.state==="missing" &&
         (e.local_reference!=="" || e.reviewed_at!==null || e.expires_at!==null || e.revoked_at!==null))
        throw new Error("PROPERTY_MISSING_HAS_HIDDEN_ASSERTIONS");
      if(e.state==="claimed" && e.reviewed_at!==null)
        throw new Error("PROPERTY_CLAIM_IS_NOT_REVIEW");
      if(e.state==="reviewed" &&
         (!e.local_reference.trim() || e.reviewed_at===null))
        throw new Error("PROPERTY_REVIEW_NEEDS_SOURCE_AND_DATE");
      if(e.expires_at!==null && e.reviewed_at!==null &&
         timestamp(e.expires_at)<=timestamp(e.reviewed_at))
        throw new Error("PROPERTY_EXPIRY_BEFORE_REVIEW");
    }
  }
  return true;
}

export function assessPropertyCandidate(candidate,at) {
  timestamp(at);
  // Validation deliberately uses a whole-envelope shape and never returns
  // a private field or copies location strings into assessment output.
  validatePropertyIntake({schema:PROPERTY_PRIVATE_SCHEMA,candidates:[candidate]});
  const needed=candidate.activity==="desk-study" ? [] :
    ["site-visit","noninvasive-survey"].includes(candidate.activity)
      ? REQUIRED_SITE
      : [...REQUIRED_SITE,...EXTRA_FOR_PHYSICAL];
  const blockers=[];
  const evidenceCounts={missing:0,claimed:0,reviewed:0,expired:0,revoked:0};
  for(const topic of PROPERTY_TOPICS) {
    const e=candidate.evidence[topic];
    const status=e.revoked_at!==null && timestamp(e.revoked_at)<=timestamp(at)
      ? "revoked"
      : e.expires_at!==null && timestamp(e.expires_at)<=timestamp(at)
        ? "expired"
        : e.state==="reviewed" && timestamp(e.reviewed_at)>timestamp(at)
          ? "claimed"
          : e.state;
    evidenceCounts[status]++;
    if(needed.includes(topic) && status!=="reviewed")blockers.push(topic);
  }
  return {
    schema:"gro.property-002-readiness/v0",
    candidate_id:candidate.candidate_id,
    activity:candidate.activity,
    reviewed_at:at,
    required_topics:[...needed],
    evidence_counts:evidenceCounts,
    blocking_topics:blockers,
    review_packet_status:
      needed.length===0 ? "DESK_STUDY_ONLY" :
      blockers.length ? "HOLD" : "READY_FOR_INDEPENDENT_HUMAN_DECISION",
    external_identity_certified:false,
    legal_permission_proven_by_software:false,
    entry_authorized:false,
    physical_work_authorized:false,
    automated_dispatch_allowed:false,
  };
}

/**
 * Local private HMAC key: prevents public guessing of a street address
 * or document filename from a bare SHA-256 commitment. Never publish key.
 */
export function generatePropertyPrivacyKey() {return randomBytes(32);}
function validatePrivacyKey(key) {
  if(!Buffer.isBuffer(key) || key.length!==32)throw new Error("PROPERTY_PRIVACY_KEY_REQUIRED");
}
function keyedCommitment(key,body) {
  validatePrivacyKey(key);
  return "hmac-sha256:"+createHmac("sha256",key)
    .update("GrO-Property002-PrivateCommitment-v0|"+stableStringify(body))
    .digest("hex");
}
/**
 * The only GitHub-safe artifact constructor. Deliberately uses a strict
 * allowlist, NOT object spread, so home addresses, legal names, documents,
 * coordinates, filenames, descriptions and private labels never enter it.
 * Publishing remains an explicit user choice.
 */
export function makePropertyPublicReport({intake,privacyKey,identity,at}) {
  validatePropertyIntake(intake);
  validatePrivacyKey(privacyKey);
  timestamp(at);
  if(!identity?.privateKey || !identity.publicKey)throw new Error("PROPERTY_SIGNER_REQUIRED");
  const records=intake.candidates.map(candidate=>{
    const assessed=assessPropertyCandidate(candidate,at);
    const commitments=PROPERTY_TOPICS.filter(topic=>candidate.evidence[topic].state!=="missing")
      .map(topic=>({
        topic,
        commitment:keyedCommitment(privacyKey,{
          candidate_id:candidate.candidate_id,
          topic,record:candidate.evidence[topic],
        }),
      }));
    return {
      candidate_id:candidate.candidate_id,
      activity:candidate.activity,
      review_packet_status:assessed.review_packet_status,
      evidence_counts:assessed.evidence_counts,
      blocked_topic_count:assessed.blocking_topics.length,
      private_evidence_commitments:commitments,
      human_decision_needed:true,
      real_world_access_granted:false,
      real_world_work_granted:false,
    };
  });
  const body={
    schema:PROPERTY_PUBLIC_SCHEMA,
    created_at:at,
    candidates:records,
    external_legal_authority_attested:false,
    grant_of_property_rights:false,
    field_activity_authorized:false,
    auto_admission:false,
  };
  return signLandEvent({kind:"PROPERTY_002_REDACTED_READINESS",body,identity});
}
export function verifyPropertyPublicReport(event,pinnedPublicKey) {
  try {
    if(!pinnedPublicKey || !verifyLandEvent(event,{
      kind:"PROPERTY_002_REDACTED_READINESS",pinnedKey:pinnedPublicKey,
    }))return false;
    const b=event.body;
    exact(b,[
      "schema","created_at","candidates","external_legal_authority_attested",
      "grant_of_property_rights","field_activity_authorized","auto_admission",
    ],"PROPERTY_PUBLIC_FIELDS");
    if(b.schema!==PROPERTY_PUBLIC_SCHEMA || !Array.isArray(b.candidates) ||
       b.candidates.length<1 || b.candidates.length>12 ||
       b.external_legal_authority_attested!==false ||
       b.grant_of_property_rights!==false ||
       b.field_activity_authorized!==false ||
       b.auto_admission!==false)return false;
    timestamp(b.created_at);
    const ids=new Set();
    for(const c of b.candidates) {
      exact(c,[
        "candidate_id","activity","review_packet_status","evidence_counts",
        "blocked_topic_count","private_evidence_commitments","human_decision_needed",
        "real_world_access_granted","real_world_work_granted",
      ],"PROPERTY_PUBLIC_CANDIDATE_FIELDS");
      if(!candidateKey(c.candidate_id) || ids.has(c.candidate_id) ||
         !PROPERTY_ACTIVITIES.includes(c.activity) ||
         !["DESK_STUDY_ONLY","HOLD","READY_FOR_INDEPENDENT_HUMAN_DECISION"].includes(c.review_packet_status) ||
         c.human_decision_needed!==true ||
         c.real_world_access_granted!==false || c.real_world_work_granted!==false)
        return false;
      ids.add(c.candidate_id);
      exact(c.evidence_counts,["missing","claimed","reviewed","expired","revoked"],"PROPERTY_COUNTS");
      if(Object.values(c.evidence_counts).some(n=>!Number.isSafeInteger(n)||n<0) ||
         Object.values(c.evidence_counts).reduce((a,n)=>a+n,0)!==PROPERTY_TOPICS.length ||
         !Number.isSafeInteger(c.blocked_topic_count) ||
         c.blocked_topic_count<0 || c.blocked_topic_count>PROPERTY_TOPICS.length ||
         !Array.isArray(c.private_evidence_commitments) ||
         c.private_evidence_commitments.length>PROPERTY_TOPICS.length)return false;
      const topics=new Set();
      for(const v of c.private_evidence_commitments) {
        exact(v,["topic","commitment"],"PROPERTY_PUBLIC_COMMITMENT");
        if(!PROPERTY_TOPICS.includes(v.topic)||topics.has(v.topic) ||
           !/^hmac-sha256:[0-9a-f]{64}$/.test(v.commitment))return false;
        topics.add(v.topic);
      }
      if(c.private_evidence_commitments.length >
         PROPERTY_TOPICS.length-c.evidence_counts.missing)return false;
      if(c.activity==="desk-study" && c.review_packet_status!=="DESK_STUDY_ONLY")return false;
      if(c.review_packet_status==="READY_FOR_INDEPENDENT_HUMAN_DECISION" &&
         c.blocked_topic_count!==0)return false;
      if(c.review_packet_status==="HOLD" && c.blocked_topic_count===0)return false;
    }
    return true;
  } catch{return false;}
}

/**
 * Prepares an *unexecuted* GHoT-shaped desk study proposal. No chosen
 * GHoT worker, installed executor, physical contact or external lookup.
 */
export function makePropertyDesktopStudyTask(candidate,at) {
  const assessment=assessPropertyCandidate(candidate,at);
  if(candidate.activity!=="desk-study")throw new Error("PROPERTY_DESK_ONLY");
  const core={
    kind:"ghot.task",version:"0",
    capability:"gro.property.private-review.v0",
    created_at:at,
    requester_node_id:"gro:local-private-prep",
    input:{
      schema:"gro.property-002-private-task-input/v0",
      candidate_id:candidate.candidate_id,
      question:"What permission and site-safety evidence is still needed?",
      private_details_included:false,
      human_review_required:true,
    },
    constraints:{
      network:false,arbitrary_shell:false,property_entry:false,
      physical_actuation:false,
      no_site_coordinates:true,
      execution_authorized:false,
      installed_capability_confirmed:false,
    },
  };
  return {...core,task_id:"gro-property-task:"+createHash("sha256")
    .update("GrO-Property002-GhotTask-v0|"+stableStringify(core)).digest("hex")};
}
