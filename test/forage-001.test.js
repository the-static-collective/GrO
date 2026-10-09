import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto, createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {act, resolveField} from "../src/field.js";
import {projectHeldForageEncounter} from "../src/field-forage.js";
import {buildLead, photoEvidence, cautionCodes} from "../apps/field-scout/scout-core.mjs";
import {createHeldForageEncounter, verifyHeldForageEncounter} from "../apps/field-scout/gro-hold.mjs";

const png = new Uint8Array(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==",
  "base64"
));
const fields = {
  description: "Curious abandoned-looking old printer frame",
  observation: "From public sidewalk. Owner unknown; no contact or pickup",
  category: "TECH_PARTS",
  source_kind: "CURBSIDE_UNVERIFIED",
  land_class: "UNKNOWN",
  site_ref: "unknown:site",
  steward_ref: "unknown:steward",
  purpose: "COMMUNITY_NONCOMMERCIAL",
  amount: 1, unit: "ITEM",
  hazards: ["BATTERY_PRESENT"],
};
const makeArgs = async (originalBytes=png) => {
  const lead = buildLead(fields, "encounter-001");
  const evidence = await photoEvidence(originalBytes, lead.lead_ref, webcrypto.subtle);
  return {
    lead, evidence, originalBytes, worldId:"world:gro-local-phone",
    actorId:"actor:person-holding-phone", placeId:lead.site_ref,
    subtle:webcrypto.subtle,
  };
};

test("actual phone lead and hashed bytes compile into GrO HOLD, with no permissions", async () => {
  const args = await makeArgs();
  const actual = await createHeldForageEncounter(args);
  assert.equal(actual.schema, "gro.local-held-forage-encounter.v0");
  assert.equal(actual.source_contract, "static-os.forage-lead/v0");
  assert.match(actual.encounter_id, /^gro:forage-held:sha256:[a-f0-9]{64}$/);
  assert.equal(actual.source_lead_ref, args.lead.lead_ref);
  assert.equal(actual.original_photo_sha256, args.evidence.original_bytes_sha256);
  assert.equal(actual.disposition, "HOLD_UNRESOLVED");
  assert.equal(actual.FORAGE_001_permission_review, "NOT_PERFORMED");
  assert.equal(actual.trace_visibility, "ACTOR_LOCAL_NOT_PUBLIC");
  assert.equal(actual.signed_occurrence_receipt_created, false);
  assert.equal(actual.collection_authorized, false);
  assert.equal(actual.physical_item_received, false);
  assert.equal(actual.robot_garden_inspection_completed, false);
  assert.equal(actual.accepted_physical_inventory_delta, 0);
  assert.equal(actual.grO_field_trace_created, false);
  assert.equal(actual.machine_motion_authorized, false);
  assert.deepEqual(await verifyHeldForageEncounter(args, actual), actual);
  assert.ok(cautionCodes(args.lead).includes("OWNERSHIP_UNKNOWN_NO_PICKUP"));
});

test("cold replay rejects changed actual original photo", async () => {
  const args = await makeArgs();
  const result = await createHeldForageEncounter(args);
  await assert.rejects(() => verifyHeldForageEncounter({
    ...args, originalBytes: new Uint8Array([...args.originalBytes, 44])
  }, result), /ORIGINAL_PHOTO_AND_EVIDENCE_DO_NOT_MATCH/);
});

test("external assertion cannot forge GrO local field authority even with rehashed metadata", async () => {
  const args = await makeArgs();
  const original = await createHeldForageEncounter(args);
  for (const [key, newValue] of [
    ["collection_authorized", true],
    ["source_ownership_verified", true],
    ["physical_item_received", true],
    ["machine_motion_authorized", true],
    ["accepted_physical_inventory_delta", 1],
    ["trace_visibility", "PUBLIC"],
    ["FORAGE_001_permission_review", "APPROVED"],
    ["signed_occurrence_receipt_created", true],
    ["proposals_source", "REAL_GHOT_CAMERA_INFERENCE"],
  ]) {
    const altered = {...original, [key]:newValue};
    await assert.rejects(() => verifyHeldForageEncounter(args, altered),
                         /GRo_LOCAL_HELD_ORIGINAL_REPLAY_DISAGREEMENT/);
  }
});

