// Bounded reLATTE v0 receipt profile for GrO's explicit single-artifact intake.
// Compatible canonical receipt/signature and LocalReceiver event/state identity bodies.
// This is a local cryptographic witness, not an authenticated public GrO operator service.
import {createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify} from 'node:crypto';
import {stableStringify as canonical} from './stable.js';

const sha=x=>createHash('sha256').update(x).digest('hex');
const prefix=(p,value)=>sha(p+canonical(value));
export const CONFIG=Object.freeze({
  schema:'relatte.local-receiver-config/v0',world_id:'world:gro-local-review',
  receiver_particular:'particular:gro-abundent-intake-001',
  contract_ref:'gro.abundent-public-reference-intake/v0'
});
const allowed=(x,fields)=>{
  if(!x||typeof x!=='object'||Array.isArray(x)||
    Object.keys(x).length!==fields.length||fields.some(k=>!Object.hasOwn(x,k)))throw Error('UNEXPECTED_FIELDS');
};
const JWK=['kty','crv','x','y'];
const RECEIPT='schema receipt_id crossing_id world_id receiver_particular kind semantic_effect contract_ref pre_state_ref post_state_ref descendant_refs residual_refs note created_at signing extensions'.split(' ');
const SIGN='algorithm public_key signature domain'.split(' ');
const timestamp=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s);
const assertPublic=p=>{
  allowed(p,JWK);
  if(p.kty!=='EC'||p.crv!=='P-256')throw Error('INVALID_P256_KEY');
  for(const k of ['x','y'])
    if(typeof p[k]!=='string'||!(/^[A-Za-z0-9_-]+$/.test(p[k]))||Buffer.from(p[k],'base64url').length!==32||
       Buffer.from(p[k],'base64url').toString('base64url')!==p[k])throw Error('INVALID_P256_POINT');
};
// Single-crossing state address, using exactly reLATTE LocalReceiver's state grammar.
export function stateRef(crossingId,status){
  if(typeof crossingId!=='string'||!crossingId.startsWith('relatte-crossing-v0:'))throw Error('INVALID_CROSSING_ID');
  if(!['NONE','RECEIVED','HOLD'].includes(status))throw Error('INVALID_STATE');
  return 'relatte-local-state-v0:'+prefix('reLATTE-LocalReceiverState-v0|',{
    world_id:CONFIG.world_id,receiver_particular:CONFIG.receiver_particular,
    status:status==='NONE'?[]:[{crossing_id:crossingId,disposition:status}]
  });
}
function identity(receipt){
  allowed(receipt,RECEIPT);
  if(receipt.schema!=='relatte.receipt/v0'||!timestamp(receipt.created_at))throw Error('INVALID_RECEIPT');
  allowed(receipt.signing,SIGN);assertPublic(receipt.signing.public_key);
  if(receipt.signing.algorithm!=='ECDSA-P256-SHA256'||receipt.signing.domain!=='relatte.receipt-signature/v0')
    throw Error('INVALID_SIGNING');
  if(!Array.isArray(receipt.residual_refs)||!Array.isArray(receipt.descendant_refs))throw Error('INVALID_REFS');
  const {signature,...unsignedSigning}=receipt.signing;
  const {receipt_id,...other}=receipt;
  return {...other,signing:unsignedSigning};
}
export function verifyReceipt(receipt){
  try {
    const b=identity(receipt);
    const id='relatte-receipt-v0:'+prefix('reLATTE-Receipt-v0|',b);
    if(receipt.receipt_id!==id)return false;
    const raw=Buffer.from(receipt.signing.signature,'base64url');
    if(raw.length!==64||raw.toString('base64url')!==receipt.signing.signature)return false;
    return verify('sha256',Buffer.from('reLATTE-ReceiptSignature-v0|'+canonical({receipt_id:id,...b})),
      {key:createPublicKey({key:receipt.signing.public_key,format:'jwk'}),dsaEncoding:'ieee-p1363'},raw);
  }catch{return false;}
}
export function freshKeys(){
  const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const private_jwk=pair.privateKey.export({format:'jwk'});
  const p=pair.publicKey.export({format:'jwk'});
  const public_jwk={kty:p.kty,crv:p.crv,x:p.x,y:p.y};
  assertPublic(public_jwk);
  return {schema:'gro.local-signing-key/v0',private_jwk,public_jwk};
}
export function sealReceipt(draft,stored){
  if(!stored?.private_jwk||!stored?.public_jwk)throw Error('MISSING_RECEIVER_KEY');
  assertPublic(stored.public_jwk);
  const p=createPublicKey({key:stored.public_jwk,format:'jwk'});
  const priv=createPrivateKey({key:stored.private_jwk,format:'jwk'});
  if(p.export({format:'jwk'}).x!==createPublicKey(priv).export({format:'jwk'}).x ||
     p.export({format:'jwk'}).y!==createPublicKey(priv).export({format:'jwk'}).y)throw Error('KEYPAIR_MISMATCH');
  const receipt={...draft,receipt_id:'pending',signing:{
    algorithm:'ECDSA-P256-SHA256',public_key:stored.public_jwk,
    signature:'pending',domain:'relatte.receipt-signature/v0'
  }};
  const b=identity(receipt);
  receipt.receipt_id='relatte-receipt-v0:'+prefix('reLATTE-Receipt-v0|',b);
  receipt.signing.signature=sign('sha256',
    Buffer.from('reLATTE-ReceiptSignature-v0|'+canonical({receipt_id:receipt.receipt_id,...b})),
    {key:priv,dsaEncoding:'ieee-p1363'}).toString('base64url');
  if(!verifyReceipt(receipt))throw Error('SELF_CHECK_FAILED');
  return receipt;
}
export function journalEvent(seq,previous_hash,event_type,crossing,receipt,created_at){
  if(![1,2].includes(seq)||!['RECEIVE','DISPOSITION'].includes(event_type))throw Error('INVALID_EVENT');
  const body={schema:'relatte.local-receiver-event/v0',seq,previous_hash,event_type,
    crossing_id:receipt.crossing_id,crossing,receipt,created_at};
  return {...body,event_hash:'relatte-local-event-v0:'+prefix('reLATTE-LocalReceiverEvent-v0|',body)};
}
export function verifyJournalEvents(events,expectedCrossing,expectedKey){
  if(!Array.isArray(events)||events.length!==2)throw Error('INVALID_JOURNAL');
  const [first,second]=events;
  let prev=null;
  for(let i=0;i<2;i++){
    const e=events[i];
    const {event_hash,...body}=e;
    if(e.seq!==i+1||e.previous_hash!==prev||e.event_type!==(i===0?'RECEIVE':'DISPOSITION') ||
      !timestamp(e.created_at)||e.receipt?.created_at!==e.created_at)throw Error('JOURNAL_SEQUENCE');
    if(event_hash!=='relatte-local-event-v0:'+prefix('reLATTE-LocalReceiverEvent-v0|',body) ||
       !verifyReceipt(e.receipt))throw Error('JOURNAL_INTEGRITY');
    if(canonical(e.receipt.signing.public_key)!==canonical(expectedKey))throw Error('JOURNAL_KEY_CHANGED');
    prev=event_hash;
  }
  if(canonical(first.crossing)!==canonical(expectedCrossing)||second.crossing!==null)throw Error('JOURNAL_CROSSING');
  const x=expectedCrossing.crossing_id;
  if(first.crossing_id!==x||second.crossing_id!==x||
    first.receipt.kind!=='RECEIVED'||second.receipt.kind!=='R3_HOLD'||
    first.receipt.semantic_effect!=='none'||second.receipt.semantic_effect!=='none'||
    first.receipt.pre_state_ref!==stateRef(x,'NONE')||first.receipt.post_state_ref!==stateRef(x,'NONE')||
    second.receipt.pre_state_ref!==stateRef(x,'RECEIVED')||
    second.receipt.post_state_ref!==stateRef(x,'HOLD') ||
    first.receipt.world_id!==CONFIG.world_id||second.receipt.world_id!==CONFIG.world_id||
    first.receipt.receiver_particular!==CONFIG.receiver_particular||
    second.receipt.receiver_particular!==CONFIG.receiver_particular||
    first.receipt.contract_ref!==CONFIG.contract_ref||second.receipt.contract_ref!==CONFIG.contract_ref||
    first.receipt.extensions?.local_receiver?.law!=='RECEIVED != ADMITTED'||
    second.receipt.extensions?.local_receiver?.receive_receipt_id!==first.receipt.receipt_id||
    second.receipt.extensions?.local_receiver?.disposition!=='HOLD'||
    second.receipt.extensions?.local_receiver?.protected_payload_effect!==false ||
    first.receipt.extensions?.local_receiver?.history_head_before!==null ||
    second.receipt.extensions?.local_receiver?.history_head_before!==first.event_hash ||
    canonical(first.receipt.residual_refs)!==canonical(expectedCrossing.payload_refs.map(v=>v.address))||
    canonical(second.receipt.residual_refs)!==canonical(expectedCrossing.payload_refs.map(v=>v.address)) ||
    first.receipt.descendant_refs.length!==0||second.receipt.descendant_refs.length!==0)
    throw Error('RECEIPT_CHAIN_INVALID');
  return true;
}
