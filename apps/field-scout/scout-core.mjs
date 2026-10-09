// WALL-E FIELD SCOUT — pure, offline browser-side compilation.
// This is NOT visual AI recognition, machine movement or a rights adjudicator.
// Browser-selected records match forage.ledger.validate_lead in Python.
export const SOURCE_LAND = Object.freeze({
  DIRECT_OWNER_OFFER: ["PRIVATE"],
  MUNICIPAL_REUSE: ["MUNICIPAL"],
  PUBLIC_LAND_COLLECTION: ["BLM", "USFS", "STATE_TRUST", "STATE_PARK"],
  PRIVATE_GROUND: ["PRIVATE"],
  CURBSIDE_UNVERIFIED: ["PRIVATE", "MUNICIPAL", "UNKNOWN"],
  UNKNOWN: ["UNKNOWN", "PRIVATE", "MUNICIPAL", "BLM", "USFS", "STATE_TRUST", "STATE_PARK"],
});

export const CATEGORIES = [
  "TECH_ELECTRONICS", "TECH_PARTS", "GENERAL_MATERIAL",
  "BOTANICAL", "FOOD", "MINERAL", "DIGITAL_MATERIAL",
];
export const PURPOSES = ["PERSONAL_NONCOMMERCIAL", "COMMUNITY_NONCOMMERCIAL", "COMMERCIAL"];
export const UNITS = ["ITEM", "GRAM", "KILOGRAM", "POUND", "LITER"];
export const HAZARDS = [
  "POSTED_NO_ENTRY", "LOCKED_CONTAINER", "PROTECTED_SPECIES",
  "CULTURAL_ARTIFACT", "ACTIVE_MINING_CLAIM", "DAMAGED_LITHIUM",
  "UNKNOWN_CHEMICAL", "BIOHAZARD", "UNIDENTIFIED_EDIBLE",
  "PRESSURIZED_CONTAINER", "BATTERY_PRESENT", "MAINS_POWER",
  "SHARP_MATERIAL", "UNCERTAIN_CONTAMINATION",
];

const STOP = new Set([
  "POSTED_NO_ENTRY", "LOCKED_CONTAINER", "PROTECTED_SPECIES",
  "CULTURAL_ARTIFACT", "ACTIVE_MINING_CLAIM", "DAMAGED_LITHIUM",
  "UNKNOWN_CHEMICAL", "BIOHAZARD", "UNIDENTIFIED_EDIBLE",
  "PRESSURIZED_CONTAINER",
]);

const AFFORDANCES = Object.freeze({
  TECH_ELECTRONICS: ["Enclosure reference", "Repair/parts research", "Electronics recycling check"],
  TECH_PARTS: ["Bracket or fixture candidate", "Motor/drive research", "Fastener recovery check"],
  GENERAL_MATERIAL: ["Stock dimensions to inspect", "Fixture/stand candidate", "Material condition check"],
  BOTANICAL: ["Species/land rights research", "Composting suitability research", "Ecology observation"],
  FOOD: ["Positive species identification needed", "Food safety research", "Do not taste to identify"],
  MINERAL: ["Geological documentation", "Land and claim status review", "Material identification"],
  DIGITAL_MATERIAL: ["Licensing and provenance review", "Reusable design reference", "No unauthorized copying"],
});

export function affordancesFor(category) {
  if (!CATEGORIES.includes(category)) throw new Error("Unknown operator-selected category");
  return [...AFFORDANCES[category]];
}

export function validLandsFor(source) {
  if (!Object.hasOwn(SOURCE_LAND, source)) throw new Error("Unknown collection source");
  return [...SOURCE_LAND[source]];
}

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,119}$/;
function boundedText(v, name) {
  const value = String(v ?? "").trim();
  if (value.length < 3 || value.length > 240 || value.includes("\0")) {
    throw new Error(name + " must be 3–240 characters");
  }
  return value;
}
function id(v, name) {
  const value = String(v ?? "").trim();
  if (!TOKEN.test(value)) throw new Error(name + " needs a valid reference");
  return value;
}

