import test from "node:test";
import assert from "node:assert/strict";

import {
  addressSite, verifySite, createLandIdentity, publicKeyFingerprint,
  proposeLandUse, verifyLandProposal, makeLandCrossingDraft,
  registerSimulatedSiteSteward, decideLandProposal, verifyLandDisposition,
  recordSimulatedConsequence, verifySimulatedConsequence,
  projectLandSite, composeNeighboringSites, signLandEvent, verifyLandEvent,
  makeGhotLandSimulationTask,
} from "../src/land-crossing.js";

const t=(sec)=>new Date(Date.UTC(2026,9,9,19,0,sec)).toISOString();
const box=(x)=>({type:"Polygon",coordinates:[[
  [x,10],[x+.002,10],[x+.002,10.002],[x,10],
]]});
function environment(name="alpha",x=10,world="world:land-a") {
  const site=addressSite({
    localityId:"locality:"+name, boundary:box(x),
    sourceReference:"mock-observation:"+name,sourceKind:"sketch",
  });
  const proposer=createLandIdentity(),steward=createLandIdentity(),observer=createLandIdentity();
  const registry=registerSimulatedSiteSteward({
    site,worldId:world,stewardId:"actor:steward-"+name,
    stewardPublicKey:steward.publicKey,
  });
  const proposal=proposeLandUse({
    site,action:{kind:"shared-resource",description:"Propose shared watershed simulation"},
    actorId:"actor:proposer-"+name,identity:proposer,at:t(1),
    observations:[{claim:"Possible rain collection hypothesis",source_ref:"observation:"+name,observed_at:t(0)}],
  });
  const disposition=decideLandProposal({
    site,proposal,registry,decision:"SIMULATED_GRANT",
    validFrom:t(3),expiresAt:t(20),at:t(2),identity:steward,
  });
  return {site,proposer,steward,observer,registry,proposal,disposition};
}

test("LAND-001 stable address of a sketch is a place candidate, never a deed",()=>{
  const f=environment();
  assert.equal(verifySite(f.site),true);
  assert.equal(f.site.site_id,addressSite({
    localityId:"locality:alpha",boundary:box(10),
    sourceReference:"mock-observation:alpha",sourceKind:"sketch",
  }).site_id);
  assert.equal(f.site.legal_boundary_verified,false);
  assert.equal(f.site.ownership_claimed,false);
  assert.equal(f.site.access_granted,false);
  assert.equal(verifySite({...f.site,ownership_claimed:true}),false);
  assert.equal(verifySite({...f.site,site_id:"gro-site:fake"}),false);
  assert.equal(verifySite({...f.site,boundary:box(11)}),false);
  assert.throws(()=>addressSite({
    localityId:"locality:bad",boundary:{type:"Point",coordinates:[[1,1]]},
    sourceReference:"a",
  }),/LAND_BOUNDARY_NOT_SIMPLE_POLYGON/);
  assert.throws(()=>addressSite({
    localityId:"locality:bad",boundary:{type:"Polygon",coordinates:[[[1,1],[2,2],[3,3],[4,4]]]},
    sourceReference:"a",
  }),/LAND_INVALID_RING/);
});

test("LAND-001 proposals are signed, replaceable and invitation-only, not property access",()=>{
  const f=environment();
  assert.equal(verifyLandProposal(f.site,f.proposal),true);
  assert.equal(f.proposal.body.entry_authorized,false);
  assert.equal(f.proposal.body.legal_authority_claimed,false);
  assert.equal(verifyLandProposal(f.site,f.proposal,{pinnedProposerKey:f.proposer.publicKey}),true);
  assert.equal(verifyLandProposal(f.site,f.proposal,{pinnedProposerKey:f.steward.publicKey}),false);
  assert.equal(verifyLandProposal(f.site,{
    ...f.proposal,body:{...f.proposal.body,entry_authorized:true},
  }),false);
  assert.equal(verifyLandProposal(f.site,{...f.proposal,event_id:"gro-land-event:counterfeit"}),false);
  assert.equal(verifyLandProposal(environment("other",20).site,f.proposal),false);
  const draft=makeLandCrossingDraft({
    site:f.site,proposal:f.proposal,sourceWorld:"world:land-source",createdAt:t(3),
  });
  assert.equal(draft.spec.requested_effect.authority,"receiver-local");
  assert.equal(draft.spec.requested_effect.entry_authorized,false);
  assert.equal(draft.spec.donor_claims.legal_authority_transfer,false);
  assert.equal(draft.spec.payload_refs[0].role,"land-proposal");
  assert.equal(draft.spec.payload_refs[0].address.length,71);
  assert.equal(draft.bytes.toString("utf8").includes(f.proposal.event_id),true);
});

