import {holdGleanQuest,coldVerifyGleanQuest,validateGleanOffer} from "./glean-quest.mjs";

const $=id=>document.getElementById(id);
let prepared=null,generation=0;
function forget(){
  generation++;prepared=null;
  $("complete").hidden=true;$("preview").hidden=true;
  $("message").textContent="";
}
$("offer").addEventListener("change",forget);
$("actor").addEventListener("input",forget);

$("hold").addEventListener("click",async()=>{
  const thisGeneration=++generation;
  prepared=null;$("complete").hidden=true;
  try{
    const file=$("offer").files?.[0];
    if(!file||file.size<3||file.size>524288)throw Error("LOCAL_JSON_MAX_512_KIB_REQUIRED");
    const source=validateGleanOffer(JSON.parse(await file.text()));
    const actorId=$("actor").value.trim();
    const args={offer:source,actorId,placeId:source.site_ref};
    const held=await holdGleanQuest(args);
    await coldVerifyGleanQuest(args,held);
    if(thisGeneration!==generation)return;
    prepared=held;
    $("preview").hidden=false;
    $("summary").textContent=
      source.material_type+" · "+source.purpose+" · "+source.quantity.amount+
      " "+source.quantity.unit+" · Owner assertion: "+
      (source.owner_donation_asserted?"RECORDED, NOT VERIFIED":"NOT ASSERTED")+
      " · Known hazard flags: "+source.hazards.length;
    $("fingerprint").textContent="Quest fingerprint: "+held.quest_id;
    $("complete").hidden=false;
    $("message").textContent="HOLD recorded in this page. No permission or pickup.";
  }catch(e){
    if(thisGeneration===generation){
      $("message").textContent="HOLD — "+String(e?.message||e);
    }
  }
});
$("save").addEventListener("click",()=>{
  if(!prepared)return;
  const uri=URL.createObjectURL(new Blob([JSON.stringify(prepared,null,2)+"\n"],
                                          {type:"application/json"}));
  const a=document.createElement("a");
  a.href=uri;a.download="gro-glean-held-quest.json";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(uri),1500);
});
