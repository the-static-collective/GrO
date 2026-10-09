// GrO local HOLD bridge. Browser-safe, signed nowhere, moves no equipment.
// Source photo and exact FORAGE-001 lead are rechecked before any local encounter.
// This is a SHA-addressed *unverified observation*, NOT a reLATTE admission.
import {stableStringify} from "./stable.mjs";
import {affordancesFor, buildLead, photoEvidence} from "./scout-core.mjs";

export const SCHEMA = "gro.local-held-forage-encounter.v0";
const token = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,119}$/;
const valueIsObject = x => x !== null && typeof x === "object" && !Array.isArray(x);
const hasKeys = (x, keys) => valueIsObject(x) &&
  Object.keys(x).sort().join("|") === [...keys].sort().join("|");
const requireCondition = (condition, reason) => {
  if (!condition) throw new Error(reason);
};
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
async function sha256Text(text, subtle) {
  requireCondition(subtle, "LOCAL_CRYPTO_SUBTLE_REQUIRED");
  return hex(new Uint8Array(await subtle.digest("SHA-256", new TextEncoder().encode(text))));
}
const LEAD_KEYS = [
  "schema", "lead_ref", "item_ref", "description", "category", "source_kind",
  "land_class", "site_ref", "steward_ref", "purpose", "quantity", "hazards",
  "observation", "operator_claim_of_ownership",
];
const EVIDENCE_KEYS = [
  "schema", "lead_ref", "origin_role", "original_bytes_sha256",
  "original_byte_count", "content_type", "device_authenticated",
  "camera_capture_authenticated", "rights_inferred_from_photo",
  "hazards_screened_by_machine", "photo_included_in_receipt",
];

function verifyLead(lead) {
  requireCondition(hasKeys(lead, LEAD_KEYS), "EXACT_FORAGE_001_LEAD_REQUIRED");
  requireCondition(lead.schema === "static-os.forage-lead/v0" &&
                   typeof lead.lead_ref === "string" &&
                   lead.lead_ref.startsWith("scout:"),
                   "PHONE_SCOUT_LEAD_REQUIRED");
  const encounter = lead.lead_ref.slice("scout:".length);
  requireCondition(token.test(encounter), "INVALID_ENCOUNTER_ID");
  const fields = {
    description: lead.description,
    category: lead.category,
    observation: lead.observation,
    amount: lead.quantity?.amount,
    unit: lead.quantity?.unit,
    source_kind: lead.source_kind,
    land_class: lead.land_class,
    purpose: lead.purpose,
    site_ref: lead.site_ref,
    steward_ref: lead.steward_ref,
    hazards: lead.hazards,
  };
  const expected = buildLead(fields, encounter);
  requireCondition(stableStringify(expected) === stableStringify(lead),
                   "FORAGE_001_LEAD_CHANGED_OR_AUTHORITY_LAUNDERED");
}

export async function createHeldForageEncounter({
  lead, evidence, originalBytes, actorId, placeId, worldId,
  subtle = globalThis.crypto?.subtle,
}) {
  verifyLead(lead);
  requireCondition(hasKeys(evidence, EVIDENCE_KEYS), "EXACT_LOCAL_PHOTO_EVIDENCE_REQUIRED");
  requireCondition(typeof actorId === "string" && actorId.startsWith("actor:") && token.test(actorId),
                   "ADDRESSABLE_GRo_ACTOR_REQUIRED");
  requireCondition(typeof worldId === "string" && worldId.startsWith("world:") && token.test(worldId),
                   "ADDRESSABLE_GRo_WORLD_REQUIRED");
  requireCondition(placeId === lead.site_ref && typeof placeId === "string" &&
                   token.test(placeId), "GRo_LOCALITY_MUST_MATCH_SOURCE_LEAD");
  requireCondition(originalBytes instanceof Uint8Array, "UNCHANGED_ORIGINAL_FILE_BYTES_REQUIRED");
  const recomputed = await photoEvidence(originalBytes, lead.lead_ref, subtle);
  requireCondition(stableStringify(recomputed) === stableStringify(evidence),
                   "ORIGINAL_PHOTO_AND_EVIDENCE_DO_NOT_MATCH");
  const body = {
    schema: SCHEMA,
    parent_kind: "FORAGE_002_UNREVIEWED_PHOTO_PROSPECT",
    source_contract: "static-os.forage-lead/v0",
    source_lead_ref: lead.lead_ref,
    source_lead_sha256: await sha256Text(stableStringify(lead), subtle),
    photo_evidence_sha256: await sha256Text(stableStringify(evidence), subtle),
    original_photo_sha256: evidence.original_bytes_sha256,
    world_id: worldId,
    place_id: placeId,
    actor_id: actorId,
    operator_selected_category: lead.category,
    proposed_reuses: affordancesFor(lead.category),
    proposals_source: "DETERMINISTIC_CATEGORY_MENU_NOT_GHOT_OR_VISUAL_RECOGNITION",
    disposition: "HOLD_UNRESOLVED",
    trace_visibility: "ACTOR_LOCAL_NOT_PUBLIC",
    stage: "NOTICE_ADDRESS_ENCOUNTER_HELD",
    FORAGE_001_permission_review: "NOT_PERFORMED",
    evidence_is_signed: false,
    source_ownership_verified: false,
    collection_authorized: false,
    physical_item_received: false,
    robot_garden_inspection_completed: false,
    machine_motion_authorized: false,
    accepted_physical_inventory_delta: 0,
    signed_occurrence_receipt_created: false,
    grO_field_trace_created: false,
    allowed_next_human_step: "REVIEW_SOURCE_TITLE_ACCESS_REMOVAL_SCOPE_WITH_FORAGE_001",
  };
  return {...body, encounter_id: "gro:forage-held:sha256:" + await sha256Text(
    stableStringify(body), subtle)};
}

export async function verifyHeldForageEncounter(args, candidate) {
  requireCondition(valueIsObject(candidate), "EXACT_HELD_ENCOUNTER_REQUIRED");
  const expected = await createHeldForageEncounter(args);
  requireCondition(stableStringify(candidate) === stableStringify(expected),
                   "GRo_LOCAL_HELD_ORIGINAL_REPLAY_DISAGREEMENT");
  return expected;
}
