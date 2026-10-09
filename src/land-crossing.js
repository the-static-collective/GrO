import { createHash, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { stableStringify } from "./stable.js";

export const LAND_SCHEMA = "gro.land-crossing-001/v0";
export const LAND_CROSSING_FAMILY_REF = "gro:land-site-proposal/v0";
export const LAND_CROSSING_CONTRACT = "gro:land-site-proposal-crossing/v0";
const ENVELOPE_DOMAIN = "GrO-LandCrossing-001-Signature|";
const ADDRESS_DOMAIN = "GrO-LandCrossing-001-Address|";
const SHA = (value) => createHash("sha256").update(value).digest("hex");

const strict = (x, fields, code) => {
  if (!x || typeof x !== "object" || Array.isArray(x) ||
      Object.keys(x).sort().join("|") !== fields.slice().sort().join("|")) {
    throw new Error(code);
  }
  return x;
};
const txt = (s, code) => {
  if (typeof s !== "string" || !s.trim() || s.length > 240) throw new Error(code);
  return s;
};
const hexAddress = (value, code) => {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value)) throw new Error(code);
  return value;
};
function iso(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
      !Number.isFinite(Date.parse(value))) throw new Error("LAND_INVALID_TIMESTAMP");
  return value;
}
const exactKeys = (obj, keys, code) => strict(obj,keys,code);
function digest(domain, payload) {
  return SHA(domain+stableStringify(payload));
}
function validJwkPublic(serialized) {
  if (typeof serialized !== "string" || !/^[A-Za-z0-9_-]+$/.test(serialized)) throw new Error("LAND_INVALID_PUBLIC_KEY");
  const bytes=Buffer.from(serialized,"base64url");
  if (bytes.length !== 44 || bytes.toString("base64url") !== serialized) throw new Error("LAND_INVALID_PUBLIC_KEY");
  const key=createPublicKey({key:bytes,format:"der",type:"spki"});
  if (key.asymmetricKeyType !== "ed25519") throw new Error("LAND_INVALID_PUBLIC_KEY");
  return key;
}
export function createLandIdentity() {
  const pair=generateKeyPairSync("ed25519");
  return {
    privateKey:pair.privateKey,
    publicKey:pair.publicKey.export({format:"der",type:"spki"}).toString("base64url"),
  };
}
export function publicKeyFingerprint(publicKey) {
  validJwkPublic(publicKey);
  return "sha256:"+SHA(Buffer.from(publicKey,"base64url"));
}
export function addressSite({localityId,boundary,sourceReference,sourceKind="sketch"}) {
  txt(localityId,"LAND_LOCALITY_REQUIRED");
  txt(sourceReference,"LAND_SOURCE_REF_REQUIRED");
  if (!["sketch","map-observation"].includes(sourceKind)) throw new Error("LAND_UNTRUSTED_SOURCE_KIND");
  exactKeys(boundary,["type","coordinates"],"LAND_INVALID_BOUNDARY");
  if (boundary.type !== "Polygon" || !Array.isArray(boundary.coordinates) ||
      boundary.coordinates.length !== 1) throw new Error("LAND_BOUNDARY_NOT_SIMPLE_POLYGON");
  const ring=boundary.coordinates[0];
  if (!Array.isArray(ring) || ring.length<4 || ring.length>64 ||
      ring.some(p=>!Array.isArray(p) || p.length!==2 || !p.every(Number.isFinite) ||
        p[0]<-180 || p[0]>180 || p[1]<-90 || p[1]>90) ||
      stableStringify(ring[0])!==stableStringify(ring.at(-1)) ||
      new Set(ring.slice(0,-1).map(p=>stableStringify(p))).size<3) {
    throw new Error("LAND_INVALID_RING");
  }
  const body={
    schema:"gro.land-place-address/v0",
    locality_id:localityId,
    boundary:structuredClone(boundary),
    source_reference:sourceReference,
    source_kind:sourceKind,
    legal_boundary_verified:false,
    ownership_claimed:false,
    access_granted:false,
  };
  return {...body,site_id:"gro-site:"+digest(ADDRESS_DOMAIN,body)};
}
export function verifySite(site) {
  try {
    if(!site || typeof site!=="object")return false;
    const recreated=addressSite({
      localityId:site.locality_id,boundary:site.boundary,
      sourceReference:site.source_reference,sourceKind:site.source_kind,
    });
    return stableStringify(site)===stableStringify(recreated);
  } catch {return false;}
}

