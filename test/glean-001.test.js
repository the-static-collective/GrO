import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto,createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {act,resolveField} from "../src/field.js";
import {projectGleanQuest} from "../src/field-glean.js";
import {validateGleanOffer,holdGleanQuest,coldVerifyGleanQuest} from "../apps/field-scout/glean-quest.mjs";
import {stableStringify} from "../apps/field-scout/stable.mjs";

const offer=()=>JSON.parse(readFileSync(
  new URL("../apps/field-scout/glean-example.json",import.meta.url),"utf8"));
const context=()=>({
  offer:offer(),actorId:"actor:local-gleaner",placeId:offer().site_ref,
  subtle:webcrypto.subtle,
});

test("real source-byte SHA-256 matches local GrO quest fingerprint",async()=>{
  const args=context();
  const held=await holdGleanQuest(args);
  assert.equal(held.schema,"gro.glean-held-quest/v0");
  const digest=createHash("sha256").update(stableStringify(args.offer)).digest("hex");
  assert.equal(held.offer_fingerprint,"sha256:"+digest);
  assert.equal(held.disposition,"HOLD_UNRESOLVED");
  assert.equal(held.public_world_trace_created,false);
  assert.equal(held.owner_authenticated,false);
  assert.equal(held.permission_to_enter_or_collect,false);
  assert.equal(held.actual_pickup_reported,false);
  assert.equal(held.machine_motion_authorized,false);
  assert.equal(held.treasury_credit,0);
  assert.equal(held.receiver_local_admission,false);
  assert.deepEqual(await coldVerifyGleanQuest(args,held),held);
});

test("Glean legally different from spare workshop surplus",async()=>{
  const x=offer();
  assert.equal(validateGleanOffer(x).purpose,"FREE_DISTRIBUTION");
  assert.equal(x.material_type,"AGRICULTURAL_CROP");
  assert.throws(()=>validateGleanOffer({...x,purpose:"NONCOMMERCIAL_WORKSHOP_GIFT"}),
    /GLEAN_CROP_DONATION_MUST_SERVE_FREE_DISTRIBUTION/);
  assert.throws(()=>validateGleanOffer({...x,material_type:"WORKSHOP_SURPLUS"}),
    /GLEAN_WORKSHOP_IS_NOT_FOOD_DONATION/);
  assert.throws(()=>validateGleanOffer({...x,owner_donation_asserted:"true"}),
    /GLEAN_OFFER_INVALID_OR_FORGED_AUTHORITY/);
  assert.throws(()=>validateGleanOffer({...x,offer_is_authenticated_by_software:true}),
    /GLEAN_OFFER_INVALID_OR_FORGED_AUTHORITY/);
});

test("source mutations, revoked owner claims or forged right-to-collect cannot replay",async()=>{
  const args=context(),quest=await holdGleanQuest(args);
  for(const patch of [
    {quantity:{amount:100,unit:"POUND"}},
    {owner_donation_asserted:false},
    {valid_until:"2026-10-20"},
    {site_ref:"specimen:incorrect-field"},
  ]){
    await assert.rejects(coldVerifyGleanQuest({...args,offer:{...args.offer,...patch}},quest),
      /GRO_GLEAN_ORIGINAL_OFFER_COLD_REPLAY_DISAGREEMENT|GRO_QUEST_LOCALITY_MISMATCH/);
  }
  for(const change of [
    {permission_to_enter_or_collect:true},
    {public_world_trace_created:true},
    {owner_authenticated:true},
    {machine_motion_authorized:true},
    {receiver_local_admission:true},
    {treasury_credit:4},
  ]){
    const fake={...quest,...change};
    await assert.rejects(coldVerifyGleanQuest(args,fake),
      /GRO_GLEAN_ORIGINAL_OFFER_COLD_REPLAY_DISAGREEMENT/);
  }
});

