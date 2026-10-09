#!/usr/bin/env node
// PROPERTY-002 — strictly local site-candidate preparation.
// No network, file upload, geocoding, public parcel search or property access.
// Real addresses/document paths and all signer secrets must NEVER enter GitHub.
import { createPrivateKey, createPublicKey } from "node:crypto";
import { mkdir, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { dirname, resolve, relative, sep, join } from "node:path";
import {
  makePropertyIntake, validatePropertyIntake, assessPropertyCandidate,
  makePropertyPublicReport, verifyPropertyPublicReport,
  makePropertyDesktopStudyTask, makePropertyAssetPlan, generatePropertyPrivacyKey,
} from "../src/property-readiness.js";
import { createLandIdentity, publicKeyFingerprint } from "../src/land-crossing.js";

function refuseInsideRepository(path) {
  const cwd=resolve(process.cwd());
  const target=resolve(path);
  const rel=relative(cwd,target);
  if(!rel || (!rel.startsWith(".."+sep) && rel!==".." && !rel.startsWith(sep))){
    throw new Error("PRIVATE_DATA_MUST_BE_STORED_OUTSIDE_REPOSITORY");
  }
}
function safeAbsolute(path) {
  if(!path || !path.startsWith("/"))throw new Error("USE_AN_ABSOLUTE_PRIVATE_PATH");
  refuseInsideRepository(path);
  return resolve(path);
}
const readJson=async path=>JSON.parse(await readFile(path,"utf8"));
const createFile=async(path,content)=>{
  await writeFile(path,content,{flag:"wx",mode:0o600});
};
function futureFreeIso() {return new Date().toISOString();}
async function init(rootArg) {
  const root=safeAbsolute(rootArg);
  await mkdir(root,{mode:0o700,recursive:true});
  refuseInsideRepository(await realpath(root));
  const intake=makePropertyIntake();
  const key=createLandIdentity();
  await createFile(join(root,"intake.private.json"),JSON.stringify(intake,null,2)+"\n");
  await createFile(join(root,"hmac.secret"),generatePropertyPrivacyKey().toString("base64url")+"\n");
  await createFile(join(root,"signer.secret.pem"),
    key.privateKey.export({format:"pem",type:"pkcs8"}));
  await createFile(join(root,"signer.public.key"),key.publicKey+"\n");
  console.log(JSON.stringify({
    mode:"local-private-only",candidate_count:intake.candidates.length,
    site_ids:intake.candidates.map(c=>c.candidate_id),
    public_signer_fingerprint:publicKeyFingerprint(key.publicKey),
    storage:"outside-repository",published:false,
    next:"Edit private intake locally, then run audit. No addresses are sent anywhere.",
  }));
}
async function load(rootArg) {
  const root=safeAbsolute(rootArg);
  refuseInsideRepository(await realpath(root));
  const intake=await readJson(join(root,"intake.private.json"));
  validatePropertyIntake(intake);
  return {root,intake};
}
async function audit(rootArg) {
  const {intake}=await load(rootArg);
  const now=futureFreeIso();
  const summaries=intake.candidates.map(c=>{
    const s=assessPropertyCandidate(c,now);
    return {
      candidate_id:s.candidate_id,
      activity:s.activity,
      asset_kind:s.asset_kind,
      evidence_required:s.required_topics,
      review_packet_status:s.review_packet_status,
      blockers:s.blocking_topics,
      entry_authorized:false,
      physical_work_authorized:false,
    };
  });
  console.log(JSON.stringify({mode:"local-only",candidates:summaries,
    published:false,physical_work_authorized:false},null,2));
}
async function classify(rootArg,id,assetKind,activity) {
  if(!["vehicle","land"].includes(assetKind))throw new Error("PROPERTY_TYPE_MUST_BE_VEHICLE_OR_LAND");
  const {intake,root}=await load(rootArg);
  const candidate=intake.candidates.find(c=>c.candidate_id===id);
  if(!candidate)throw new Error("UNKNOWN_PRIVATE_CANDIDATE");
  const updated=structuredClone(intake);
  const dest=updated.candidates.find(c=>c.candidate_id===id);
  dest.asset_kind=assetKind;
  dest.activity=activity;
  validatePropertyIntake(updated);
  const newPath=join(root,"intake.private.json");
  const staged=join(root,".intake-"+process.pid+"-"+Date.now()+".tmp");
  await createFile(staged,JSON.stringify(updated,null,2)+"\\n");
  try {await rename(staged,newPath);}
  catch(e) {await import("node:fs/promises").then(fs=>fs.rm(staged,{force:true}));throw e;}
  const plan=makePropertyAssetPlan(dest,futureFreeIso());
  console.log(JSON.stringify({
    updated_locally:true,published:false,
    candidate_id:id,asset_kind:assetKind,activity,
    review_packet_status:"HOLD_OR_DESK_ONLY",
    evidence_to_review:plan.evidence_to_review,
    next:plan.next_action,
    entry_authorized:false,physical_work_authorized:false,
  },null,2));
}
async function deskTask(rootArg,id) {
  const {intake}=await load(rootArg);
  const candidate=intake.candidates.find(x=>x.candidate_id===id);
  if(!candidate)throw new Error("UNKNOWN_PRIVATE_CANDIDATE");
  const task=makePropertyDesktopStudyTask(candidate,futureFreeIso());
  // This is only a candidate task. It is not executed or sent to GHoT.
  console.log(JSON.stringify({mode:"unexecuted-private-candidate",task,dispatched:false},null,2));
}
async function explicitExport(rootArg,publicReportPath,approval) {
  if(approval!=="--explicit-redacted-export")throw new Error("EXPLICIT_EXPORT_OPT_IN_REQUIRED");
  const {root,intake}=await load(rootArg);
  const destination=resolve(publicReportPath);
  if(destination.startsWith(root+sep)||destination===root)
    throw new Error("REDACTED_REPORT_CANNOT_SHARE_PRIVATE_ROOT");
  if(destination.endsWith(".private.json"))throw new Error("OUTPUT_NAME_NOT_PUBLIC");
  const privateKey=createPrivateKey(await readFile(join(root,"signer.secret.pem"),"utf8"));
  const publicKey=await readFile(join(root,"signer.public.key"),"utf8");
  const identity={privateKey,publicKey:publicKey.trim()};
  const privacyKey=Buffer.from((await readFile(join(root,"hmac.secret"),"utf8")).trim(),"base64url");
  const report=makePropertyPublicReport({intake,privacyKey,identity,at:futureFreeIso()});
  if(!verifyPropertyPublicReport(report,identity.publicKey))throw new Error("PUBLIC_REPORT_FAILED_SELF_VERIFICATION");
  await mkdir(dirname(destination),{recursive:true});
  await createFile(destination,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({created:true,public_signer_fingerprint:publicKeyFingerprint(identity.publicKey),
    candidate_count:report.body.candidates.length,
    report_contains_private_site_addresses:false,
    report_contains_activity_and_readiness_metadata:true,
    publish_uploaded_by_program:false,
    real_property_permission:false,
    next:"Read the redacted file carefully before sharing; do not publish if metadata is sensitive.",
  }));
}
async function verifyReport(reportPath,expectedFingerprint) {
  if(!/^sha256:[0-9a-f]{64}$/.test(expectedFingerprint||""))
    throw new Error("PINNED_PUBLIC_FINGERPRINT_REQUIRED");
  const report=await readJson(reportPath);
  const publicKey=report?.signing?.public_key;
  if(typeof publicKey!=="string"||publicKeyFingerprint(publicKey)!==expectedFingerprint ||
      !verifyPropertyPublicReport(report,publicKey))throw new Error("UNVERIFIED_REDACTED_REPORT");
  console.log(JSON.stringify({verified:true,
    candidate_count:report.body.candidates.length,
    external_identity_confirmation:"fingerprint must come from independent trusted source",
    site_access_authorized:false,physical_work_authorized:false}));
}
const [action,...a]=process.argv.slice(2);
if(action==="init" && a.length===1)await init(a[0]);
else if(action==="audit" && a.length===1)await audit(a[0]);
else if(action==="desk-task" && a.length===2)await deskTask(a[0],a[1]);
else if(action==="classify" && a.length===4)await classify(a[0],a[1],a[2],a[3]);
else if(action==="export-redacted" && a.length===3)await explicitExport(a[0],a[1],a[2]);
else if(action==="verify-redacted" && a.length===2)await verifyReport(a[0],a[1]);
else throw new Error("USAGE: init /absolute/outside-repo/private-root | audit <private-root> | classify <private-root> <id> <vehicle|land> <activity> | desk-task <private-root> <id> | export-redacted <private-root> <output.json> --explicit-redacted-export | verify-redacted <output.json> <out-of-band-key-fingerprint>");
