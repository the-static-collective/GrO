// GrO POCKET-DOOR 001: public demo doors, local entrance projections.
// No network, messenger, token, automatic publication or signed-world claim.
export const SCHEMA="gro.pocket-door.v0";
const ids=["MOSS-042","ROSEMARY-001","LIGHT-KEEP-003"];
export const ENTRANCES=["letter","sound","wander","workbench"];
export const DEPTH_STOPS=11;
export const SOURCE_STATUS="CURATED_PUBLIC_DEMO_UNSIGNED";
const catalog={
  "MOSS-042":{
    title:"The Moss Room",
    invitation:"A little room for things that survive difficult winters.",
    source:"gro:pocket-door-001/moss-fixture",
    entrances:[
      {id:"letter",title:"A light left on",text:"Someone left a little light on for you. The winter did not take everything."},
      {id:"sound",title:"The broken radio",text:"A small radio hums beside the window. Its antenna is bent. The music comes and goes. This is a written listening scene, not audio playback."},
      {id:"wander",title:"Follow the moss",text:"There is moss between the floorboards and a path through the doorway. Look closer, or let the room remain quiet."},
      {id:"workbench",title:"A repairable thing",text:"On the workbench: a bent antenna and a little wire. Inspect the idea of repairing the radio. Nothing is actuated or ordered."}
    ]
  },
  "ROSEMARY-001":{
    title:"Rosemary Roses",
    invitation:"A room for loving through the quiet winter of a serious relationship.",
    source:"gro:pocket-door-001/rosemary-fixture",
    entrances:[
      {id:"letter",title:"At the chipped blue plate",text:"There is a rosemary jar by the sink, and a blue plate with a chip. A small domestic particular anchors the room."},
      {id:"sound",title:"An unfinished refrain",text:"Imagine the radio nearly working. This door points toward music but does not contain a licensed audio file or playback."},
      {id:"wander",title:"The lived-in kitchen",text:"You can notice the salt, the dirt on the hands, the rose and its thorns. The room is for what endured, not a perfect scene."},
      {id:"workbench",title:"What stays",text:"Inspect the objects on the kitchen table. Their relationships suggest possible stories. They do not prove private events."}
    ]
  },
  "LIGHT-KEEP-003":{
    title:"Keep a Little Light",
    invitation:"A tiny encouragement you do not have to earn or forward.",
    source:"gro:pocket-door-001/rootline-fixture",
    entrances:[
      {id:"letter",title:"For whoever arrives",text:"I don't know what today has asked of you. I'm glad you're here. You may keep this and do nothing else."},
      {id:"sound",title:"A quiet minute",text:"Imagine a slow breath and a low note, with no audio playing. Silence can be enough."},
      {id:"wander",title:"No quest required",text:"There are no points, timers, streaks or directions here. You can sit in the room, or leave."},
      {id:"workbench",title:"The smallest useful work",text:"A blank slip of paper sits on a workbench. You may write a local note, but it will not be transmitted or published."}
    ]
  }
};
const exact=(o,keys)=>o!==null&&typeof o==="object"&&!Array.isArray(o)&&
 Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const digit=/^sha256:[a-f0-9]{64}$/;
export const doorIds=()=>[...ids];
export const stable=value=>{
 if(Array.isArray(value))return value.map(stable);
 if(value!==null&&typeof value==="object")
  return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
 return value;
};
const canonical=value=>JSON.stringify(stable(value));
const sha=async(value,subtle=globalThis.crypto?.subtle)=>{
 if(!subtle)throw Error("WEBCRYPTO_REQUIRED");
 const bytes=new TextEncoder().encode(canonical(value));
 const hash=new Uint8Array(await subtle.digest("SHA-256",bytes));
 return "sha256:"+Array.from(hash,b=>b.toString(16).padStart(2,"0")).join("");
};
export function authoredBody(id){
 if(!Object.hasOwn(catalog,id))throw Error("UNKNOWN_DOOR");
 const c=catalog[id];
 return {id,title:c.title,invitation:c.invitation,source:c.source,
  sourceStatus:SOURCE_STATUS,permission:"PUBLIC_DEMO_VIEW_AND_VOLUNTARY_SHARE",
  entrances:c.entrances.map(e=>({...e}))};
}
export async function issueDoor(id,subtle){
 const body=authoredBody(id);
 return {schema:SCHEMA,body,digest:await sha(body,subtle)};
}
export async function verifyDoor(raw,subtle){
 let candidate=raw;
 if(typeof raw==="string"){
  if(new TextEncoder().encode(raw).length>7000)throw Error("DOOR_TOO_LARGE");
  try{candidate=JSON.parse(raw)}catch{throw Error("DOOR_NOT_JSON")}
 }
 if(!exact(candidate,["schema","body","digest"])||candidate.schema!==SCHEMA||
    !digit.test(candidate.digest)||!exact(candidate.body,
     ["id","title","invitation","source","sourceStatus","permission","entrances"]))
  throw Error("DOOR_SHAPE_INVALID");
 const expected=authoredBody(candidate.body.id);
 // These first three demo doors are the ONLY admitted source shapes.
 // Recomputed attacker-controlled hashes must not introduce invented rights.
 if(canonical(candidate.body)!==canonical(expected))
  throw Error("UNREVIEWED_DOOR_BODY");
 if(candidate.digest!==await sha(expected,subtle))
  throw Error("DOOR_DIGEST_MISMATCH");
 return candidate;
}
export async function enterDoor(raw,entrance="letter",depth=10,subtle){
 const verified=await verifyDoor(raw,subtle);
 if(!ENTRANCES.includes(entrance)||!Number.isInteger(depth)||depth<0||depth>10)
  throw Error("ENTRANCE_NOT_ALLOWED");
 const found=verified.body.entrances.find(e=>e.id===entrance);
 return {schema:"gro.local-door-projection.v0",doorId:verified.body.id,
  sourceDigest:verified.digest,entrance:found.id,title:found.title,
  text:depth<4?null:found.text,
  depth,sourceStatus:SOURCE_STATUS,disposition:"LOCAL_VIEW_ONLY",
  transmitted:false,publicTraceEmitted:false};
}
export const escapeHtml=s=>String(s).replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
export async function offlinePage(raw,entrance="letter",depth=10,subtle){
 const view=await enterDoor(raw,entrance,depth,subtle),esc=escapeHtml;
 return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'+
 '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; base-uri &#39;none&#39;; form-action &#39;none&#39;">'+
 '<title>'+esc(view.title)+' · GrO Pocket Door</title>'+
 '<style>body{background:#18271e;color:#eee9dd;font:18px/1.6 Georgia,serif;padding:6vw;max-width:700px;margin:auto}h1{font-size:clamp(35px,7vw,70px)}.small{font:12px/1.6 system-ui;color:#c3cbb5}article{border-top:1px solid #627259;padding-top:16px}</style>'+
 '<main><p class="small">GrO · POCKET DOOR · '+esc(view.doorId)+'</p><h1>'+esc(view.title)+'</h1><article><p>'+esc(view.text??"Raise the detail dial to read this entrance.")+'</p></article>'+
 '<p class="small">Source digest: '+esc(view.sourceDigest)+'</p><p class="small">Local unsigned artistic projection. No sender identity verification, audio playback, messages, publication or other remote effect.</p></main></html>';
}
