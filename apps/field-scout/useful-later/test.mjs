import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match, 'inline script exists');
const coreOnly = match[1].split('window.UsefulLaterCore={VERSION,replay,append,create,merge};')[0] + 'window.UsefulLaterCore={VERSION,replay,append,create,merge};\n})();';
const sandbox = {window:{},Date,Math,Number,String,Set,Error};
vm.runInNewContext(coreOnly,sandbox,{filename:'useful-later-core.js'});
const {create,append,replay,merge}=sandbox.window.UsefulLaterCore;
const base={maker:'Lou',work:'Design a one-page flyer',minutes:20,advance:5,due:'2026-11-05',boundaries:'One revision'};
let seq=0;
const fresh=()=>create(base,`UL-valid-test-${++seq}-abcdefghi`,'2026-10-31T22:00:00Z');
const put=(c,type,actor,other={})=>append(c,{type,actor,...other});
const funded=()=>put(put(fresh(),'ADVANCE_OFFERED','Sarah',{holder:'Sarah'}),'ADVANCE_RECEIVED','Lou');
const error=(fn,msg)=>assert.throws(fn,new RegExp(msg));

test('real life stages are separate: offer ≠ advance ≠ report ≠ confirmation',()=>{
 let c=fresh();assert.equal(replay(c).phase,'open');
 c=put(c,'ADVANCE_OFFERED','Sarah',{holder:'Sarah'});assert.equal(replay(c).phase,'awaiting_receipt');
 error(()=>put(c,'WORK_REPORTED','Lou'),'Maker reports active work');
 c=put(c,'ADVANCE_RECEIVED','Lou');assert.equal(replay(c).phase,'active');
 c=put(c,'WORK_REPORTED','Lou');assert.equal(replay(c).phase,'reported');
 error(()=>put(c,'WORK_CONFIRMED','Lou'),'Only holder confirms');
 c=put(c,'WORK_CONFIRMED','Sarah');assert.equal(replay(c).phase,'completed');
 error(()=>put(c,'WORK_REPORTED','Lou'),'Closed card');
});

test('unreceived advance can be withdrawn, making offer available again',()=>{
 let c=put(fresh(),'ADVANCE_OFFERED','Sarah',{holder:'Sarah'});
 c=put(c,'ADVANCE_WITHDRAWN','Sarah');assert.equal(replay(c).phase,'open');
 error(()=>put(c,'ADVANCE_RECEIVED','Lou'),'Maker must acknowledge');
});

test('transfer requires holder request, maker approval, incoming holder acceptance',()=>{
 let c=funded();error(()=>put(c,'TRANSFER_REQUESTED','Lou',{to:'Bob'}),'Current holder');
 c=put(c,'TRANSFER_REQUESTED','Sarah',{to:'Bob'});
 error(()=>put(c,'WORK_REPORTED','Lou'),'resolve transfers');
 error(()=>put(c,'TRANSFER_ACCEPTED','Bob'),'Incoming holder');
 c=put(c,'TRANSFER_APPROVED','Lou');
 error(()=>put(c,'TRANSFER_ACCEPTED','Sarah'),'Incoming holder');
 c=put(c,'TRANSFER_ACCEPTED','Bob');assert.equal(replay(c).holder,'Bob');
 c=put(put(c,'WORK_REPORTED','Lou'),'WORK_CONFIRMED','Bob');assert.equal(replay(c).phase,'completed');
});

test('HOLD is explicit and reversible, release preserves history',()=>{
 let c=funded();c=put(c,'HOLD_PLACED','Sarah',{note:'Schedule unresolved'});
 error(()=>put(c,'WORK_REPORTED','Lou'),'Resolve HOLD');
 c=put(c,'HOLD_RESOLVED','Lou');c=put(c,'RELEASED','Sarah');
 assert.equal(replay(c).phase,'released');assert.equal(c.events.length,6);
});

test('forged transitions and conflicting imports are rejected',()=>{
 let c=funded();error(()=>put(c,'ADVANCE_RECEIVED','Lou'),'Maker must acknowledge');
 error(()=>create({...base,advance:99},'UL-valid-test-amount-1234567'),'Invalid offer fields');
 error(()=>create({...base,minutes:0},'UL-valid-test-minute-1234567'),'Invalid offer fields');
 const newer=put(c,'WORK_REPORTED','Lou');assert.equal(merge(c,newer).events.length,4);
 assert.equal(merge(newer,c).events.length,4);
 const fork=put(c,'HOLD_PLACED','Sarah',{note:'pause'});
 error(()=>merge(newer,fork),'Conflicting histories');
});

test('event log cannot be mutated into a completed state by a field overwrite',()=>{
 const c=funded();c.phase='completed';c.holder='Ghost';
 assert.equal(replay(c).phase,'active');assert.equal(replay(c).holder,'Sarah');
});
test('reLATTE browser export hashes exact JSON without leaking private terms or claiming a signature',async()=>{
 const {webcrypto,createHash}=await import('node:crypto');
 const {TextEncoder}=await import('node:util');
 const start=html.indexOf('/** Browser-native canonical JSON');
 const end=html.indexOf(' function summary(c,s){',start);
 assert.ok(start>0 && end>start,'export adapter is present');
 const exported=[];
 const w={UsefulLaterCore:{}};
 const sandboxExport={window:w,globalThis:{crypto:webcrypto},crypto:webcrypto,TextEncoder,replay,
   download:(name,content)=>exported.push({name,content}),info:()=>{},JSON,Object,Uint8Array,Array,String,Error};
 vm.runInNewContext(html.slice(start,end),sandboxExport,{filename:'useful-later-relatte-export.js'});
 const c=fresh();
 const signal=await w.UsefulLaterCore.exportRelatte(c);
 const sorted=v=>v&&typeof v==='object'?(Array.isArray(v)?'['+v.map(sorted).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+sorted(v[k])).join(',')+'}'):JSON.stringify(v);
 const sha=(domain,v)=>createHash('sha256').update(domain+sorted(v)).digest('hex');
 assert.equal(signal.content_ref,'sha256:'+sha('reLATTE-PossibilityContent-v0|',c));
 assert.equal(signal.source_event_id,'event:'+sha('reLATTE-GrOEvent-v0|',{card_id:c.id,events:c.events}));
 assert.equal(signal.relation_ref,'relation:'+sha('reLATTE-GrORelation-v0|',c.id));
 assert.equal(signal.schema,'relatte.possibility-signal/v0');
 assert.equal(signal.claim_level,'source_claim');
 assert.equal(signal.scope,'review_only');
 assert.equal(signal.action,'created');
 assert.equal(exported.length,1);
 assert.ok(exported[0].name.includes('UNSIGNED'));
 for(const privateTerm of [base.maker,base.work,base.boundaries,'\"advance\":5']) {
   assert.ok(!JSON.stringify(signal).includes(privateTerm),'private terms must stay at source: '+privateTerm);
 }
});