test("LAND-001 a random claimant cannot sign a local grant with owner status",()=>{
  const f=environment();
  assert.equal(verifyLandDisposition(f),true);
  assert.equal(f.registry.legal_title_verified,false);
  assert.equal(f.registry.permission_to_enter_real_property,false);
  assert.equal(f.disposition.body.real_world_permission,false);
  assert.equal(f.disposition.body.authority_basis,"simulation-only");
  assert.throws(()=>decideLandProposal({
    ...f,decision:"SIMULATED_GRANT",validFrom:t(3),
    expiresAt:t(20),at:t(2),identity:f.proposer,
  }),/LAND_SIGNER_NOT_LOCAL_STEWARD/);
  const forged=signLandEvent({
    kind:"SITE_LOCAL_DISPOSITION",body:f.disposition.body,identity:f.proposer,
  });
  assert.equal(verifyLandDisposition({...f,disposition:forged}),false);
  const altered={...f.disposition,body:{...f.disposition.body,real_world_permission:true}};
  assert.equal(verifyLandDisposition({...f,disposition:altered}),false);
  assert.equal(verifyLandDisposition({...f,registry:{
    ...f.registry,authority_basis:"real-property-title",
  }}),false);
});

test("LAND-001 HOLD and REFUSE remain non-work and never become permission",()=>{
  for(const kind of ["HOLD","REFUSE"]){
    const f=environment();
    const d=decideLandProposal({...f,decision:kind,at:t(2),validFrom:t(3),expiresAt:t(20),identity:f.steward});
    assert.equal(verifyLandDisposition({...f,disposition:d}),true);
    assert.throws(()=>recordSimulatedConsequence({
      ...f,disposition:d,observerIdentity:f.observer,
      observerId:"actor:witness",at:t(4),detail:"Not possible",
    }),/LAND_NOT_SIMULATED_GRANTED/);
    const projection=projectLandSite({site:f.site,proposals:[f.proposal],
      registry:f.registry,dispositions:[d]});
    assert.equal(projection.opportunities[0].status,kind);
    assert.deepEqual(projection.opportunities[0].simulated_consequence_ids,[]);
  }
});

test("LAND-001 a short scoped grant permits only a separate simulated consequence witness",()=>{
  const f=environment();
  const consequence=recordSimulatedConsequence({
    ...f,observerIdentity:f.observer,observerId:"actor:observer",
    at:t(4),detail:"Simulation produced a possible shared rain route",
    evidenceRefs:["sha256:"+"a".repeat(64)],
  });
  assert.equal(verifySimulatedConsequence({...f,consequence,
    pinnedObserverKey:f.observer.publicKey}),true);
  assert.equal(verifySimulatedConsequence({...f,consequence,
    pinnedObserverKey:f.steward.publicKey}),false);
  assert.equal(consequence.body.physical_work_proven,false);
  assert.equal(consequence.body.ownership_claimed,false);
  const projection=projectLandSite({
    site:f.site,proposals:[f.proposal],
    registry:f.registry,dispositions:[f.disposition],consequences:[consequence],
    witnessPins:{'actor:observer':f.observer.publicKey},
  });
  assert.equal(projection.opportunities[0].status,"SIMULATED_GRANT");
  assert.deepEqual(projection.opportunities[0].simulated_consequence_ids,[consequence.event_id]);
  assert.equal(projection.physical_site_access,false);
  assert.equal(projection.ownership_verified,false);
  assert.throws(()=>projectLandSite({
    site:f.site,proposals:[f.proposal],registry:f.registry,
    dispositions:[f.disposition],consequences:[consequence],
  }),/LAND_UNVERIFIED_CONSEQUENCE/);
  assert.throws(()=>projectLandSite({
    site:f.site,proposals:[f.proposal],registry:f.registry,
    dispositions:[f.disposition],consequences:[consequence,consequence],
    witnessPins:{'actor:observer':f.observer.publicKey},
  }),/LAND_GRANT_ALREADY_OBSERVED_IN_PROJECTION/);
  assert.throws(()=>recordSimulatedConsequence({
    ...f,observerIdentity:f.observer,observerId:"actor:observer",
    at:t(20),detail:"expired",
  }),/LAND_SIMULATION_WINDOW_EXPIRED/);
  assert.throws(()=>recordSimulatedConsequence({
    ...f,observerIdentity:f.steward,observerId:"actor:steward",
    at:t(4),detail:"owner self-certifies",
  }),/LAND_OBSERVER_MUST_DIFFER_FROM_STEWARD/);
  assert.equal(verifySimulatedConsequence({...f,consequence:{
    ...consequence,body:{...consequence.body,physical_work_proven:true},
  },pinnedObserverKey:f.observer.publicKey}),false);
});

