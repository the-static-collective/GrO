import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname } from "node:path";

export const LOCALITY = "gro:locality:sibley-park-mankato-mn";
const kinds = new Set(["observation", "cleanup_report", "improvement"]);
const zones = new Set(["general", "trails", "farm", "ballfields", "river", "hill", "event-route"]);
const materials = new Set(["tinsel", "plastic", "paper", "metal", "other"]);

export function sameCode(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function checkCodes(config) {
  const codes = [config.inviteCode, config.stewardCode, config.witnessCode];
  if (codes.some(v => typeof v !== "string" || v.length < 16) || new Set(codes).size !== 3) {
    throw Error("Three distinct 16+ character SIBLEY_INVITE_CODE, SIBLEY_STEWARD_CODE and SIBLEY_WITNESS_CODE are required.");
  }
}
function checkText(value, min, max) {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length >= min && s.length <= max ? s : null;
}
function pointOrInvalid(p) {
  if (p == null) return null;
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) ||
      p.lat < 44.145 || p.lat > 44.176 || p.lng < -94.054 || p.lng > -94.014) return false;
  return { lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000 };
}
export function makeReport(d, existing) {
  if (!d || d.consent_to_review !== true || !kinds.has(d.kind) ||
      !zones.has(d.zone) || !materials.has(d.material)) throw Error("Consent, kind, zone and material required");
  const note = checkText(d.note, 5, 700), point = pointOrInvalid(d.point);
  if (!note || point === false) throw Error("Invalid report or coarse location");
  if (d.kind === "cleanup_report" && d.permission_affirmed !== true) {
    throw Error("Authorization affirmation required for cleanup reports");
  }
  const sourceId = d.source_local_id == null ? null : checkText(d.source_local_id, 8, 100);
  if (d.source_local_id != null && !sourceId) throw Error("Invalid source ID");
  if (sourceId && existing.some(r => r.source_local_id === sourceId)) {
    const error = Error("Local report already received"); error.status = 409; throw error;
  }
  return { id: randomUUID(), source_local_id: sourceId, locality: LOCALITY,
    kind: d.kind, zone: d.zone, material: d.material, note, point,
    permission_affirmed: d.kind === "cleanup_report" ? true : null,
    created_at: new Date().toISOString(), review: null, witness: null, public_summary: null };
}
export function reviewReport(record, data) {
  if (!record || !["publish", "hold", "refuse"].includes(data?.decision)) throw Error("Unknown report or review disposition");
  const summary = data.decision === "publish" ? checkText(data.summary, 10, 200) : null;
  if (data.decision === "publish" && !summary) throw Error("Separate public-safe summary required");
  const note = data.note == null ? "" : checkText(data.note, 0, 250);
  if (note === null) throw Error("Review note too long");
  record.review = { decision: data.decision, note, at: new Date().toISOString(), actor_role: "steward_code_holder" };
  record.public_summary = summary;
  return { status: data.decision, full_measure_deed_issued: false };
}
export function witnessReport(record, data) {
  if (!record || record.kind !== "cleanup_report" || record.review?.decision !== "publish" ||
      !["confirm", "dispute", "hold"].includes(data?.decision)) throw Error("Report unavailable for witness decision");
  const note = checkText(data.note, 6, 250);
  if (!note) throw Error("Explanatory witness note required");
  if (data.decision === "confirm" && (data.independent_observation !== true || data.authorized_activity !== true)) {
    throw Error("Independent observation and authorization affirmations required");
  }
  record.witness = { decision: data.decision, note, at: new Date().toISOString(),
    actor_role: "witness_code_holder",
    independent_observation_affirmed: data.decision === "confirm",
    authorized_activity_affirmed: data.decision === "confirm" };
  return { disposition: data.decision, deed_candidate_only: data.decision === "confirm",
    full_measure_deed_issued: false };
}
export function publicBoard(rows) {
  return { schema: "gro/sibley-public-board/v0.2", locality: LOCALITY,
    review_only: true, no_live_locations: true,
    items: rows.filter(r => r.review?.decision === "publish").map(r => ({
      id: r.id, kind: r.kind, zone: r.zone, material: r.material,
      summary: r.public_summary, reviewed_at: r.review.at,
      witness_attestation: r.witness?.decision === "confirm",
      deed_candidate_only: r.kind === "cleanup_report" && r.witness?.decision === "confirm",
      authority: "unaffiliated experimental pilot"
    })) };
}
export function openStore(path) {
  let state;
  try {
    state = JSON.parse(readFileSync(path, "utf8"));
    if (state.schema !== "gro/sibley-relay-state/v0.2" || !Array.isArray(state.records)) throw Error("Invalid existing data file");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    state = { schema: "gro/sibley-relay-state/v0.2", records: [] };
  }
  return { records: state.records, save() {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const temp = path + "." + process.pid + ".tmp";
    writeFileSync(temp, JSON.stringify(state, null, 2), { mode: 0o600 });
    renameSync(temp, path);
  } };
}
