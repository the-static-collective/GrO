#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { stableStringify } from "../src/stable.js";
import {
  publicKeyFingerprint, verifySite, verifyLandProposal,
  verifyLandDisposition, verifySimulatedConsequence,
  projectLandSite, composeNeighboringSites, makeGhotLandSimulationTask,
  makeLandCrossingDraft,
} from "../src/land-crossing.js";

function eq(a,b,reason) {
  if(stableStringify(a)!==stableStringify(b))throw Error(reason);
}
const [path,orchardPin,workshopPin,witnessPin]=process.argv.slice(2);
if(!path||!orchardPin||!workshopPin||!witnessPin)
  throw Error("USAGE: node scripts/verify-land-crossing-001.mjs witness.json orchard-key-fingerprint workshop-key-fingerprint witness-key-fingerprint");
const bundle=JSON.parse(await readFile(path,"utf8"));
if(bundle.schema!=="gro.land-crossing-demo-witness/v0" || bundle.ground!=="hypothetical" ||
   bundle.externally_verified_property_rights!==false ||
   bundle.physical_actions_executed!==0 || bundle.ghot_dispatches_executed!==0)
  throw Error("LAND_FALSE_EVIDENCE_SCOPE");
const [A,B]=bundle.sites;
const [pa,pb]=bundle.proposals;
const [ra,rb]=bundle.registries;
const [da,hold,db]=bundle.local_dispositions;
for(const [site,proposal,registry] of [[A,pa,ra],[B,pb,rb]]) {
  if(!verifySite(site)||!verifyLandProposal(site,proposal) ||
     registry.site_id!==site.site_id || registry.legal_title_verified!==false ||
     registry.permission_to_enter_real_property!==false)
    throw Error("LAND_INVALID_PLACE_OR_PROPOSAL");
}
if(publicKeyFingerprint(ra.pinned_public_key)!==orchardPin ||
   publicKeyFingerprint(rb.pinned_public_key)!==workshopPin ||
   publicKeyFingerprint(bundle.observer_public_key)!==witnessPin)
  throw Error("LAND_OUT_OF_BAND_PIN_MISMATCH");
for(const [site,proposal,registry,disposition] of [
  [A,pa,ra,da],[B,pb,rb,hold],[B,pb,rb,db],
]){
  if(!verifyLandDisposition({site,proposal,registry,disposition}))
    throw Error("LAND_INVALID_DISPOSITION_SIGNATURE");
}
if(hold.body.decision!=="HOLD" || da.body.decision!=="SIMULATED_GRANT" ||
   db.body.decision!=="SIMULATED_GRANT")throw Error("LAND_UNEXPECTED_CONSENT");
if(!verifySimulatedConsequence({site:A,proposal:pa,registry:ra,disposition:da,
  consequence:bundle.consequence,pinnedObserverKey:bundle.observer_public_key}))
  throw Error("LAND_FALSE_CONSEQUENCE");
const rebuiltProjection=projectLandSite({
  site:A,proposals:[pa],registry:ra,dispositions:[da],
  consequences:[bundle.consequence],
  witnessPins:{[bundle.consequence.body.observer_id]:bundle.observer_public_key},
});
eq(bundle.projection,rebuiltProjection,"LAND_PROJECTION_MISMATCH");
const rebuiltComposition=composeNeighboringSites({
  left:{site:A,proposal:pa,registry:ra,disposition:da},
  right:{site:B,proposal:pb,registry:rb,disposition:db},
});
eq(bundle.composition,rebuiltComposition,"LAND_COMPOSITION_MISMATCH");
const task=bundle.ghot_task_candidate;
eq(task,makeGhotLandSimulationTask({
  site:A,proposal:pa,registry:ra,disposition:da,
  requesterNodeId:task.requester_node_id,createdAt:task.created_at,
}),"LAND_GHOT_TASK_MISMATCH");
const draft=bundle.relatte_donor_draft;
const redrafted=makeLandCrossingDraft({
  site:A,proposal:pa,sourceWorld:draft.source_world,createdAt:draft.created_at,
});
eq(draft,redrafted.spec,"LAND_RELATTE_DRAFT_MISMATCH");
if(bundle.relatte_payload_utf8!==redrafted.bytes.toString("utf8"))
  throw Error("LAND_RELATTE_PAYLOAD_MISMATCH");
console.log(JSON.stringify({
  verified:true,simulation_only:true,
  site_count:2,independent_local_grants:2,
  signed_witness:bundle.consequence.event_id,
  composed_candidate:bundle.composition.composition_id,
  ghot_task_proposal:task.task_id,
  external_pin_check:true,
  property_rights_verified:false,
  real_work_proven:false,
  caution:"identity pins supplied externally, not evidence of legal property rights",
}));
