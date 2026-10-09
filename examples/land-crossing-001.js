#!/usr/bin/env node
/**
 * LAND-CROSSING-001: entirely fictional site fixture.
 * There is no address lookup, property lookup, land title assertion,
 * access permission, physical effect, dispatcher, or property valuation.
 */
import { mkdir, writeFile } from "node:fs/promises";
import {
  addressSite, createLandIdentity,
  proposeLandUse, verifyLandProposal,
  registerSimulatedSiteSteward,
  decideLandProposal, verifyLandDisposition,
  recordSimulatedConsequence, verifySimulatedConsequence,
  composeNeighboringSites, makeLandCrossingDraft,
  makeGhotLandSimulationTask, projectLandSite,
  publicKeyFingerprint,
} from "../src/land-crossing.js";

const at=(s)=>new Date(Date.UTC(2026,9,9,19,0,s)).toISOString();
function site(name,x) {
  return addressSite({
    localityId:"fictional:plot-"+name,
    boundary:{type:"Polygon",coordinates:[[
      [x,12],[x+.001,12],[x+.001,12.001],[x,12],
    ]]},
    sourceReference:"fictional-pencil-sketch-"+name,
    sourceKind:"sketch",
  });
}
function makeWorld(name,x) {
  const place=site(name,x);
  const proposer=createLandIdentity();
  const steward=createLandIdentity();
  const observer=createLandIdentity();
  const registry=registerSimulatedSiteSteward({
    site:place,worldId:"fictional:world-"+name,
    stewardId:"actor:simulated-steward-"+name,
    stewardPublicKey:steward.publicKey,
  });
  const proposal=proposeLandUse({
    site:place,identity:proposer,actorId:"actor:proposer-"+name,
    at:at(1),action:{
      kind:"shared-resource",
      description:"Explore a shared rainwater/routing resource between fictional plots",
    },
    observations:[{
      claim:"Possible water routing — hypothetical, not measured",
      source_ref:"fiction:field-note-"+name,
      observed_at:at(0),
    }],
  });
  return {site:place,proposer,steward,observer,registry,proposal};
}
const A=makeWorld("orchard",10);
const B=makeWorld("workshop",10.01);
const approvedA=decideLandProposal({
  ...A,decision:"SIMULATED_GRANT",at:at(2),validFrom:at(3),
  expiresAt:at(20),identity:A.steward,
});
const heldB=decideLandProposal({
  ...B,decision:"HOLD",at:at(2),validFrom:at(3),
  expiresAt:at(20),identity:B.steward,
});
let initiallyComposed=false;
try {
  composeNeighboringSites({
    left:{...A,disposition:approvedA},
    right:{...B,disposition:heldB},
  });
  initiallyComposed=true;
} catch(error){
  if(!String(error).includes("LAND_TWO_INDEPENDENT_LOCAL_GRANTS_REQUIRED"))throw error;
}
if(initiallyComposed)throw Error("CONSENT_BYPASS");
const approvedB=decideLandProposal({
  ...B,decision:"SIMULATED_GRANT",at:at(4),validFrom:at(5),
  expiresAt:at(20),identity:B.steward,
});
const composition=composeNeighboringSites({
  left:{...A,disposition:approvedA},
  right:{...B,disposition:approvedB},
});
const witnessA=recordSimulatedConsequence({
  ...A,disposition:approvedA,observerIdentity:A.observer,
  observerId:"actor:observer-orchard",
  at:at(6),detail:"Desk simulation: orchard water routing considered",
});
if(!verifySimulatedConsequence({...A,disposition:approvedA,
  consequence:witnessA,pinnedObserverKey:A.observer.publicKey}))throw Error("WITNESS_FAILED");
const projection=projectLandSite({
  site:A.site,proposals:[A.proposal],registry:A.registry,
  dispositions:[approvedA],consequences:[witnessA],
  witnessPins:{"actor:observer-orchard":A.observer.publicKey},
});
const ghotTask=makeGhotLandSimulationTask({
  ...A,disposition:approvedA,requesterNodeId:"ghot:fictional-desk-computer",createdAt:at(7),
});
const donor=makeLandCrossingDraft({
  site:A.site,proposal:A.proposal,sourceWorld:"world:fictional-donor",createdAt:at(8),
});
if(!verifyLandProposal(A.site,A.proposal) ||
   !verifyLandDisposition({...A,disposition:approvedA}) ||
   projection.opportunities[0].simulated_consequence_ids[0]!==witnessA.event_id ||
   composition.legal_easement_created!==false || ghotTask.constraints.property_entry!==false) {
  throw Error("LAND_INVARIANT_FAILED");
}
const evidence={
  schema:"gro.land-crossing-demo-witness/v0",
  ground:"hypothetical",
  sites:[A.site,B.site],
  proposals:[A.proposal,B.proposal],
  registries:[A.registry,B.registry],
  local_dispositions:[approvedA,heldB,approvedB],
  consequence:witnessA,
  observer_public_key:A.observer.publicKey,
  projection,
  composition,
  ghot_task_candidate:ghotTask,
  relatte_donor_draft:donor.spec,
  relatte_payload_utf8:donor.bytes.toString("utf8"),
  pubkey_fingerprints:{
    orchard_steward:publicKeyFingerprint(A.steward.publicKey),
    workshop_steward:publicKeyFingerprint(B.steward.publicKey),
    orchard_witness:publicKeyFingerprint(A.observer.publicKey),
  },
  externally_verified_property_rights:false,
  physical_actions_executed:0,
  ghot_dispatches_executed:0,
};
const output=process.argv[2];
if(output) {
  await mkdir(output,{recursive:true});
  await writeFile(output+"/land-crossing-001-witness.json",JSON.stringify(evidence,null,2)+"\n");
}
console.log(JSON.stringify({
  demo:"LAND-CROSSING-001",
  plot_a:A.site.site_id,
  plot_b:B.site.site_id,
  missing_consent_initially_blocked:!initiallyComposed,
  independent_grants:2,
  shared_resource_simulation:composition.composition_id,
  signed_simulation_witness:witnessA.event_id,
  ghot_task_candidate:ghotTask.task_id,
  real_estate_rights_proved:false,
  physical_work_executed:0,
  real_property_access_authorized:false,
}));
