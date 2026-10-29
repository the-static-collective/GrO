// GrO MATTERCRAFT-001: reproducible fictional 42 WOOD read-only walk.
// This creates NO actual inventory, inspection, reward, burned wood or real Deed.
import {digestClaim,projectMattercraftEncounter,previewMaterialTransform} from "../src/mattercraft-field.js";

const claim={
  schema:"gro.mattercraft-material-claim/v0",
  resourceId:"wood:042",material:"WOOD",quantity:42,unit:"wood-bundle",
  unitStandardRef:"unit:breadbox-wood-candidate",
  placeId:"place:fictional-depot",stewardRef:"steward:fictional-a",
  claimStatus:"OWNER_DECLARED_UNVERIFIED"
};
const source=digestClaim(claim);
const field=projectMattercraftEncounter({
  place:{id:claim.placeId},actor:{id:"actor:fictional-volunteer",held:[]},traces:[],
  claim,expectedClaimSha256:source,
  witness:{observerRef:"actor:fictional-counter",quantityObserved:39,method:"HAND_COUNT",
    evidenceSha256:"e".repeat(64),status:"UNSIGNED_WITNESS_CANDIDATE"},
  appreciation:{resource:"BANANA",quantity:1,sponsorRef:"steward:fictional-b",
    state:"UNFUNDED_PROPOSAL"}
});
const transformation=previewMaterialTransform({
  claim,expectedClaimSha256:source,woodInputQty:4
});
console.log(JSON.stringify({
  status:"SYNTHETIC_HOLD_NO_REAL_ACTION",sourceClaimSha256:source,
  claimQuantity:claim.quantity,observedQuantity:field.observations.witnessCandidate,
  counterDiscrepancy:field.observations.discrepancy,
  affordances:field.field.affordances.filter(a=>a.id.startsWith("mattercraft:")),
  quest:field.proposedFullMeasureQuest,
  thankYou:field.proposedAppreciation,proposedBurn:transformation,
  effects:field.effects
},null,2));
