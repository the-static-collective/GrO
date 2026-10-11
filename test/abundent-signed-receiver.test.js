import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyReceipt,stateRef,CONFIG} from '../src/relatte-signed-hold.js';
import {acceptAbundentAndHold,reopenAbundentHold} from '../src/abundent-signed-receiver.js';
const donor=JSON.parse(await readFile(new URL('./fixtures/abundent-lemonpress-catalog-001.json',import.meta.url),'utf8'));
const work=async f=>{
 const root=await mkdtemp(join(tmpdir(),'gro-relatte-receive-'));
 try{await f(join(root,'receiver'));}finally{await rm(root,{recursive:true,force:true});}
};
test('GrO issues actual reLATTE v0 P256 signed RECEIVED -> R3_HOLD and replays cold',async()=>work(async dir=>{
 const {record,duplicate}=await acceptAbundentAndHold({root:dir,carrier:donor,at:'2026-10-11T10:00:00.000Z'});
 assert.equal(duplicate,false);
 assert.equal(record.config.world_id,CONFIG.world_id);
 assert.equal(record.events.length,2);
 const [a,b]=record.events;
 assert.ok(verifyReceipt(a.receipt));assert.ok(verifyReceipt(b.receipt));
 assert.equal(a.receipt.kind,'RECEIVED');assert.equal(b.receipt.kind,'R3_HOLD');
 assert.equal(a.receipt.semantic_effect,'none');assert.equal(b.receipt.semantic_effect,'none');
 assert.equal(b.receipt.extensions.local_receiver.receive_receipt_id,a.receipt.receipt_id);
 assert.equal(a.receipt.pre_state_ref,stateRef(donor.crossing.crossing_id,'NONE'));
 assert.equal(b.receipt.pre_state_ref,stateRef(donor.crossing.crossing_id,'RECEIVED'));
 assert.equal(b.receipt.post_state_ref,stateRef(donor.crossing.crossing_id,'HOLD'));
 assert.deepEqual(record.receiver_public_key,a.receipt.signing.public_key);
 assert.equal(record.history_head,b.event_hash);
 const cold=await reopenAbundentHold(dir);
 assert.deepEqual(cold,record);
 const replay=await acceptAbundentAndHold({root:dir,carrier:donor});
 assert.equal(replay.duplicate,true);
 assert.deepEqual(replay.record,record);
 const key=JSON.parse(await readFile(join(dir,'receiver-key.json'),'utf8'));
 assert.ok(key.private_jwk.d);assert.equal(record.receiver_public_key.d,undefined);
 assert.ok(!JSON.stringify(record).includes(key.private_jwk.d),'private key cannot enter public export');
}));
test('signature tamper and detached chain cannot replay',async()=>work(async dir=>{
 await acceptAbundentAndHold({root:dir,carrier:donor});
 const saved=await readFile(join(dir,'journal.json'),'utf8'),b=JSON.parse(saved);
 b.events[1].receipt.note='FORGED';
 await writeFile(join(dir,'journal.json'),JSON.stringify(b));
 await assert.rejects(reopenAbundentHold(dir),/JOURNAL_INTEGRITY/);
 await writeFile(join(dir,'journal.json'),saved);
 const c=JSON.parse(saved);c.events[1].previous_hash='relatte-local-event-v0:'+'f'.repeat(64);
 await writeFile(join(dir,'journal.json'),JSON.stringify(c));
 await assert.rejects(reopenAbundentHold(dir),/JOURNAL_SEQUENCE/);
}));
test('source mutation / unauthorized destination is refused before any signer is created',async()=>work(async dir=>{
 const v=structuredClone(donor);v.source.content+='changed';
 await assert.rejects(acceptAbundentAndHold({root:dir,carrier:v}),/SOURCE_BYTES_CHANGED/);
 await assert.rejects(readFile(join(dir,'receiver-key.json')),{code:'ENOENT'});
}));
test('different file or receiver configuration cannot overwrite history',async()=>work(async dir=>{
 const {record}=await acceptAbundentAndHold({root:dir,carrier:donor});
 const forged=structuredClone(donor);forged.crossing.audience_policy.destination='world:alien';
 await assert.rejects(acceptAbundentAndHold({root:dir,carrier:forged}));
 const config=join(dir,'receiver.json'),before=await readFile(config,'utf8');
 await writeFile(config,before.replace('world:gro-local-review','world:alien'));
 await assert.rejects(reopenAbundentHold(dir),/DIFFERENT_RECEIVER_CONFIG/);
 assert.equal(record.events[1].receipt.kind,'R3_HOLD');
});