test("GrO field projection exposes only encounter kind, no pickup act and no public trace", async () => {
  const args = await makeArgs();
  const heldEncounter = await createHeldForageEncounter(args);
  const place = {id:args.placeId};
  const actor = {id:args.actorId,held:[]};
  const traces = [{
    schema:"gro.trace.v0", traceId:"trace:old-care",placeId:place.id,
    tags:["care-work"],kind:"workmark",
  }];
  const before = resolveField({place,actor,traces});
  const projected = await projectHeldForageEncounter({
    place,actor,traces,lead:args.lead,evidence:args.evidence,
    originalBytes:args.originalBytes,worldId:args.worldId,
    heldEncounter,subtle:webcrypto.subtle,
  });
  assert.deepEqual(projected.traces, traces);
  assert.deepEqual(traces.length, 1);
  assert.deepEqual(projected.field.traceIds, before.traceIds);
  assert.equal(projected.field.affordances.length, before.affordances.length + 1);
  const offer=projected.field.affordances.at(-1);
  assert.equal(offer.kind, "encounter");
  assert.equal(offer.actorLocal, true);
  assert.equal(offer.permission, "NOT_GRANTED");
  assert.deepEqual(offer.dispositions, ["notice","hold","ignore"]);
  assert.equal(projected.permissionToCollect, false);
  assert.equal(projected.authorityToEnter, false);
  assert.equal(projected.publicTraceEmitted, false);
  assert.equal(projected.physicalInventoryChanged, false);
  assert.equal(projected.machineMotionAuthorized, false);
  assert.throws(() => act({
    place, actor,field:projected.field,actionId:offer.id,
    occurredAt:"2026-10-09T18:30:00Z",traces
  }), /Action is not afforded here/);
});

test("alternate locality cannot import unresolved encounter by name", async () => {
  const args = await makeArgs();
  const heldEncounter = await createHeldForageEncounter(args);
  await assert.rejects(() => projectHeldForageEncounter({
    place:{id:"site:different-place"},actor:{id:args.actorId},
    heldEncounter, ...args,
  }), /FORAGE_PLACE_MUST_MATCH_OBSERVATION/);
  await assert.rejects(() => verifyHeldForageEncounter({
    ...args,worldId:"world:another"
  }, heldEncounter), /GRo_LOCAL_HELD_ORIGINAL_REPLAY_DISAGREEMENT/);
});

test("no proof laundering via photo role or apparent item owner", async () => {
  const args = await makeArgs();
  await assert.rejects(() => createHeldForageEncounter({
    ...args, evidence: {...args.evidence, rights_inferred_from_photo:true}
  }), /ORIGINAL_PHOTO_AND_EVIDENCE_DO_NOT_MATCH/);
  await assert.rejects(() => createHeldForageEncounter({
    ...args, lead:{...args.lead, operator_claim_of_ownership:true}
  }), /FORAGE_001_LEAD_CHANGED_OR_AUTHORITY_LAUNDERED/);
  await assert.rejects(() => createHeldForageEncounter({
    ...args, lead:{...args.lead, entry_granted:true}
  }), /EXACT_FORAGE_001_LEAD_REQUIRED/);
});

test("mobile stable serializer is an exact mirror of native GrO engine", () => {
  const upstream=readFileSync(new URL("../src/stable.js", import.meta.url));
  const mirror=readFileSync(new URL("../apps/field-scout/stable.mjs", import.meta.url));
  assert.deepEqual(mirror, upstream);
});

test("the upstream FORAGE-002 compiler remains source-pinned", () => {
  // Github source blob SHA from static-os experimental FORAGE-002 PR #83.
  const source=readFileSync(new URL("../apps/field-scout/scout-core.mjs", import.meta.url));
  const nativeGitBlobSha=createHash("sha1")
    .update(Buffer.from("blob "+source.length+"\\0"))
    .update(source)
    .digest("hex");
  assert.equal(nativeGitBlobSha, "363c7127cb0405e32a86a58d79f6365151a1ed1d");
});

test("GrO app caches only first-party static assets, not photo capture or reports", () => {
  const sw=readFileSync(new URL("../apps/field-scout/sw.js", import.meta.url), "utf8");
  assert.match(sw, /gro-field-scout-shell-v1/);
  assert.match(sw, /urls\.has\(new URL\(event\.request\.url\)\.href\)/);
  assert.doesNotMatch(sw, /\.jpg|\.png|\.MP4|originalBytes|receipt\.json|localStorage/);
  const manifest=JSON.parse(readFileSync(
    new URL("../apps/field-scout/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.start_url, "./index.html");
});

test("phone HTML includes complete save trio, camera and no actual robot control", () => {
  const source = file => readFileSync(
    new URL("../apps/field-scout/"+file, import.meta.url), "utf8");
  const html=source("index.html"),app=source("app.mjs");
  assert.match(html, /capture="environment"/);
  assert.match(html, /save-lead/);
  assert.match(html, /save-photo/);
  assert.match(html, /save-gro/);
  assert.match(html, /collection NOT authorized/);
  assert.match(html, /connect-src 'none'/);
  assert.match(app, /createHeldForageEncounter/);
  assert.match(app, /gro-forage-hold-/);
  assert.doesNotMatch(app, /\bfetch\s*\(|navigator\.geolocation|navigator\.sendBeacon/);
});
