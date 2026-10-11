import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectAbundentArrival,recordAbundentHold} from '../src/abundent-arrival.js';
import {verifyOccurrenceReceipt} from '../src/receipt.js';
const donor=JSON.parse(await readFile(new URL('./fixtures/abundent-lemonpress-catalog-001.json',import.meta.url),'utf8'));
const tamper=cb=>{const b=structuredClone(donor);cb(b);return b;};
test('GrO independently verifies identical signed source/crossing from webZ',()=>{
 const d=inspectAbundentArrival(donor);
 assert.equal(d.verified_experiment_signature,true);
 assert.equal(d.source_owner_signature,false);
 assert.equal(d.receiver_state,'NOT_RECEIVED');
 assert.equal(d.crossing_id,donor.crossing.crossing_id);
});
test('GrO makes a genuine LOCAL occurrence of HOLD, not signed reLATTE RECEIVE',()=>{
 const r=recordAbundentHold(donor,{actorId:'actor:test-human-reviewer',placeId:'place:review-table',occurredAt:'2026-10-11T08:30:00.000Z'});
 assert.equal(r.disposition,'HOLD');
 assert.equal(r.admitted,false);assert.equal(r.shared,false);
 assert.equal(r.relatte_signed_receive,false);
 assert.equal(r.local_occurrence_receipt.action,'hold-public-reference-for-review');
 assert.ok(verifyOccurrenceReceipt(r.local_occurrence_receipt));
 assert.equal(r.crossing_id,donor.crossing.crossing_id);
 assert.throws(()=>recordAbundentHold(donor,{actorId:'',placeId:'place:a',occurredAt:'2026-10-11T08:30:00.000Z'}));
});
test('GrO refuses byte tamper, changed destination and forged authority',()=>{
 for(const b of [
   tamper(x=>{x.source.content=x.source.content.replace('admitted','unadmitted');}),
   tamper(x=>{x.source.git_blob='0'.repeat(40);}),
   tamper(x=>{x.crossing.audience_policy.destination='world:another';}),
   tamper(x=>{x.source_owner_signed=true;}),
   tamper(x=>{x.crossing.extensions.claim='signed-by-LemonPRESS';}),
   tamper(x=>{x.crossing.signing.signature='A'.repeat(86);}),
   tamper(x=>{x.crossing.crossing_id='relatte-crossing-v0:'+'1'.repeat(64);})
 ])assert.throws(()=>inspectAbundentArrival(b));
});
test('independent local HOLD changes neither source nor crossing',()=>{
 const before=JSON.stringify(donor);
 recordAbundentHold(donor,{actorId:'actor:fixture',placeId:'place:test',occurredAt:'2026-10-11T08:30:00.000Z'});
 assert.equal(JSON.stringify(donor),before);
});
