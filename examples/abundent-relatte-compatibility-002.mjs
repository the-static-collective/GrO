// Cross-repository compatibility: native reLATTE independently verifies actual GrO receipts.
// Run only in CI after fetching pinned .deps/reLATTE. No secrets committed.
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {acceptAbundentAndHold,reopenAbundentHold} from '../src/abundent-signed-receiver.js';
const directory=resolve(process.argv[2]||'.deps/reLATTE');
const relatte=await import(pathToFileURL(join(directory,'src/protocol.ts')).href);
const carrier=JSON.parse(await readFile(new URL('../test/fixtures/abundent-lemonpress-catalog-001.json',import.meta.url),'utf8'));
const tmp=await mkdtemp(join(tmpdir(),'gro-reLATTE-v0-'));
try{
 const path=join(tmp,'receiver');
 const {record}=await acceptAbundentAndHold({root:path,carrier,at:'2026-10-11T11:00:00.000Z'});
 assert.equal(await relatte.verifyCrossingEnvelope(carrier.crossing),true);
 assert.equal(await relatte.verifyReceipt(record.events[0].receipt),true);
 assert.equal(await relatte.verifyReceipt(record.events[1].receipt),true);
 const cold=await reopenAbundentHold(path);
 assert.equal(cold.history_head,record.history_head);
 const fake=structuredClone(record.events[1].receipt);fake.note+=' forged';
 assert.equal(await relatte.verifyReceipt(fake),false);
 console.log(JSON.stringify({schema:'gro/relatte-receipt-compatibility/v0',
  native_protocol_verifies_received:true,native_protocol_verifies_hold:true,
  cold_restart_replays:true,forged_receipt_rejected:true,
  operator_identity:'NOT_AUTHENTICATED'},null,2));
}finally{await rm(tmp,{recursive:true,force:true});}