/** A cryptographic signer identity is NOT evidence of land title, agency or legal access. */
export function signLandEvent({kind,body,identity}) {
  txt(kind,"LAND_EVENT_KIND_REQUIRED");
  if(!identity?.privateKey || !identity.publicKey) throw new Error("LAND_MISSING_SIGNER");
  const publicKey=identity.privateKey.asymmetricKeyType==="ed25519"?
    createPublicKey(identity.privateKey).export({format:"der",type:"spki"}).toString("base64url"):null;
  if(publicKey!==identity.publicKey)throw new Error("LAND_KEY_MISMATCH");
  const unsigned={schema:LAND_SCHEMA,kind,body:structuredClone(body)};
  const event_id="gro-land-event:"+digest(ADDRESS_DOMAIN,{...unsigned,signer_public_key:publicKey});
  const signature=sign(null,Buffer.from(ENVELOPE_DOMAIN+stableStringify({...unsigned,event_id})),identity.privateKey)
    .toString("base64url");
  return {...unsigned,event_id,signing:{
    algorithm:"Ed25519",public_key:publicKey,signature,
  }};
}
export function verifyLandEvent(event,{kind,pinnedKey}={}) {
  try {
    exactKeys(event,["schema","kind","body","event_id","signing"],"LAND_EVENT_FIELDS");
    if(event.schema!==LAND_SCHEMA || (kind && event.kind!==kind))return false;
    exactKeys(event.signing,["algorithm","public_key","signature"],"LAND_SIGNER_FIELDS");
    if(event.signing.algorithm!=="Ed25519" ||
        (pinnedKey && event.signing.public_key!==pinnedKey))return false;
    const publicKey=validJwkPublic(event.signing.public_key);
    const sig=Buffer.from(event.signing.signature,"base64url");
    if(sig.length!==64 || sig.toString("base64url")!==event.signing.signature)return false;
    const unsigned={schema:event.schema,kind:event.kind,body:event.body};
    if(event.event_id!=="gro-land-event:"+digest(ADDRESS_DOMAIN,{...unsigned,signer_public_key:event.signing.public_key}))return false;
    return verify(null,
      Buffer.from(ENVELOPE_DOMAIN+stableStringify({...unsigned,event_id:event.event_id})),
      publicKey,sig);
  } catch {return false;}
}
function actionSpec(action) {
  exactKeys(action,["kind","description"],"LAND_INVALID_ACTION");
  if(!["survey","cleanup","gardening","fabrication","solar-study","water-study","shared-resource"].includes(action.kind))
    throw new Error("LAND_UNKNOWN_ACTION");
  txt(action.description,"LAND_ACTION_DESCRIPTION_REQUIRED");
  return structuredClone(action);
}
function requireObservation(x) {
  exactKeys(x,["claim","source_ref","observed_at"],"LAND_INVALID_OBSERVATION");
  txt(x.claim,"LAND_MISSING_CLAIM");
  txt(x.source_ref,"LAND_MISSING_OBSERVATION_SOURCE");
  iso(x.observed_at);
  return x;
}
export function proposeLandUse({site,action,actorId,observations=[],at,identity}) {
  if(!verifySite(site))throw new Error("LAND_UNVERIFIED_SITE_ADDRESS");
  txt(actorId,"LAND_PROPOSER_REQUIRED");iso(at);
  if(!Array.isArray(observations)||observations.length>24)throw new Error("LAND_TOO_MANY_OBSERVATIONS");
  observations.forEach(requireObservation);
  return signLandEvent({kind:"SITE_USE_PROPOSAL",identity,body:{
    site_id:site.site_id,proposer_id:actorId,
    action:actionSpec(action),
    observations:structuredClone(observations),
    proposed_at:at,
    status:"proposal-only",
    legal_authority_claimed:false,
    entry_authorized:false,
  }});
}
export function verifyLandProposal(site,event,{pinnedProposerKey}={}) {
  try {
    if(!verifySite(site) || !verifyLandEvent(event,{kind:"SITE_USE_PROPOSAL",pinnedKey:pinnedProposerKey}))return false;
    const {body:b}=event;
    if(b.site_id!==site.site_id || !txt(b.proposer_id,"NO_PROPOSER") ||
       !Array.isArray(b.observations)||b.observations.length>24)return false;
    b.observations.forEach(requireObservation);
    actionSpec(b.action);
    iso(b.proposed_at);
    return stableStringify(b)===stableStringify({
      site_id:site.site_id,proposer_id:b.proposer_id,action:b.action,
      observations:b.observations,proposed_at:b.proposed_at,
      status:"proposal-only",legal_authority_claimed:false,entry_authorized:false,
    });
  } catch {return false;}
}

