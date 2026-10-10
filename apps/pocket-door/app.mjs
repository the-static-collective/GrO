import {doorIds,issueDoor,verifyDoor,enterDoor,offlinePage,ENTRANCES} from "./pocket-core.mjs";
const $=id=>document.getElementById(id);
const active=new URL(location.href).searchParams.get("door");
let packet=null,locked=false;
const status=(message,bad=false)=>{$("status").textContent=message;$("status").dataset.error=String(bad)};
function download(name,text,type){
 const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),800);
}
function sync(){
 $("export-json").disabled=!packet;
 $("export-html").disabled=!packet;
 $("copy-invite").disabled=!packet;
 $("copy-json").disabled=!packet;
 $("local-note").disabled=!packet;
 $("hold-note").disabled=!packet;
 $("title").textContent=packet?.body.title??"Choose a door.";
 $("digest").textContent=packet?.digest??"No verified demo door is in this pocket.";
 $("invite").textContent=packet?.body.invitation??"No obligation to enter.";
 if(!packet){$("scene").textContent="The room is waiting.";return}
 void show();
}
async function show(){
 if(!packet)return;
 const view=await enterDoor(packet,$("entrance").value,Number($("depth").value));
 $("scene-title").textContent=view.title;
 $("scene").textContent=view.text??"Raise the detail dial to read the authored entrance.";
 $("depth-label").textContent=view.depth+"/10";
 $("note-display").textContent=$("local-note").value.trim()||
   "No reflection held; this is a complete encounter.";
}
async function run(fn){
 if(locked)return;
 locked=true;
 try{await fn()}catch(error){packet=null;status("HOLD · "+(error?.message||"UNKNOWN_ERROR"),true)}
 finally{locked=false;sync()}
}
async function copy(text){
 $("copy-area").value=text;
 try{await navigator.clipboard.writeText(text);status("COPIED · NO MESSAGE WAS SENT")}
 catch{$("copy-area").focus();$("copy-area").select();
  status("CLIPBOARD UNAVAILABLE · SELECT AND COPY BELOW",true)}
}
$("open").addEventListener("click",()=>run(async()=>{
 packet=await issueDoor($("door").value);
 status("CURATED PUBLIC DEMO VERIFIED · CHOOSE ANY ENTRANCE");
}));
$("load-file").addEventListener("change",event=>run(async()=>{
 const file=event.target.files?.[0];if(!file)return;
 if(file.size>7000)throw Error("DOOR_TOO_LARGE");
 packet=await verifyDoor(await file.text());
 $("door").value=packet.body.id;
 event.target.value="";
 status("CARRIED DEMO DOOR VERIFIED · NO SENDER AUTHENTICATION");
}));
$("load-paste").addEventListener("click",()=>run(async()=>{
 packet=await verifyDoor($("import-area").value);
 $("door").value=packet.body.id;
 status("PASTED DEMO DOOR VERIFIED · NOTHING UPLOADED");
}));
$("entrance").addEventListener("change",()=>void show());
$("depth").addEventListener("input",()=>void show());
$("local-note").addEventListener("input",()=>void show());
$("hold-note").addEventListener("click",()=>{
 if(!packet)return;
 $("note-display").textContent=$("local-note").value.trim()||"Nothing to hold; keeping the door is enough.";
 status("LOCAL REFLECTION ONLY · NOT SAVED OR SENT");
});
$("copy-invite").addEventListener("click",()=>{
 if(!packet)return;
 const u=new URL(location.href);u.search="";u.hash="";u.searchParams.set("door",packet.body.id);
 const link=u.protocol==="https:"?
  u.href:"(No shareable host URL is configured yet)";
 const message="Someone left a little door for you.\n"+packet.body.id+
  " — "+packet.body.invitation+"\n"+link+
  "\nYou can keep it, open it, or ignore it. No reply needed.";
 void copy(message);
});
$("copy-json").addEventListener("click",()=>{
 if(packet)void copy(JSON.stringify(packet));
});
$("export-json").addEventListener("click",()=>{
 if(packet)download("gro-door-"+packet.body.id+".json",JSON.stringify(packet,null,2)+"\n","application/json");
});
$("export-html").addEventListener("click",()=>run(async()=>{
 if(!packet)return;
 const page=await offlinePage(packet,$("entrance").value,Number($("depth").value));
 download("gro-"+packet.body.id+"-"+$("entrance").value+".html",page,"text/html");
 status("SINGLE-FILE OFFLINE ROOM GENERATED LOCALLY");
}));
$("clear").addEventListener("click",()=>{
 packet=null;$("local-note").value="";$("import-area").value="";
 $("copy-area").value="";$("note-display").textContent="";
 status("EMPTY POCKET · NO SESSION SAVED");sync();
});
for(const id of doorIds()){
 const option=document.createElement("option");option.value=id;option.textContent=id;
 $("door").append(option);
}
for(const mode of ENTRANCES){
 const option=document.createElement("option");option.value=mode;
 option.textContent=mode[0].toUpperCase()+mode.slice(1);$("entrance").append(option);
}
if(doorIds().includes(active)){$("door").value=active;void run(async()=>{
 packet=await issueDoor(active);status("PUBLIC DEMO DOOR OPENED BY CHOICE · NO TRANSFER");})}
else sync();
