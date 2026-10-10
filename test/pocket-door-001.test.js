import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash,webcrypto} from "node:crypto";
import {act,resolveField} from "../src/field.js";
import {projectPocketDoorEncounter,selectPocketDoorEntrance} from "../src/field-pocket-door.js";
import {doorIds,authoredBody,issueDoor,verifyDoor,enterDoor,offlinePage,escapeHtml,stable,ENTRANCES,SOURCE_STATUS} from "../apps/pocket-door/pocket-core.mjs";
const subtle=webcrypto.subtle;
const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("three curated local door worlds have portable content-addressed envelopes",async()=>{
 assert.deepEqual(doorIds(),["MOSS-042","ROSEMARY-001","LIGHT-KEEP-003"]);
 for(const id of doorIds()){
  const a=await issueDoor(id,subtle),b=await issueDoor(id,subtle);
  assert.deepEqual(a,b);
  assert.deepEqual(await verifyDoor(JSON.stringify(a),subtle),a);
  assert.equal(a.body.sourceStatus,SOURCE_STATUS);
  assert.equal(a.body.entrances.length,4);
  assert.deepEqual(a.body.entrances.map(x=>x.id),ENTRANCES);
  const direct=createHash("sha256").update(JSON.stringify(stable(a.body))).digest("hex");
  assert.equal(a.digest,"sha256:"+direct);
  assert.doesNotMatch(JSON.stringify(a.body),/subscriber|buttondown|private reply|@/i);
 }
});
test("refuses invented doors, altered bytes, permissions and counterfeit recomputed hashes",async()=>{
 const genuine=await issueDoor("MOSS-042",subtle);
 for(const mutate of [
  p=>{p.body.title="Forged world"},
  p=>{p.body.entrances[0].text="Different source"},
  p=>{p.body.sourceStatus="AUTHOR_VERIFIED"},
  p=>{p.body.permission="PUBLICATION_GRANTED"},
  p=>{p.body.id="NONEXISTENT-999"},
  p=>{p.body.source="https://evil.invalid"},
  p=>{p.digest="sha256:"+"0".repeat(64)},
  p=>{p.body.entrances.push({id:"execute",title:"Remote control",text:"Actuate"})},
  p=>{p.body.extra="hidden"},
  p=>{p.schema="gro.pocket-door.v99"},
  p=>{p.admin=true}
 ]){
  const fake=structuredClone(genuine);mutate(fake);
  await assert.rejects(verifyDoor(fake,subtle));
 }
 const recomputed=structuredClone(genuine);recomputed.body.title="Forged world";
 recomputed.digest="sha256:"+createHash("sha256").update(JSON.stringify(stable(recomputed.body))).digest("hex");
 await assert.rejects(verifyDoor(recomputed,subtle),/UNREVIEWED_DOOR_BODY/);
 await assert.rejects(verifyDoor("{garbled",subtle),/DOOR_NOT_JSON/);
 await assert.rejects(verifyDoor(" ".repeat(7001),subtle),/DOOR_TOO_LARGE/);
 await assert.rejects(issueDoor("NOT_A_DOOR",subtle),/UNKNOWN_DOOR/);
});
test("entrances and all eleven depth stops show source content, never invented media",async()=>{
 const pack=await issueDoor("ROSEMARY-001",subtle);
 for(const entrance of ENTRANCES){
  for(let depth=0;depth<=10;depth++){
   const p=await selectPocketDoorEntrance({packet:pack,entrance,depth,subtle});
   assert.equal(p.entrance,entrance);assert.equal(p.depth,depth);
   assert.equal(p.text,depth<4?null:authoredBody(pack.body.id).entrances.find(e=>e.id===entrance).text);
   assert.equal(p.publicTraceEmitted,false);
   assert.equal(p.transmitted,false);
  }
 }
 await assert.rejects(enterDoor(pack,"execute",10,subtle),/ENTRANCE_NOT_ALLOWED/);
 await assert.rejects(enterDoor(pack,"letter",11,subtle),/ENTRANCE_NOT_ALLOWED/);
 await assert.rejects(enterDoor(pack,"letter",-1,subtle),/ENTRANCE_NOT_ALLOWED/);
});
test("opening door is an actor-local encounter, never an action authorization or public trace",async()=>{
 const place={id:"place:gro-local-phone"},actor={id:"actor:phone-user",held:[]};
 const traces=[{schema:"gro.trace.v0",traceId:"trace:old",placeId:place.id,kind:"workmark",tags:["care-work"]}];
 const before=resolveField({place,actor,traces});
 const door=await issueDoor("LIGHT-KEEP-003",subtle);
 const projected=await projectPocketDoorEncounter({place,actor,traces,packet:door,subtle});
 assert.deepEqual(projected.traces,traces);
 assert.deepEqual(projected.field.traceIds,before.traceIds);
 assert.equal(projected.field.affordances.length,before.affordances.length+1);
 const affordance=projected.field.affordances.at(-1);
 assert.equal(affordance.kind,"encounter");
 assert.deepEqual(affordance.dispositions,["notice","hold","ignore","enter-locally","carry-manually"]);
 assert.equal(affordance.permission,"NO_ADDITIONAL_AUTHORITY");
 assert.equal(affordance.actorLocal,true);
 assert.equal(projected.publicTraceEmitted,false);
 assert.equal(projected.remoteWorldAdmitted,false);
 assert.equal(projected.networkTransferPerformed,false);
 assert.equal(projected.signedCrossingCreated,false);
 assert.equal(projected.permissionToEnterPhysicalSpace,false);
 assert.throws(()=>act({place,actor,field:projected.field,actionId:affordance.id,occurredAt:"2026-10-10T00:00:00Z",traces}),/Action is not afforded here/);
 await assert.rejects(projectPocketDoorEncounter({place:{id:"wrong"},actor,traces,packet:door,subtle}),/PLACE_REQUIRED/);
 await assert.rejects(projectPocketDoorEncounter({place,actor:{id:"wrong"},traces,packet:door,subtle}),/ACTOR_REQUIRED/);
});
test("standalone HTML is script-free and usable without source server or external assets",async()=>{
 const pack=await issueDoor("MOSS-042",subtle);
 const page=await offlinePage(pack,"letter",10,subtle);
 assert.match(page,/default-src &#39;none&#39;/);
 assert.match(page,/The winter did not take everything/);
 assert.match(page,new RegExp(pack.digest));
 assert.doesNotMatch(page,/<script|<form|<iframe|<img|<link|<audio|<video/i);
 assert.doesNotMatch(page,/https?:\/\/|mailto:|sms:|subscriber|Buttondown/i);
 assert.equal(escapeHtml('<img src=x onerror="evil()">'),"&lt;img src=x onerror=&quot;evil()&quot;&gt;");
});
test("phone UI has no passive network, send, recipient registry, or storage",()=>{
 const html=source("apps/pocket-door/index.html");
 const ui=source("apps/pocket-door/app.mjs");
 const core=source("apps/pocket-door/pocket-core.mjs");
 assert.match(html,/connect-src 'none'/);
 assert.match(html,/copy-invite/);
 assert.match(html,/hold-note/);
 assert.match(html,/Open locally/);
 assert.doesNotMatch(html,/<form|name="email"|name="phone"|type="tel"/i);
 assert.doesNotMatch(ui,/fetch\(|sendBeacon|WebSocket|RTCPeerConnection|indexedDB|localStorage|sessionStorage|sms:|mailto:|geolocation|contacts/i);
 assert.doesNotMatch(core,/fetch\(|sendBeacon|WebSocket|localStorage|indexedDB/);
 assert.match(ui,/navigator\.clipboard\.writeText/);
 assert.match(ui,/export-html/);
 assert.match(ui,/doorIds\(\)\.includes\(active\)/);
});