export function buildLead(fields, identifier) {
  const source = String(fields.source_kind);
  const category = String(fields.category);
  const land = String(fields.land_class);
  if (!Object.hasOwn(SOURCE_LAND, source) || !SOURCE_LAND[source].includes(land)) {
    throw new Error("Land class doesn't match this source");
  }
  if (!CATEGORIES.includes(category) || !PURPOSES.includes(fields.purpose)
      || !UNITS.includes(fields.unit)) throw new Error("Unknown category, purpose or unit");
  if (category === "DIGITAL_MATERIAL" && source === "PUBLIC_LAND_COLLECTION") {
    throw new Error("Digital licenses cannot be inferred from public land collection");
  }
  const quantity = Number(fields.amount);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) {
    throw new Error("Quantity must be an integer from 1 to 100000");
  }
  const hazards = [...(fields.hazards || [])];
  if (new Set(hazards).size !== hazards.length ||
      hazards.some(x => !HAZARDS.includes(x))) throw new Error("Invalid hazard list");
  const token = id(identifier, "Encounter");
  return {
    schema: "static-os.forage-lead/v0",
    lead_ref: "scout:" + token,
    item_ref: "scout:item-" + token,
    description: boundedText(fields.description, "Description"),
    category, source_kind: source, land_class: land,
    site_ref: id(fields.site_ref || "unknown:site", "Site"),
    steward_ref: id(fields.steward_ref || "unknown:steward", "Steward"),
    purpose: fields.purpose,
    quantity: {amount: quantity, unit: fields.unit},
    hazards, observation: boundedText(fields.observation, "Observation"),
    operator_claim_of_ownership: false,
  };
}

export function imageFormat(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12) throw new Error("Image file too small");
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
      && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) {
    return "image/png";
  }
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  throw new Error("Choose a JPEG or PNG; original HEIC/video needs another adapter");
}

export async function photoEvidence(bytes, leadRef, subtle = globalThis.crypto?.subtle) {
  if (!(bytes instanceof Uint8Array) || bytes.length > 16 * 1024 * 1024) {
    throw new Error("Photo must be a local JPEG/PNG no larger than 16 MiB");
  }
  if (!subtle) throw new Error("Secure HTTPS or localhost needed to hash the original file");
  const content_type = imageFormat(bytes);
  const digest = await subtle.digest("SHA-256", bytes);
  const sha = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  return {
    schema: "static-os.forage-photo-evidence/v0",
    lead_ref: id(leadRef, "Lead"),
    origin_role: "OPERATOR_SELECTED_LOCAL_IMAGE_UNVERIFIED",
    original_bytes_sha256: sha,
    original_byte_count: bytes.length,
    content_type,
    device_authenticated: false,
    camera_capture_authenticated: false,
    rights_inferred_from_photo: false,
    hazards_screened_by_machine: false,
    photo_included_in_receipt: false,
  };
}

export function cautionCodes(lead) {
  const codes = ["NO_SCOPED_AUTHORITY_REVIEW", "CAMERA_DOES_NOT_ESTABLISH_TITLE"];
  if (["CURBSIDE_UNVERIFIED", "UNKNOWN"].includes(lead.source_kind)) {
    codes.push("OWNERSHIP_UNKNOWN_NO_PICKUP");
  }
  if (["BLM", "USFS", "STATE_TRUST", "STATE_PARK"].includes(lead.land_class)) {
    codes.push("LOCAL_LAND_RESOURCE_RULES_NEED_VERIFICATION");
  }
  for (const h of lead.hazards) if (STOP.has(h)) codes.push("STOP_" + h);
  if (lead.hazards.some(h => !STOP.has(h))) codes.push("PHYSICAL_SAFETY_INSPECTION_NEEDED");
  if (lead.category === "FOOD" || lead.category === "BOTANICAL") {
    codes.push("NO_SPECIES_OR_EDIBILITY_IDENTIFICATION");
  }
  return codes;
}
