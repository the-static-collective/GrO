import test from "node:test";
import assert from "node:assert/strict";
import {digestClaim,projectMattercraftEncounter,previewMaterialTransform} from "../src/mattercraft-field.js";

const claim=()=>({
 schema:"gro.mattercraft-material-claim/v0", resourceId:"wood:042",material:"WOOD",
 quantity:42,unit:"wood-bundle",unitStandardRef:"unit:breadbox-wood-candidate",
 placeId:"place:fictional-depot",stewardRef:"steward:fictional-a",
 claimStatus:"OWNER_DECLARED_UNVERIFIED"
});
const witness=()=>({
 observerRef:"actor:fictional-observer",quantityObserved:39,method:"HAND_COUNT",
 evidenceSha256:"e".repeat(64),status:"UNSIGNED_WITNESS_CANDIDATE"
});
const appreciation=()=>({resource:"BANANA",quantity:1,sponsorRef:"steward:fictional-b",
 state:"UNFUNDED_PROPOSAL"});
function render(c=claim(),opts={}){
 return projectMattercraftEncounter({
   place:{id:c.placeId},actor:{id:"actor:volunteer",held:[]},
   claim:c,expectedClaimSha256:digestClaim(c),
   witness:witness(),appreciation:appreciation(),...opts,
 });
}

test("42 wood projects a GrO encounter—not resource balance, work, trade or a public trace",()=>{
 const traces=[{traceId:"trace:old-care",placeId:"place:fictional-depot",tags:["care-work"]}];
 const c=claim();
 const r=render(c,{traces});
 assert.equal(r.schema,"gro.mattercraft-field-projection/v0");
 assert.ok(r.field.affordances.some(a=>a.kind==="encounter"&&a.id.startsWith("mattercraft:inspect:")));
 assert.equal(r.field.affordances.find(a=>a.id.startsWith("mattercraft:inspect:")).authority,"NONE");
 assert.strictEqual(r.traces,traces);
 assert.equal(traces.length,1);
 assert.deepEqual(Object.values(r.effects),Array(8).fill(false));
 assert.equal(r.observations.recognizedSpendableQuantity,0);
 assert.equal(r.proposedFullMeasureQuest.state,"HOLD_NOT_AWARDED");
});

test("42 declared vs 39 observed remains disputed, observer identity unsigned",()=>{
 const r=render();
 assert.equal(r.observations.declared,42);
 assert.equal(r.observations.witnessCandidate,39);
 assert.equal(r.observations.discrepancy,"COUNTS_DISAGREE_HOLD");
 assert.equal(r.proposedAppreciation.resource,"BANANA");
 assert.equal(r.proposedAppreciation.releasePermitted,false);
 assert.equal(r.effects.rewardDispensed,false);
});

test("equal counts do not establish physical truth or signer independence",()=>{
 const equal={...witness(),quantityObserved:42};
 const r=render(claim(),{witness:equal});
 assert.equal(r.observations.discrepancy,"CLAIMS_AGREE_BUT_UNVERIFIED");
 assert.equal(r.observations.recognizedSpendableQuantity,0);
 const missing=render(claim(),{witness:null});
 assert.equal(missing.observations.discrepancy,"NO_WITNESS_CANDIDATE");
});

test("asset bytes are stable and altered self-claim cannot pass external expected digest",()=>{
 const c=claim(), head=digestClaim(c);
 assert.equal(head,digestClaim(JSON.parse(JSON.stringify(c))));
 assert.equal(head.length,64);
 const tampered={...c,quantity:420};
 assert.throws(()=>projectMattercraftEncounter({
   place:{id:tampered.placeId},actor:{id:"actor:test"},
   claim:tampered,expectedClaimSha256:head
 }),/CLAIM_BYTES_CHANGED/);
});
test("locality and unknown evidence/authority fields refuse",()=>{
 const c=claim();
 assert.throws(()=>render(c,{place:{id:"place:elsewhere"}}),/CLAIM_PLACE_MISMATCH/);
 assert.throws(()=>render({...c,adminOverride:true}),/CLAIM_BAD_SHAPE/);
 assert.throws(()=>render({...c,claimStatus:"CUSTODY_CONFIRMED"}),/CLAIM_MUST_BE_UNVERIFIED/);
 assert.throws(()=>render(c,{witness:{...witness(),status:"SIGNED_TRUSTED"}}),/WITNESS_AUTHORITY_UNVERIFIED/);
 assert.throws(()=>render(c,{appreciation:{...appreciation(),state:"PAID"}}),/APPRECIATION_CANNOT_BE_GRANTED/);
});

test("wood-to-ash is a non-effect what-if with unknown ash yield and non-spendable outputs",()=>{
 const c=claim(),r=previewMaterialTransform({
 claim:c,expectedClaimSha256:digestClaim(c),woodInputQty:4
 });
 assert.equal(r.input.quantity,4);
 assert.equal(r.input.inventoryRetired,0);
 assert.equal(r.modeledOutputs.find(x=>x.kind==="ASH").quantity,null);
 assert.equal(r.materialInventoryChanged,false);
 assert.equal(r.physicalBurnAuthorized,false);
 assert.equal(r.newSpendableToken,false);
 assert.equal(r.status,"HOLD_NO_PHYSICAL_OCCURRENCE");
});

test("reject zero, overdraw, non-wood, unknown-unit shortcuts and false reward issuance",()=>{
 const c=claim(),sha=digestClaim(c);
 for(const v of [0,43,-1,1.5,Number.NaN])
   assert.throws(()=>previewMaterialTransform({claim:c,expectedClaimSha256:sha,woodInputQty:v}));
 assert.throws(()=>render({...c,quantity:0}),/CLAIM_BAD_QUANTITY/);
 assert.throws(()=>render({...c,material:"MONEY"}),/MATERIAL_UNKNOWN/);
 assert.throws(()=>render(c,{appreciation:{...appreciation(),quantity:5}}),/APPRECIATION_NOT_BOUNDED/);
 const ash={...c,material:"ASH"};
 assert.throws(()=>previewMaterialTransform({
  claim:ash,expectedClaimSha256:digestClaim(ash),woodInputQty:4
 }),/TRANSFORM_REQUIRES_WOOD/);
});

test("strict source address and incomplete reward cannot bypass the held state",()=>{
 const c=claim();
 assert.throws(()=>render(c,{expectedClaimSha256:"bad"}),/EXPECTED_CLAIM_BAD_SHA256/);
 assert.throws(()=>render(c,{witness:{...witness(),evidenceSha256:"bad"}}),/OBSERVATION_BAD_SHA256/);
 assert.throws(()=>render(c,{appreciation:{...appreciation(),resource:"USD"}}),/APPRECIATION_TYPE_UNSUPPORTED/);
});
