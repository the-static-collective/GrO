import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {inspectPostalEncounterDescriptor,projectPostalEncounter} from "../src/postal-encounter.js";

const desc={
 source:"GHoT-POSTAL-CORPS-003",
 classification:"SYNTHETIC_CUSTODY_CLAIM_ONLY",
 route_id:"route-specimen-001",
 parcel_sha256:"e".repeat(64),
 history_head:"f".repeat(64),
};
const place={id:"place:local-pocket"},actor={id:"actor:local-holder"};
test("every voluntary choice retains local HOLD, source sovereignty and zero rewards",()=>{
 for(const choice of ["notice","hold","refuse","leave-open"]){
  const traces=[{placeId:"other",traceId:"trace:unrelated"}];
  const v=projectPostalEncounter({descriptor:desc,place,actor,traces,choice});
  assert.equal(v.choice,choice);
  assert.equal(v.descriptor.source_verification,"UNVERIFIED_EXTERNAL_IMPORT");
  assert.equal(v.descriptor.physical_custody,"NOT_ESTABLISHED");
  assert.equal(v.publicTraceEmitted,false);
  assert.equal(v.destinationPermission,"NONE");
  assert.equal(v.physicalParcelMoved,false);
  assert.equal(v.fullMeasureDeedAwarded,false);
  assert.equal(v.pennyUnitsIssued,0);
  assert.equal(v.paymentClaimed,false);
  assert.strictEqual(v.traces,traces);
  const door=v.field.affordances.at(-1);
  assert.equal(door.kind,"encounter");
  assert.equal(door.permission,"NONE");
  assert.ok(!v.field.affordances.some(a=>a.kind==="action"&&a.id.startsWith("postal-")));
 }
});
test("reject postal source authority and personal addressing sidecars",()=>{
 for(const d of [
  {...desc,recipient:"123 private street"},
  {...desc,paid:true},
  {...desc,classification:"AUTHENTIC_DELIVERY"},
  {...desc,source:"PAYMENT_API"},
  {...desc,history_head:"invalid"},
  {...desc,route_id:"../../source"},
 ]){
  assert.throws(()=>inspectPostalEncounterDescriptor(d),/POSTAL_DESCRIPTOR/);
 }
});
test("non-local actors cannot promote an encounter to public game progress",()=>{
 assert.throws(()=>projectPostalEncounter({
  descriptor:desc,place:{id:"place:delivery-address"},actor,
 }),/POSTAL_PLACE/);
 assert.throws(()=>projectPostalEncounter({
  descriptor:desc,place,actor:{id:"actor:real-person-name"},
 }),/POSTAL_ACTOR/);
 assert.throws(()=>projectPostalEncounter({
  descriptor:desc,place,actor,choice:"award-penny",
 }),/POSTAL_CHOICE/);
});
test("presentation never contains original private route, address or signature",()=>{
 const projection=projectPostalEncounter({descriptor:desc,place,actor});
 const serialized=JSON.stringify(projection);
 assert.ok(!serialized.includes("signature"));
 assert.ok(!serialized.includes("street"));
 assert.ok(!serialized.includes("holder_id"));
 assert.ok(!serialized.includes("recipient"));
});
test("source module remains standalone and needs no network",()=>{
 const code=readFileSync(new URL("../src/postal-encounter.js",import.meta.url),"utf8");
 assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|localStorage|indexedDB|sendBeacon/);
});
