#!/usr/bin/env node
// A deliberately local GrO intake operator. Never auto-delivers or publishes.
import {readFile,writeFile} from 'node:fs/promises';
import {recordAbundentHold} from '../src/abundent-arrival.js';
const [input,output,actorId,placeId]=process.argv.slice(2);
if(!input||!output||!actorId||!placeId){
 console.error('Usage: node examples/receive-abundent-001.js PARCEL.json OUT.json ACTOR_ID PLACE_ID');
 process.exitCode=2;
}else{
 try{
  const data=await readFile(input);
  if(data.length>32768)throw Error('OVERSIZED_CARRIER');
  const parcel=JSON.parse(data.toString('utf8'));
  const event=recordAbundentHold(parcel,{actorId,placeId,occurredAt:new Date().toISOString()});
  await writeFile(output,JSON.stringify(event,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log('GrO local HOLD written (not reLATTE RECEIVE): '+event.crossing_id);
 }catch(error){console.error('HOLD NOT WRITTEN: '+error.message);process.exitCode=1;}
}
