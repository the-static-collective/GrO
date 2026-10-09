import {
  SOURCE_LAND, CATEGORIES, PURPOSES, UNITS, HAZARDS,
  affordancesFor, validLandsFor, buildLead, photoEvidence, cautionCodes,
} from "./scout-core.mjs";

// Minimal camera-first browser app. No network, geo, localStorage or third-party APIs.
// An encounter's IDs exist only for this current page session.
const $ = id => document.getElementById(id);
const encounterRef = globalThis.crypto?.randomUUID?.() ||
  ("session-" + Date.now().toString(36) + "-" + Math.floor(Math.random()*1e8).toString(36));
let prepared = null;
let chosenImage = null;
let previewURL = null;

const pretty = value => value.replaceAll("_", " ").toLowerCase().replace(/\b[a-z]/g, m => m.toUpperCase());
function options(node, entries, preferred = null) {
  node.replaceChildren();
  for (const [value, label] of entries) {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    node.appendChild(o);
  }
  if (preferred && entries.some(e => e[0] === preferred)) node.value = preferred;
}
function landOptions() {
  const allowed = validLandsFor($("source").value);
  options($("land"), allowed.map(v => [v, pretty(v)]),
          allowed.includes("UNKNOWN") ? "UNKNOWN" : allowed[0]);
}
function drawIdeas() {
  const el = $("ideas");
  el.replaceChildren();
  for (const idea of affordancesFor($("category").value)) {
    const span = document.createElement("span");
    span.textContent = idea;
    el.appendChild(span);
  }
}
function resetPrepared() {
  prepared = null;
  $("result").hidden = true;
  $("message").textContent = "";
}
function prepareHazards() {
  const el = $("hazards");
  for (const hazard of HAZARDS) {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.name = "hazard";
    cb.value = hazard;
    const name = document.createElement("span");
    name.textContent = pretty(hazard);
    label.append(cb, name);
    el.appendChild(label);
  }
}
function download(name, object) {
  const data = new Blob([JSON.stringify(object, null, 2) + "\n"],
                        {type: "application/json"});
  const uri = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = uri;
  anchor.download = name;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(uri), 8000);
}
function fields() {
  return {
    description: $("description").value,
    category: $("category").value,
    observation: $("observation").value,
    amount: $("amount").value,
    unit: $("unit").value,
    source_kind: $("source").value,
    land_class: $("land").value,
    purpose: $("purpose").value,
    site_ref: $("site").value,
    steward_ref: $("steward").value,
    hazards: [...document.querySelectorAll('input[name="hazard"]:checked')]
      .map(x => x.value),
  };
}

options($("category"), CATEGORIES.map(x => [x, pretty(x)]), "TECH_PARTS");
options($("source"), Object.keys(SOURCE_LAND).map(x => [x, pretty(x)]), "UNKNOWN");
options($("purpose"), PURPOSES.map(x => [x, pretty(x)]), "COMMUNITY_NONCOMMERCIAL");
options($("unit"), UNITS.map(x => [x, pretty(x)]), "ITEM");
landOptions();
prepareHazards();
drawIdeas();

$("category").addEventListener("change", drawIdeas);
$("source").addEventListener("change", landOptions);
$("encounter-form").addEventListener("input", resetPrepared);
$("encounter-form").addEventListener("change", resetPrepared);
$("photo").addEventListener("change", () => {
  resetPrepared();
  chosenImage = $("photo").files?.[0] || null;
  if (previewURL) URL.revokeObjectURL(previewURL);
  previewURL = null;
  $("preview").hidden = true;
  $("preview-placeholder").hidden = false;
  if (!chosenImage) return;
  if (chosenImage.size > 16 * 1024 * 1024) {
    $("message").textContent = "Choose a JPEG/PNG under 16 MiB.";
    chosenImage = null;
    return;
  }
  // URL is used for local image preview only, never transmitted.
  previewURL = URL.createObjectURL(chosenImage);
  $("preview").src = previewURL;
  $("preview").hidden = false;
  $("preview-placeholder").hidden = true;
});
$("encounter-form").addEventListener("submit", async event => {
  event.preventDefault();
  resetPrepared();
  try {
    if (!chosenImage) throw new Error("Choose an original JPEG or PNG photo first.");
    const lead = buildLead(fields(), encounterRef);
    const bytes = new Uint8Array(await chosenImage.arrayBuffer());
    const evidence = await photoEvidence(bytes, lead.lead_ref);
    const held = await createHeldForageEncounter({\n      lead, evidence, originalBytes: bytes,\n      actorId: "actor:local-phone-operator", placeId: lead.site_ref,\n      worldId: "world:gro-local-phone",\n    });\n    prepared = {lead, evidence, held};
    $("hash").textContent = "Original-file SHA-256: " + evidence.original_bytes_sha256;
    $("blockers").textContent = "HOLD: " + cautionCodes(lead).join(" · ");
    $("message").textContent = "Prepared local evidence. No permission or pickup was granted.";
    $("result").hidden = false;
  } catch (error) {
    $("message").textContent = String(error?.message || error);
  }
});
$("save-lead").addEventListener("click", () => {
  if (prepared) download("forage-lead-" + encounterRef + ".json", prepared.lead);
});
$("save-gro").addEventListener("click", () => {\n  if (prepared) download("gro-forage-hold-" + encounterRef + ".json", prepared.held);\n});\n$("save-photo").addEventListener("click", () => {
  if (prepared) download("forage-photo-evidence-" + encounterRef + ".json",
                         prepared.evidence);
});
globalThis.addEventListener("pagehide", () => {
  if (previewURL) URL.revokeObjectURL(previewURL);
});