test("GrO field adds encounter only and never changes original traces",async()=>{
  const args=context(),held=await holdGleanQuest(args);
  const place={id:args.placeId},actor={id:args.actorId,held:[]};
  const traces=[{traceId:"trace:prior-care",kind:"workmark",placeId:place.id,tags:["care-work"]}];
  const before=resolveField({place,actor,traces});
  const result=await projectGleanQuest({
    place,actor,traces,offer:args.offer,heldQuest:held,subtle:webcrypto.subtle,
  });
  assert.equal(result.field.affordances.length,before.affordances.length+1);
  const affordance=result.field.affordances.at(-1);
  assert.equal(affordance.kind,"encounter");
  assert.deepEqual(affordance.dispositions,["notice","hold","ignore"]);
  assert.equal(affordance.authority,"none");
  assert.equal(result.publicTraceCreated,false);
  assert.equal(result.collectPermitted,false);
  assert.equal(result.inventoryDelta,0);
  assert.deepEqual(traces,result.traces);
  assert.throws(()=>act({
    place,actor,field:result.field,actionId:affordance.id,
    occurredAt:"2026-10-09T15:00:00Z",traces,
  }),/Action is not afforded here/);
});

test("place and actor binding cannot move grant to alternate world",async()=>{
  const args=context(),held=await holdGleanQuest(args);
  await assert.rejects(holdGleanQuest({...args,placeId:"specimen:another-site"}),
    /GRO_QUEST_LOCALITY_MISMATCH/);
  await assert.rejects(coldVerifyGleanQuest({...args,actorId:"actor:somebody-else"},held),
    /GRO_GLEAN_ORIGINAL_OFFER_COLD_REPLAY_DISAGREEMENT/);
});

test("unknown, duplicate, invalid hazards and negative quantities cannot be imported",()=>{
  const x=offer();
  assert.throws(()=>validateGleanOffer({...x,quantity:{amount:-1,unit:"POUND"}}),
    /GLEAN_QUANTITY_INVALID/);
  assert.throws(()=>validateGleanOffer({...x,hazards:["CULTURAL_ARTIFACT"]}),
    /GLEAN_HAZARDS_INVALID/);
  assert.throws(()=>validateGleanOffer({...x,hazards:["CONTAMINATION","CONTAMINATION"]}),
    /GLEAN_HAZARDS_INVALID/);
  assert.throws(()=>validateGleanOffer({...x,access_granted:true}),
    /GLEAN_OFFER_EXACT_FIELDS_REQUIRED/);
  assert.throws(()=>validateGleanOffer({...x,valid_from:"2026-02-30"}),
    /INVALID_GLEAN_DATE/);
});

test("GrO phone extension is offline local-only and accessible",()=>{
  const html=readFileSync(new URL("../apps/field-scout/glean.html",import.meta.url),"utf8");
  const app=readFileSync(new URL("../apps/field-scout/glean-ui.mjs",import.meta.url),"utf8");
  const entry=readFileSync(new URL("../apps/field-scout/index.html",import.meta.url),"utf8");
  const sw=readFileSync(new URL("../apps/field-scout/sw.js",import.meta.url),"utf8");
  assert.match(entry,/glean\.html/);
  assert.match(html,/GLEAN-001/);
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/id="offer"/);
  assert.match(app,/holdGleanQuest/);
  assert.match(app,/coldVerifyGleanQuest/);
  assert.match(sw,/glean\.html/);
  assert.doesNotMatch(app,/\bfetch\s*\(|navigator\.geolocation|localStorage\.setItem/);
});

test("pinned cross-repo specimen stays byte identical to Static OS",()=>{
  const source=readFileSync(new URL("../apps/field-scout/glean-example.json",import.meta.url));
  const sha=createHash("sha1").update(Buffer.from("blob "+source.length))
    .update(Buffer.from([0])).update(source).digest("hex");
  assert.equal(sha,"3b3801e03548c95d2068b141f5dce12dc3258501");
});
