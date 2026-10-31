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