test("LAND-001 two sites can independently simulate cooperation without easement",()=>{
  const a=environment("a",10,"world:a");
  const b=environment("b",11,"world:b");
  const combo=composeNeighboringSites({left:a,right:b});
  assert.equal(combo.sites.length,2);
  assert.equal(combo.grants.length,2);
  assert.equal(combo.legal_easement_created,false);
  assert.equal(combo.utility_interconnection_granted,false);
  assert.equal(combo.owner_rights_transferred,false);
  assert.equal(combo.cadastral_adjacency_verified,false);
  assert.notEqual(a.registry.pinned_public_key,b.registry.pinned_public_key);
  assert.throws(()=>composeNeighboringSites({left:a,right:a}),
    /LAND_NOT_INDEPENDENT_SITES/);
  const held=decideLandProposal({...b,decision:"HOLD",validFrom:t(3),
    expiresAt:t(20),at:t(2),identity:b.steward});
  assert.throws(()=>composeNeighboringSites({left:a,right:{...b,disposition:held}}),
    /LAND_TWO_INDEPENDENT_LOCAL_GRANTS_REQUIRED/);
  const noTime=decideLandProposal({...b,decision:"SIMULATED_GRANT",validFrom:t(21),
    expiresAt:t(30),at:t(19),identity:b.steward});
  assert.throws(()=>composeNeighboringSites({left:a,right:{...b,disposition:noTime}}),
    /LAND_NO_OVERLAPPING_CONSENT/);
  const signedFromA=signLandEvent({
    kind:"SITE_LOCAL_DISPOSITION",body:{...b.disposition.body},identity:a.steward,
  });
  assert.throws(()=>composeNeighboringSites({left:a,right:{...b,disposition:signedFromA}}),
    /LAND_TWO_INDEPENDENT_LOCAL_GRANTS_REQUIRED/);
});

test("LAND-001 signatures establish attributable statements only, never title",()=>{
  const f=environment();
  assert.match(publicKeyFingerprint(f.steward.publicKey),/^sha256:[0-9a-f]{64}$/);
  assert.equal(verifyLandEvent(f.proposal,{kind:"SITE_USE_PROPOSAL",
    pinnedKey:f.proposer.publicKey}),true);
  assert.equal(verifyLandEvent({...f.proposal,
    signing:{...f.proposal.signing,algorithm:"P256"}},{}),false);
  const impostor=signLandEvent({
    kind:"SITE_USE_PROPOSAL",body:f.proposal.body,identity:f.steward,
  });
  assert.equal(verifyLandProposal(f.site,impostor,{pinnedProposerKey:f.proposer.publicKey}),false);
  assert.notEqual(f.proposal.event_id,impostor.event_id); // signer identity is part of the addressed event
});

test("LAND-001 a place with no steward still offers proposals without access",()=>{
  const f=environment();
  const field=projectLandSite({site:f.site,proposals:[f.proposal]});
  assert.equal(field.opportunities[0].status,"UNDECIDED");
  assert.equal(field.opportunities[0].entry_authorized,false);
  assert.equal(field.opportunities[0].real_world_work_authorized,false);
});

test("LAND-001 proposed work composes to GHoT task.v0 without granting physical effects",()=>{
  const f=environment();
  const task=makeGhotLandSimulationTask({
    ...f,requesterNodeId:"static-computer:desk-demo",createdAt:t(4),
  });
  assert.equal(task.kind,"ghot.task");
  assert.equal(task.version,"0");
  assert.equal(task.capability,"gro.land.simulation-study.v0");
  assert.match(task.task_id,/^gro-ghot-land-task:[0-9a-f]{64}$/);
  assert.equal(task.input.simulation_only,true);
  assert.equal(task.input.real_estate_permission,false);
  assert.equal(task.constraints.requires_installed_declared_capability,true);
  assert.equal(task.constraints.physical_actuation,false);
  assert.equal(task.constraints.property_entry,false);
  const held=decideLandProposal({...f,decision:"HOLD",at:t(2),
    validFrom:t(3),expiresAt:t(20),identity:f.steward});
  assert.throws(()=>makeGhotLandSimulationTask({
    ...f,disposition:held,requesterNodeId:"static-computer:desk-demo",createdAt:t(4),
  }),/LAND_SIMULATED_DISPOSITION_REQUIRED_FOR_GHOT/);
  assert.throws(()=>makeGhotLandSimulationTask({
    ...f,requesterNodeId:"static-computer:desk-demo",createdAt:t(20),
  }),/LAND_GHOT_TASK_OUTSIDE_SIMULATION_SCOPE/);
});
