#!/usr/bin/env node
// Phone field 002: intentionally tiny, ASCII-only reLATTE CrossingEnvelope v0
// fixture generator. Do NOT generalize this hand-rolled JCS subset to arbitrary
// numbers, Unicode, or untrusted objects: use normative reLATTE for production.
import { generateKeyPairSync, createHash, sign } from 'node:crypto';
const canonicalAscii = (value) => {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string' && /[^\x20-\x7e]/.test(value)) {
      throw new Error('FIXTURE_ASCII_ONLY');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalAscii).join(',') + ']';
  return '{' + Object.keys(value).sort()
    .map(k => JSON.stringify(k)+':'+canonicalAscii(value[k])).join(',') + '}';
};
const hex = value => createHash('sha256').update(value).digest('hex');
const { publicKey, privateKey } = generateKeyPairSync('ec', {namedCurve:'prime256v1'});
const exported = publicKey.export({format:'jwk'});
const body = {
  schema:'relatte.crossing-envelope/v0',
  protocol_version:'0',
  source_particular:'particular:gro-phone-demo',
  source_world:'world:gro-phone-demo',
  source_history_head:null,
  parents:[],
  declared_kind:'GRO_PHONE_FIRST_CROSSING',
  payload_refs:[],
  requested_effect:null,
  capability_ref:null,privacy_policy:null,audience_policy:null,
  return_address:null,
  created_at:'2026-10-09T18:00:00.000Z',
  signing:{
    algorithm:'ECDSA-P256-SHA256',
    public_key:{kty:'EC',crv:'P-256',x:exported.x,y:exported.y},
    domain:'relatte.crossing-signature/v0',
  },
  extensions:{note:'Physical carrier != admission. A demonstration signed crossing.'},
};
const crossing_id='relatte-crossing-v0:'+hex('reLATTE-CrossingEnvelope-v0|'+canonicalAscii(body));
const signature=sign('sha256',Buffer.from(
  'reLATTE-CrossingSignature-v0|'+canonicalAscii({crossing_id,...body}),
),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
const crossing={...body,crossing_id,signing:{...body.signing,signature}};
process.stdout.write(JSON.stringify(crossing,null,2)+'\n');