/** The ONLY claim this registry makes is that a local simulation pinned this key.
 * Do not use this method to verify legal real-world property rights.
 */
export function registerSimulatedSiteSteward({site,worldId,stewardId,stewardPublicKey}) {
  if(!verifySite(site))throw new Error("LAND_UNVERIFIED_SITE_ADDRESS");
  txt(worldId,"LAND_INVALID_WORLD");txt(stewardId,"LAND_INVALID_STEWARD");
  validJwkPublic(stewardPublicKey);
  return {
    schema:"gro.land-steward-registry/v0",
    site_id:site.site_id,world_id:worldId,steward_id:stewardId,
    pinned_public_key:stewardPublicKey,
    legal_title_verified:false,
    permission_to_enter_real_property:false,
    authority_basis:"simulation-only",
  };
}
function validRegistry(site,r) {
  try {
    const expected=registerSimulatedSiteSteward({
      site,worldId:r.world_id,stewardId:r.steward_id,stewardPublicKey:r.pinned_public_key,
    });
    return stableStringify(r)===stableStringify(expected);
  }catch{return false;}
}
export function decideLandProposal({site,proposal,registry,decision,validFrom,expiresAt,at,identity}) {
  if(!verifyLandProposal(site,proposal))throw new Error("LAND_UNVERIFIED_PROPOSAL");
  if(!validRegistry(site,registry))throw new Error("LAND_UNREGISTERED_SIMULATION_STEWARD");
  if(identity?.publicKey!==registry.pinned_public_key)throw new Error("LAND_SIGNER_NOT_LOCAL_STEWARD");
  if(!["HOLD","REFUSE","SIMULATED_GRANT"].includes(decision))throw new Error("LAND_INVALID_DISPOSITION");
  iso(at);iso(validFrom);iso(expiresAt);
  if(Date.parse(validFrom)<Date.parse(at) || Date.parse(expiresAt)<=Date.parse(validFrom) ||
      Date.parse(expiresAt)-Date.parse(validFrom)>86400000)throw new Error("LAND_INVALID_TIME_SCOPE");
  return signLandEvent({kind:"SITE_LOCAL_DISPOSITION",identity,body:{
    site_id:site.site_id,world_id:registry.world_id,
    steward_id:registry.steward_id,
    proposal_id:proposal.event_id,proposer_key:proposal.signing.public_key,
    decision,action_scope:proposal.body.action.kind,
    valid_from:validFrom,expires_at:expiresAt,decided_at:at,
    max_observations:1,
    transferable:false,
    real_world_permission:false,
    authority_basis:"simulation-only",
  }});
}
export function verifyLandDisposition({site,proposal,registry,disposition}) {
  try {
    if(!validRegistry(site,registry)||!verifyLandProposal(site,proposal) ||
       !verifyLandEvent(disposition,{kind:"SITE_LOCAL_DISPOSITION",pinnedKey:registry.pinned_public_key}))return false;
    const b=disposition.body;
    iso(b.valid_from);iso(b.expires_at);iso(b.decided_at);
    if(!["HOLD","REFUSE","SIMULATED_GRANT"].includes(b.decision) ||
       Date.parse(b.valid_from)<Date.parse(b.decided_at) ||
       Date.parse(b.expires_at)<=Date.parse(b.valid_from) ||
       Date.parse(b.expires_at)-Date.parse(b.valid_from)>86400000)return false;
    return stableStringify(b)===stableStringify({
      site_id:site.site_id,world_id:registry.world_id,steward_id:registry.steward_id,
      proposal_id:proposal.event_id,proposer_key:proposal.signing.public_key,
      decision:b.decision,action_scope:proposal.body.action.kind,
      valid_from:b.valid_from,expires_at:b.expires_at,decided_at:b.decided_at,
      max_observations:1,transferable:false,real_world_permission:false,
      authority_basis:"simulation-only",
    });
  } catch {return false;}
}
export function recordSimulatedConsequence({
  site,proposal,registry,disposition,at,observerId,observerIdentity,
  detail,evidenceRefs=[],
}) {
  if(!verifyLandDisposition({site,proposal,registry,disposition}))
    throw new Error("LAND_INVALID_LOCAL_DISPOSITION");
  if(disposition.body.decision!=="SIMULATED_GRANT")
    throw new Error("LAND_NOT_SIMULATED_GRANTED");
  iso(at);txt(observerId,"LAND_OBSERVER_REQUIRED");txt(detail,"LAND_DETAIL_REQUIRED");
  if(Date.parse(at)<Date.parse(disposition.body.valid_from) ||
     Date.parse(at)>=Date.parse(disposition.body.expires_at))
    throw new Error("LAND_SIMULATION_WINDOW_EXPIRED");
  if(!Array.isArray(evidenceRefs)||evidenceRefs.length>16 ||
      evidenceRefs.some(x=>typeof x!=="string" || !/^sha256:[0-9a-f]{64}$/.test(x)))
    throw new Error("LAND_INVALID_EVIDENCE_REFS");
  if(observerIdentity?.publicKey===registry.pinned_public_key)
    throw new Error("LAND_OBSERVER_MUST_DIFFER_FROM_STEWARD");
  const signed=signLandEvent({kind:"SITE_SIMULATED_CONSEQUENCE",identity:observerIdentity,body:{
    site_id:site.site_id,proposal_id:proposal.event_id,
    local_disposition_id:disposition.event_id,world_id:registry.world_id,
    action:disposition.body.action_scope,observer_id:observerId,
    observed_at:at,detail,evidence_refs:structuredClone(evidenceRefs),
    kind:"simulation-not-physical-work",
    physical_work_proven:false,ownership_claimed:false,real_world_access:false,
  }});
  return signed;
}
export function verifySimulatedConsequence({site,proposal,registry,disposition,consequence,pinnedObserverKey}) {
  try {
    if(!verifyLandDisposition({site,proposal,registry,disposition}) ||
       disposition.body.decision!=="SIMULATED_GRANT" ||
       pinnedObserverKey===registry.pinned_public_key ||
       !verifyLandEvent(consequence,{kind:"SITE_SIMULATED_CONSEQUENCE",pinnedKey:pinnedObserverKey}))return false;
    const b=consequence.body;
    iso(b.observed_at);
    if(Date.parse(b.observed_at)<Date.parse(disposition.body.valid_from) ||
      Date.parse(b.observed_at)>=Date.parse(disposition.body.expires_at) ||
      !Array.isArray(b.evidence_refs)||b.evidence_refs.length>16 ||
      b.evidence_refs.some(x=>!/^sha256:[0-9a-f]{64}$/.test(x)))return false;
    txt(b.observer_id,"LAND_OBSERVER_REQUIRED");txt(b.detail,"LAND_DETAIL_REQUIRED");
    return stableStringify(b)===stableStringify({
      site_id:site.site_id,proposal_id:proposal.event_id,
      local_disposition_id:disposition.event_id,
      world_id:registry.world_id,action:disposition.body.action_scope,
      observer_id:b.observer_id,observed_at:b.observed_at,
      detail:b.detail,evidence_refs:b.evidence_refs,
      kind:"simulation-not-physical-work",physical_work_proven:false,
      ownership_claimed:false,real_world_access:false,
    });
  } catch{return false;}
}

