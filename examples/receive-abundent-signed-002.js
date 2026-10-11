#!/usr/bin/env node
// Explicit offline arrival at a GrO-local persistent receiver.
// Usage: node examples/receive-abundent-signed-002.js PARCEL.json RECEIVER_DIR
import {readFile} from 'node:fs/promises';
import {acceptAbundentAndHold,reopenAbundentHold} from '../src/abundent-signed-receiver.js';
const [input,root]=process.argv.slice(2);
if(!input||!root){console.error('Usage: node examples/receive-abundent-signed-002.js PARCEL.json RECEIVER_DIR');process.exitCode=2;}
else {
 try {
  const raw=await readFile(input);
  if(raw.length>32768)throw Error('OVERSIZED_CARRIER');
  const {record,duplicate}=await acceptAbundentAndHold({root,carrier:JSON.parse(raw.toString('utf8'))});
  const cold=await reopenAbundentHold(root);
  if(cold.history_head!==record.history_head)throw Error('COLD_REPLAY_MISMATCH');
  console.log(JSON.stringify({
   schema:'gro.abundent-receipt-command/v0',duplicate,root,history_head:record.history_head,
   received:record.events[0].receipt.receipt_id,held:record.events[1].receipt.receipt_id,
   published:false,admitted:false,operator_authenticated:false
  },null,2));
  console.log('Import '+root+'/journal.json into Abundent /arrivals/receipts/ for independent verification.');
 }catch(e){console.error('SIGNED HOLD REFUSED: '+e.message);process.exitCode=1;}
}
