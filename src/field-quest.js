// FIELD-QUEST-ENGINE-001 GrO adapter. Interoperates with
// static.field-test-entry/v0 proposals produced by Full Measure.
// Discovery != acceptance; prepared seed != action; trace != technical proof.
import { createHash } from 'node:crypto';
import { stableStringify } from './stable.js';

const REQUIRED_KEYS = [
  'schema','id','source_project','source_repository','source_commit','source_path',
  'source_gate','title','question','scale','required_materials','procedure',
  'safety_boundaries','return_evidence','condition','condition_ref',
  'possible_descendant','status','provenance_note'
].sort();

const fail=(label='INVALID_FIELD_QUEST')=>{throw Error(label)};
const text=(x,limit=1024)=>typeof x==='string' && x.trim() && x.length<=limit;
const keyOk=(x)=>x && typeof x==='object' && !Array.isArray(x) &&
  Object.getPrototypeOf(x)===Object.prototype &&
  JSON.stringify(Object.keys(x).sort())===JSON.stringify(REQUIRED_KEYS);
const listOk=(x)=>Array.isArray(x)&&x.length>=1&&x.length<=12&&x.every(item=>text(item,240));
export function verifyFieldQuestEntry(entry) {
  if(!keyOk(entry)||entry.schema!=='static.field-test-entry/v0'||
     !/^[a-z0-9][a-z0-9-]{2,79}$/.test(entry.id) ||
     !/^[0-9a-f]{40}$/.test(entry.source_commit) ||
     !['SPARK','QUEST','PARTY_ARC'].includes(entry.scale) ||
     !['READY_FOR_FIELD_TEST','NEEDS_PRIOR_WITNESS'].includes(entry.condition) ||
     entry.status!=='PHYSICAL_UNVERIFIED')fail();
  for(const k of ['source_project','source_repository','source_path','source_gate',
                  'title','question','possible_descendant','provenance_note'])
    if(!text(entry[k],k==='question'?800:240))fail();
  for(const k of ['required_materials','procedure','safety_boundaries','return_evidence'])
    if(!listOk(entry[k]))fail();
  if(entry.condition==='READY_FOR_FIELD_TEST' && entry.condition_ref!==null)fail();
  if(entry.condition==='NEEDS_PRIOR_WITNESS' && !text(entry.condition_ref))fail();
  return structuredClone(entry);
}
export function prepareQuestTenet(entry, { placeId, authorId, requiredHeldKind='field-test-kit' }) {
  const source=verifyFieldQuestEntry(entry);
  if(source.condition!=='READY_FOR_FIELD_TEST')fail('QUEST_PREREQUISITE_UNWITNESSED');
  if(!text(placeId,200) || !text(authorId,200) || !text(requiredHeldKind,60))fail('INVALID_LOCAL_CONTEXT');
  const sourceDigest='sha256:'+createHash('sha256').update(stableStringify(source)).digest('hex');
  // Do NOT call act() on behalf of the human. Preparing an offered possibility
  // does not publish a tenet, create a receipt or confer ownership.
  const seed = {
    id: 'field-quest:'+sourceDigest,
    kind: 'tenet-seed',
    label: source.title,
    offeredActionLabel: 'Attempt: '+source.source_gate,
    requiredHeldKind
  };
  return {
    schema:'gro.field-quest-invitation/v0',
    source_digest: sourceDigest,
    source_project: source.source_project,
    source_revision: source.source_commit,
    source_repository: source.source_repository,
    place: {id: placeId},
    actor: {id: authorId,held:[seed]},
    status:'PREPARED_NOT_LEFT',
    technical_verdict:'NOT_DETERMINED',
    witness_state:'NOT_WITNESSED',
    authority:'invitation-only',
    seed
  };
}
