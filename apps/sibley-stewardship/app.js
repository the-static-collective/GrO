const KEY = "gro-sibley-local-field-v0.1";
const LOCALITY = "gro:locality:sibley-park-mankato-mn";
const CENTER = [44.16111, -94.03333]; // approximate park focus, not a surveyed boundary
const form = document.getElementById("field-form");
const recordsEl = document.getElementById("records");
let selectedPoint = null;
let map = null;
let temporaryPin = null;
let observationLayer = null;

function load() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(value) ? value.filter(row => row && row.locality === LOCALITY).slice(-500) : [];
  } catch { return []; }
}
let traces = load();
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(traces)); return true; }
  catch { window.alert("Device storage is unavailable. Please export your existing traces instead."); return false; }
}
function node(tag, text, className) {
  const result = document.createElement(tag);
  result.textContent = text;
  if (className) result.className = className;
  return result;
}
function draw() {
  document.getElementById("local-count").textContent = String(traces.length);
  document.getElementById("site-count").textContent = String(traces.filter(t => t.point).length);
  recordsEl.replaceChildren();
  if (!traces.length) recordsEl.append(node("li", "Nothing recorded yet.", "muted"));
  for (const trace of traces.slice().reverse()) {
    const li = document.createElement("li");
    li.append(node("strong", trace.kind.replaceAll("_", " ") + " · " + trace.zone));
    li.append(node("div", trace.note));
    li.append(node("small", trace.time.slice(0, 16).replace("T", " ") + " UTC · proposed · local only"));
    recordsEl.append(li);
  }
  if (!map || !window.L) return;
  if (observationLayer) observationLayer.remove();
  observationLayer = L.layerGroup().addTo(map);
  traces.filter(t => t.point).forEach(t => {
    L.circleMarker([t.point.lat, t.point.lng], { radius: 7, color: "#ad672e", fillOpacity: .65 })
      .bindPopup(document.createTextNode(t.kind + " · unverified local report"))
      .addTo(observationLayer);
  });
}
function coarse(point) {
  return { lat: Math.round(point.lat * 1000) / 1000, lng: Math.round(point.lng * 1000) / 1000 };
}
function setPoint(point) {
  selectedPoint = point ? coarse(point) : null;
  const label = document.getElementById("chosen-location");
  label.textContent = selectedPoint
    ? "Coarse point selected (~100 m precision): " + selectedPoint.lat + ", " + selectedPoint.lng
    : "No location selected (that's fine).";
  if (temporaryPin) { temporaryPin.remove(); temporaryPin = null; }
  if (selectedPoint && map && window.L) {
    temporaryPin = L.marker([selectedPoint.lat, selectedPoint.lng]).addTo(map)
      .bindPopup("Local draft position (not public)").openPopup();
  }
}
if (window.L) {
  map = L.map("map", { scrollWheelZoom: false }).setView(CENTER, 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
  }).addTo(map);
  L.circleMarker(CENTER, { radius: 5, color: "#176749", fillOpacity: 0 })
    .bindPopup("Approximate Sibley Park focus; not a surveyed boundary")
    .addTo(map);
  map.on("click", evt => {
    // A generous vicinity filter, NOT a legal/surveyed park polygon
    if (Math.abs(evt.latlng.lat - CENTER[0]) > .012 || Math.abs(evt.latlng.lng - CENTER[1]) > .017) {
      window.alert("Please choose a location near Sibley Park. This is not a surveyed boundary check.");
      return;
    }
    setPoint(evt.latlng);
  });
} else {
  document.getElementById("map").textContent = "Map tiles unavailable. You can still save a zone-only field trace and export it.";
}
document.getElementById("clear-point").addEventListener("click", () => setPoint(null));
form.addEventListener("submit", event => {
  event.preventDefault();
  const kind = document.getElementById("kind").value;
  const approved = document.getElementById("approved").checked;
  if (kind === "cleanup_report" && !approved) {
    window.alert("Do not report an on-site cleanup action without confirming authorization and safety. You may record an observation instead.");
    return;
  }
  const note = document.getElementById("note").value.trim();
  if (!note) return;
  const trace = {
    schema: "gro/sibley-local-proposal/v0.1",
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + String(Math.random()),
    locality: LOCALITY,
    kind,
    zone: document.getElementById("zone").value,
    material: document.getElementById("material").value,
    note,
    point: selectedPoint,
    permission_affirmed: kind === "cleanup_report" ? approved : null,
    time: new Date().toISOString(),
    disposition: "local_hold",
    evidence_state: "self_report_unverified",
    witness: null,
    deed: null,
    monetary_claim: null
  };
  traces = [...traces, trace].slice(-500);
  persist();
  form.reset();
  setPoint(null);
  draw();
});
document.getElementById("export").addEventListener("click", () => {
  const bundle = {
    schema: "gro/sibley-local-export/v0.1", locality: LOCALITY,
    exported_at: new Date().toISOString(),
    warning: "Self-reports only; no witness, authorization, shared publication or money claim",
    records: traces
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "sibley-gro-local-proposals.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.getElementById("forget").addEventListener("click", () => {
  if (!confirm("Delete all Sibley local traces from this browser? Export them first if you need them.")) return;
  traces = [];
  try { localStorage.removeItem(KEY); } catch {}
  draw();
});
draw();
