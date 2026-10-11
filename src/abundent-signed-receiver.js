// GrO-owned local signed receiver for exactly one independently verified public
// reference carrier. No internet, public endpoint, license, or ADMIT capability.
import {mkdir, readFile, writeFile, lstat} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {inspectAbundentArrival} from './abundent-arrival.js';
import {CONFIG,freshKeys,sealReceipt,journalEvent,verifyJournalEvents,stateRef} from './relatte-signed-hold.js';
import {stableStringify} from './stable.js';

const stamp=t=>typeof t==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(t);
async function readJson(path){return JSON.parse(await readFile(path,'utf8'));}
async function exists(path){try{await lstat(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
function assertNoSymlink(stat){if(stat.isSymbolicLink())throw Error('SYMLINK_DENIED');}
async function safeFile(path){assertNoSymlink(await lstat(path));}
async function initialize(root){
  await mkdir(root,{recursive:false,mode:0o700});
  const signing=freshKeys();
  await writeFile(join(root,'receiver.json'),JSON.stringify(CONFIG,null,2)+'\n',{flag:'wx',mode:0o600});
  await writeFile(join(root,'receiver-key.json'),JSON.stringify(signing,null,2)+'\n',{flag:'wx',mode:0o600});
  return signing;
}
const constrain=d=>{
  if(typeof d!=='string'||!d.trim()||d.includes('\0'))throw Error('INVALID_RECEIVER_PATH');
  return resolve(d);
};
export async function acceptAbundentAndHold({root,carrier,at=new Date().toISOString()}){
  if(!stamp(at))throw Error('INVALID_TIMESTAMP');
  const observed=inspectAbundentArrival(carrier);
  const dir=constrain(root);
  let signing;
  if(await exists(dir)){
    assertNoSymlink(await lstat(dir));
    await safeFile(join(dir,'receiver.json'));
    await safeFile(join(dir,'receiver-key.json'));
    const config=await readJson(join(dir,'receiver.json'));
    if(stableStringify(config)!==stableStringify(CONFIG))throw Error('DIFFERENT_RECEIVER_CONFIG');
    signing=await readJson(join(dir,'receiver-key.json'));
  }else signing=await initialize(dir);
  const journalPath=join(dir,'journal.json');
  if(await exists(journalPath)){
    await safeFile(journalPath);
    const saved=await readJson(journalPath);
    if(saved.schema!=='gro.abundent-signed-receiver/v0'||saved.claim!=='OWNER_LOCAL_PROCESS_NOT_AUTHENTICATED_OPERATOR'
      ||stableStringify(saved.config)!==stableStringify(CONFIG)
      ||stableStringify(saved.carrier)!==stableStringify(carrier) ||
      stableStringify(saved.receiver_public_key)!==stableStringify(signing.public_jwk))
      throw Error('EXISTING_JOURNAL_CONFLICT');
    verifyJournalEvents(saved.events,carrier.crossing,signing.public_jwk);
    if(saved.history_head!==saved.events[1].event_hash)throw Error('HISTORY_HEAD_CHANGED');
    return {record:saved,duplicate:true};
  }
  if(!signing.private_jwk||!signing.public_jwk)throw Error('INVALID_LOCAL_KEY');
  const x=observed.crossing_id,refs=[observed.source_sha256];
  const received=sealReceipt({
    schema:'relatte.receipt/v0',crossing_id:x,world_id:CONFIG.world_id,
    receiver_particular:CONFIG.receiver_particular,kind:'RECEIVED',semantic_effect:'none',
    contract_ref:CONFIG.contract_ref,pre_state_ref:stateRef(x,'NONE'),post_state_ref:stateRef(x,'NONE'),
    descendant_refs:[],residual_refs:refs,note:'Locally verified public reference received; no admission',
    created_at:at,extensions:{local_receiver:{law:'RECEIVED != ADMITTED',history_head_before:null}}
  },signing);
  const first=journalEvent(1,null,'RECEIVE',carrier.crossing,received,at);
  const held=sealReceipt({
    schema:'relatte.receipt/v0',crossing_id:x,world_id:CONFIG.world_id,
    receiver_particular:CONFIG.receiver_particular,kind:'R3_HOLD',semantic_effect:'none',
    contract_ref:CONFIG.contract_ref,pre_state_ref:stateRef(x,'RECEIVED'),post_state_ref:stateRef(x,'HOLD'),
    descendant_refs:[],residual_refs:refs,note:'HOLD is not admission, transmission or endorsement',
    created_at:at,extensions:{local_receiver:{
      disposition:'HOLD',receive_receipt_id:received.receipt_id,
      protected_payload_effect:false,history_head_before:first.event_hash,
      laws:['RECEIPT != ADMISSION','REFUSE != DELETE','HOLD != ADMIT','RETURN != TRANSFER OF AUTHORITY']
    }}
  },signing);
  const second=journalEvent(2,first.event_hash,'DISPOSITION',null,held,at);
  const record={
    schema:'gro.abundent-signed-receiver/v0',
    claim:'OWNER_LOCAL_PROCESS_NOT_AUTHENTICATED_OPERATOR',
    config:CONFIG,
    receiver_public_key:signing.public_jwk,
    carrier,
    events:[first,second],history_head:second.event_hash
  };
  verifyJournalEvents(record.events,carrier.crossing,signing.public_jwk);
  // A deliberately single-use, create-only journal: on crash/failure, reject and
  // let a human inspect the state. No silent key rotation or journal repair.
  await writeFile(journalPath,JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});
  return {record,duplicate:false};
}
export async function reopenAbundentHold(root){
  const dir=constrain(root);
  for(const file of ['receiver.json','receiver-key.json','journal.json'])await safeFile(join(dir,file));
  const config=await readJson(join(dir,'receiver.json'));
  if(stableStringify(config)!==stableStringify(CONFIG))throw Error('DIFFERENT_RECEIVER_CONFIG');
  const key=await readJson(join(dir,'receiver-key.json'));
  const record=await readJson(join(dir,'journal.json'));
  inspectAbundentArrival(record.carrier);
  if(stableStringify(record.config)!==stableStringify(CONFIG) ||
     stableStringify(record.receiver_public_key)!==stableStringify(key.public_jwk) ||
     record.claim!=='OWNER_LOCAL_PROCESS_NOT_AUTHENTICATED_OPERATOR')
    throw Error('INVALID_REPLAY_PROFILE');
  verifyJournalEvents(record.events,record.carrier.crossing,key.public_jwk);
  if(record.history_head!==record.events[1].event_hash)throw Error('HISTORY_MISMATCH');
  return record;
}
