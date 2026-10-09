import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareQuestTenet,verifyFieldQuestEntry} from '../src/field-quest.js';
import {act,resolveField} from '../src/field.js';

const fieldEntry = () => ({
 schema:'static.field-test-entry/v0',
 id:'skymirror-002-first-light',
 source_project:'SKYMIRROR-002',
 source_repository:'the-static-collective/reLATTE',
 source_commit:'540da48104a8a76a87f2acefd60df00ffa76237c',
 source_path:'experiments/SKYMIRROR-002/README.md',
 source_gate:'actual indoor phone-screen → household mirror → second-phone camera capture',
 title:'The First Light Crossing',
 question:'Can two phones transmit and recover HI using only reflected screen light?',
 scale:'QUEST',
 required_materials:['Two phones','One household mirror','Safe indoor test space'],
 procedure:['Read source instructions','Receive with camera','Export raw brightness'],
 safety_boundaries:['No lasers or sky-directed beams','No filming strangers'],
 return_evidence:['Raw brightness trace','Device details','Decode or failure'],
 condition:'READY_FOR_FIELD_TEST',
 condition_ref:null,
 possible_descendant:'Independent repeat with a different phone',
 status:'PHYSICAL_UNVERIFIED',
 provenance_note:'Software tested; physical phone link unverified.'
});
test('Full Measure-shaped source entry creates an addressable but unpublished tenet seed',()=>{
 const entry=fieldEntry();
 const prepared=prepareQuestTenet(entry,{placeId:'place:optical-bench',authorId:'actor:alice'});
 assert.equal(prepared.status,'PREPARED_NOT_LEFT');
 assert.equal(prepared.source_revision,entry.source_commit);
 assert.match(prepared.source_digest,/^sha256:[a-f0-9]{64}$/);
 assert.equal(prepared.technical_verdict,'NOT_DETERMINED');
 assert.equal(prepared.witness_state,'NOT_WITNESSED');
 assert.equal(prepared.authority,'invitation-only');
 assert.equal(prepared.actor.held[0].kind,'tenet-seed');
 assert.deepEqual(verifyFieldQuestEntry(entry),entry);
});
test('actual native GrO action explicitly leaves a tenet and later actor can hold privately',()=>{
 const p=prepareQuestTenet(fieldEntry(),{placeId:'place:optical-bench',authorId:'actor:alice'});
 const initial=resolveField({place:p.place,actor:p.actor,traces:[]});
 assert.ok(initial.affordances.some(a=>a.id==='leave-tenet'));
 const outgoing=act({place:p.place,actor:p.actor,field:initial,actionId:'leave-tenet',occurredAt:'2026-10-09T19:00:00Z',traces:[]});
 const trace=outgoing.traces.find(x=>x.kind==='tenet');
 assert.ok(trace);
 assert.equal(trace.authority,'invitation-only');
 assert.equal(trace.tenet.authorControl,false);
 assert.equal(trace.tenet.seedId,p.seed.id);
 const visitor={id:'actor:bob',held:[]};
 const field=resolveField({place:p.place,actor:visitor,traces:outgoing.traces});
 assert.ok(field.affordances.some(x=>x.id.startsWith('encounter-tenet:')));
 assert.equal(field.affordances.some(x=>x.id.startsWith('through-tenet:')),false);
 const hold=field.affordances.find(x=>x.id.startsWith('hold-tenet:'));
 const result=act({place:p.place,actor:visitor,field,actionId:hold.id,occurredAt:'2026-10-09T19:01:00Z',traces:outgoing.traces});
 assert.equal(result.traces.length,outgoing.traces.length);
 assert.equal(result.receipt.claims.authority,false);
 assert.equal(result.actor.held.at(-1).status,'held-unresolved');
});
test('qualified later actor may choose an attempt but cannot create a test verdict or Full Measure Deed',()=>{
 const p=prepareQuestTenet(fieldEntry(),{placeId:'place:optical-bench',authorId:'actor:alice'});
 const traceResult=act({place:p.place,actor:p.actor,field:resolveField({place:p.place,actor:p.actor,traces:[]}),actionId:'leave-tenet',occurredAt:'2026-10-09T19:00:00Z',traces:[]});
 const visitor={id:'actor:worker',held:[{id:'kit-001',kind:'field-test-kit'}]};
 const field=resolveField({place:p.place,actor:visitor,traces:traceResult.traces});
 const affordance=field.affordances.find(x=>x.id.startsWith('through-tenet:'));
 assert.ok(affordance);
 const response=act({place:p.place,actor:visitor,field,actionId:affordance.id,occurredAt:'2026-10-09T19:02:00Z',traces:traceResult.traces});
 assert.equal(response.traces.at(-1).kind,'tenet-response');
 assert.equal(response.traces.at(-1).authority,'influence-only');
 assert.equal(response.receipt.claims.authority,false);
 assert.ok(!Object.hasOwn(response.receipt,'technical_verdict'));
 assert.ok(!Object.hasOwn(response.receipt,'deed'));
});
test('stale source, fake pass, private sidecar and conditional quest fail closed',()=>{
 const src=fieldEntry();
 for(const bad of [
  {...src,status:'FIELD_VERIFIED'},
  {...src,private_source_notes:'secret'},
  {...src,source_commit:'main'},
  {...src,condition:'NEEDS_PRIOR_WITNESS',condition_ref:null},
 ])assert.throws(()=>verifyFieldQuestEntry(bad));
 const conditional={...src,condition:'NEEDS_PRIOR_WITNESS',condition_ref:src.id};
 assert.throws(()=>prepareQuestTenet(conditional,{placeId:'place:bench',authorId:'actor:alice'}),/PREREQUISITE/);
 assert.throws(()=>prepareQuestTenet(src,{placeId:'',authorId:'actor:alice'}),/LOCAL_CONTEXT/);
});
test('source changes affect seed identity without modifying the original',()=>{
 const original=fieldEntry(),modified={...original,source_gate:'different experimental arrangement'};
 const a=prepareQuestTenet(original,{placeId:'place:bench',authorId:'actor:alice'});
 const b=prepareQuestTenet(modified,{placeId:'place:bench',authorId:'actor:alice'});
 assert.notEqual(a.seed.id,b.seed.id);
 assert.equal(original.source_gate,fieldEntry().source_gate);
});