/** A signed GrO payload proposed for native reLATTE crossing machinery.
 * Only reLATTE may create signed CrossingEnvelope and R3 owner dispositions.
 */
export function makeLandCrossingDraft({site,proposal,sourceWorld,createdAt}) {
  if(!verifyLandProposal(site,proposal))throw new Error("LAND_UNVERIFIED_PROPOSAL");
  txt(sourceWorld,"LAND_SOURCE_WORLD_REQUIRED");iso(createdAt);
  const payload={site,proposal};
  const bytes=Buffer.from(stableStringify(payload),"utf8");
  return {
    spec:{
      schema:"relatte.opaque-organ-spec/v0",
      family_ref:LAND_CROSSING_FAMILY_REF,
      donor_contract_ref:LAND_CROSSING_CONTRACT,
      artifact_kind:"gro-land-use-proposal",
      source_world:sourceWorld,
      source_particular:proposal.event_id,
      source_history_head:null,
      payload_refs:[{
        address:"sha256:"+SHA(bytes),
        role:"land-proposal",
        media_type:"application/vnd.gro.land-proposal+json",
      }],
      donor_claims:{
        site_id:site.site_id,proposal_id:proposal.event_id,
        ownership_claimed:false,
        entry_authorized:false,
        legal_authority_transfer:false,
      },
      requested_effect:{
        kind:"candidate-land-use-proposal",
        authority:"receiver-local",entry_authorized:false,
        physical_work_allowed:false,playable:false,
      },
      return_address:null,created_at:createdAt,
    },
    bytes,
  };
}

