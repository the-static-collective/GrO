import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=new URL('../examples/receive-abundent-001.js',import.meta.url);
const donor=new URL('./fixtures/abundent-lemonpress-catalog-001.json',import.meta.url);
test('CLI produces create-only GrO local HOLD, refuses duplicate writes and tampered input',async()=>{
 const d=await mkdtemp(join(tmpdir(),'gro-arrival-'));
 try{
  const out=join(d,'hold.json');
  const run=input=>spawnSync(process.execPath,[root.pathname,input,out,'actor:review','place:desk'],{encoding:'utf8'});
  const ok=run(donor.pathname);
  assert.equal(ok.status,0,ok.stderr);
  const r=JSON.parse(await readFile(out,'utf8'));
  assert.equal(r.disposition,'HOLD');
  assert.equal(r.relatte_signed_receive,false);
  assert.equal(r.local_occurrence_receipt.claims.occurrence,true);
  assert.notEqual(run(donor.pathname).status,0,'existing output cannot be overwritten');
  const bad=join(d,'forged.json'),b=JSON.parse(await readFile(donor,'utf8'));
  b.source.content+='tamper';
  await writeFile(bad,JSON.stringify(b));
  assert.notEqual(spawnSync(process.execPath,[root.pathname,bad,join(d,'bad-hold.json'),'actor:review','place:desk']).status,0);
 }finally{await rm(d,{recursive:true,force:true});}
});
