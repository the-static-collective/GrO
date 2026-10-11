// GrO's independent, narrow intake of ABUNDENT × reLATTE 001.
// No network, no remote GrO admission and NO signed reLATTE receipt.
import {createHash,createPublicKey,verify as verifySignature} from 'node:crypto';
import {stableStringify} from './stable.js';
import {makeReceipt,verifyOccurrenceReceipt} from './receipt.js';

const sourcePin={
 repository:'the-static-collective/lemonPRESS',
 commit:'02feb4454240d482a5e0e03258f24f8b5cc0b9f5',
 path:'catalog.yaml',
 git_blob:'907759670a118e8a1098fe3350a0ad9f9ae37045',
 sha256:'sha256:cbe0bca162dea2d7f828bbb3546f3de3ab7f787084fcc7f4b8b193ca0d866d75'
};
const demoKey={kty:'EC',crv:'P-256',x:'vTCclg9Z3HuJMB9BbfymTGql6qFJ-GFN8RC_zgcWEb8',y:'QvxVSuKAv4rpeOq86yGi378OkVnptTBeIGqGzufUEg4'};
const sha256=s=>createHash('sha256').update(s).digest('hex');
const exact=(o,ks)=>{
 if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==ks.length||ks.some(k=>!Object.hasOwn(o,k)))throw Error('INVALID_FIELDS');
};
export function inspectAbundentArrival(b) {
 const text=JSON.stringify(b);
 if(Buffer.byteLength(text)>32768)throw Error('OVERSIZED_CARRIER');
 exact(b,['schema','kind','source','crossing','source_owner_signed','receiver_status','demo_key_scope']);
 if(b.schema!=='webz/arrival-demo/v0'||b.kind!=='public-reference'||b.source_owner_signed!==false
 ||b.receiver_status!=='NOT_RECEIVED'||b.demo_key_scope!=='ephemeral-experiment-key-not-owner-identity')
   throw Error('UNSUPPORTED_CARRIER');
 const s=b.source;
 exact(s,['repository','commit','path','git_blob','sha256','content']);
 for(const [k,v] of Object.entries(sourcePin))if(s[k]!==v)throw Error('UNPINNED_SOURCE');
 if(typeof s.content!=='string'||'sha256:'+sha256(s.content)!==s.sha256)throw Error('SOURCE_BYTES_CHANGED');
 const bytes=Buffer.from(s.content);
 if(createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex')!==s.git_blob)throw Error('SOURCE_GIT_BLOB_CHANGED');

 const c=b.crossing;
 exact(c,['schema','protocol_version','source_particular','source_world','source_history_head','parents','declared_kind','payload_refs','requested_effect','capability_ref','privacy_policy','audience_policy','return_address','created_at','signing','extensions','crossing_id']);
 if(c.schema!=='relatte.crossing-envelope/v0'||c.protocol_version!=='0'||c.source_particular!=='particular:abundent-lemonpress-catalog-001'
  ||c.source_world!=='world:abundent-experimental-adapter'||c.declared_kind!=='PUBLIC_SOURCE_REFERENCE'||c.source_history_head!==null
  ||c.requested_effect!==null||c.capability_ref!==null||c.privacy_policy!=='public-reference-only'
  ||c.return_address!==null||!Array.isArray(c.parents)||c.parents.length!==0
  ||typeof c.created_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(c.created_at))throw Error('CROSSING_NOT_ALLOWED');
 exact(c.audience_policy,['destination']);
 if(c.audience_policy.destination!=='world:gro-local-review')throw Error('WRONG_DESTINATION');
 if(!Array.isArray(c.payload_refs)||c.payload_refs.length!==1)throw Error('INVALID_PAYLOADS');
 exact(c.payload_refs[0],['address','role','media_type']);
 if(c.payload_refs[0].address!==s.sha256||c.payload_refs[0].role!=='source-bytes'||c.payload_refs[0].media_type!=='text/yaml')throw Error('PAYLOAD_ID_CHANGED');
 exact(c.extensions,['source','claim']);exact(c.extensions.source,['repository','commit','path','git_blob']);
 if(c.extensions.claim!=='experiment-signer-not-source-owner')throw Error('FALSE_OWNER_CLAIM');
 for(const k of ['repository','commit','path','git_blob'])
  if(c.extensions.source[k]!==s[k])throw Error('CROSSING_PROVENANCE_CHANGED');
 exact(c.signing,['algorithm','public_key','domain','signature']);
 exact(c.signing.public_key,['kty','crv','x','y']);
 if(stableStringify(c.signing.public_key)!==stableStringify(demoKey)||c.signing.domain!=='relatte.crossing-signature/v0'
  ||c.signing.algorithm!=='ECDSA-P256-SHA256')throw Error('UNTRUSTED_DEMO_KEY');
 if(typeof c.signing.signature!=='string'||!/^[A-Za-z0-9_-]+$/.test(c.signing.signature))throw Error('BAD_SIGNATURE');
 const rawSig=Buffer.from(c.signing.signature,'base64url');
 if(rawSig.length!==64||rawSig.toString('base64url')!==c.signing.signature)throw Error('BAD_SIGNATURE');
 const {signature,...unsignedSigning}=c.signing;
 const {crossing_id,...envelopeFields}=c;
 const body={...envelopeFields,signing:unsignedSigning};
 const id='relatte-crossing-v0:'+sha256('reLATTE-CrossingEnvelope-v0|'+stableStringify(body));
 if(crossing_id!==id)throw Error('BAD_CROSSING_ID');
 const key=createPublicKey({key:demoKey,format:'jwk'});
 if(!verifySignature('sha256',Buffer.from('reLATTE-CrossingSignature-v0|'+stableStringify({crossing_id,...body})),{key,dsaEncoding:'ieee-p1363'},rawSig))
   throw Error('BAD_CROSSING_SIGNATURE');
 return {crossing_id,source_sha256:s.sha256,source_git_blob:s.git_blob,
  source_repository:s.repository,source_commit:s.commit,destination:'world:gro-local-review',
  verified_experiment_signature:true,source_owner_signature:false,
  receiver_state:'NOT_RECEIVED'};
}

export function recordAbundentHold(bundle,{actorId,placeId,occurredAt}) {
 if(!actorId||!placeId||!occurredAt)throw Error('EXPLICIT_LOCAL_REVIEW_REQUIRED');
 const v=inspectAbundentArrival(bundle);
 const receipt=makeReceipt({occurredAt,actorId,placeId,action:'hold-public-reference-for-review',
  inputs:[v.crossing_id,v.source_sha256],outputs:[],priorTraceIds:[]});
 if(!verifyOccurrenceReceipt(receipt))throw Error('LOCAL_RECEIPT_INVALID');
 return {schema:'gro.abundent-arrival-review.v0',disposition:'HOLD',crossing_id:v.crossing_id,
  source_sha256:v.source_sha256,source_authority:'NOT_ATTESTED_BY_PUBLISHER',
  receiving_world:'world:gro-local-review',local_occurrence_receipt:receipt,
  relatte_signed_receive:false,admitted:false,shared:false,
  note:'GrO local review occurrence only; not a reLATTE sovereign RECEIVE or ADMIT.'};
}