export function projectLandSite({site,proposals=[],registry=null,dispositions=[],consequences=[]}) {
  if(!verifySite(site))throw new Error("LAND_UNVERIFIED_SITE_ADDRESS");
  for(const p of proposals)if(!verifyLandProposal(site,p))throw new Error("LAND_UNVERIFIED_PROPOSAL");
  if(registry!==null && !validRegistry(site,registry))throw new Error("LAND_INVALID_REGISTRY");
  for(const d of dispositions){
    const p=proposals.find(x=>x.event_id===d.body?.proposal_id);
    if(!p || !registry || !verifyLandDisposition({site,proposal:p,registry,disposition:d}))
      throw new Error("LAND_UNVERIFIED_DISPOSITION");
  }
  for(const c of consequences){
    const p=proposals.find(x=>x.event_id===c.body?.proposal_id);
    const d=dispositions.find(x=>x.event_id===c.body?.local_disposition_id);
    if(!p||!d||!registry||!verifySimulatedConsequence({
      site,proposal:p,registry,disposition:d,consequence:c,
      pinnedObserverKey:c.signing.public_key,
    }))throw new Error("LAND_UNVERIFIED_CONSEQUENCE");
  }
  return {
    schema:"gro.land-field-projection/v0",
    site_id:site.site_id,
    map_type:"illustrative-not-cadastral",
    opportunities:proposals.map(p=>{
      const d=dispositions.find(x=>x.body.proposal_id===p.event_id);
      return {
        proposal_id:p.event_id,action:p.body.action.kind,
        status:d?.body.decision ?? "UNDECIDED",
        simulated_consequence_ids:consequences.filter(c=>c.body.proposal_id===p.event_id)
          .map(c=>c.event_id),
        entry_authorized:false,real_world_work_authorized:false,
      };
    }),
    ownership_verified:false,physical_site_access:false,
  };
}

/** Two neighboring places can offer a bounded *simulation* of cooperation;
 * neither local steward can authorize their neighbor's site.
 */
export function composeNeighboringSites({left,right}) {
  for(const world of [left,right]){
    if(!verifySite(world.site) ||
       !verifyLandProposal(world.site,world.proposal) ||
       !verifyLandDisposition(world) ||
       world.disposition.body.decision!=="SIMULATED_GRANT" ||
       world.proposal.body.action.kind!=="shared-resource"){
      throw new Error("LAND_TWO_INDEPENDENT_LOCAL_GRANTS_REQUIRED");
    }
  }
  if(left.site.site_id===right.site.site_id ||
     left.registry.world_id===right.registry.world_id ||
     left.registry.pinned_public_key===right.registry.pinned_public_key)
    throw new Error("LAND_NOT_INDEPENDENT_SITES");
  const start=Math.max(Date.parse(left.disposition.body.valid_from),
    Date.parse(right.disposition.body.valid_from));
  const end=Math.min(Date.parse(left.disposition.body.expires_at),
    Date.parse(right.disposition.body.expires_at));
  if(end<=start)throw new Error("LAND_NO_OVERLAPPING_CONSENT");
  const body={
    schema:"gro.neighbor-cooperation-001/v0",
    sites:[left.site.site_id,right.site.site_id].sort(),
    grants:[left.disposition.event_id,right.disposition.event_id].sort(),
    kind:"shared-resource",
    simulated_window:[new Date(start).toISOString(),new Date(end).toISOString()],
    result:"simulated-cooperation-possible",
    legal_easement_created:false,
    utility_interconnection_granted:false,
    owner_rights_transferred:false,
  };
  return {...body,composition_id:"gro-neighbor:"+digest(ADDRESS_DOMAIN,body)};
}
