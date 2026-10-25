// Account-free field relay adapter. Explicit SEND; local field drafts stay local by default.
const LOCAL_KEY = "gro-sibley-local-field-v0.1";
const shell = document.createElement("section");
shell.className = "panel";
shell.innerHTML = `
  <div class="tag">GrO relay / field network</div>
  <h2>Shared stewardship board</h2>
  <p id="relay-health" role="status">Checking for a connected relay…</p>
  <p class="muted">Only steward-reviewed summaries enter this public board. All example quests remain unaffiliated proposals. No GPS tracking, public worker locations, automatic Deeds or Penny rewards.</p>
  <div class="row"><button type="button" class="secondary" id="relay-refresh">Refresh board</button></div>
  <ul id="relay-board" aria-live="polite"></ul>
  <details>
    <summary><strong>Submit a local proposal to a shared relay</strong></summary>
    <p class="muted">Requires a field invitation code. Sending is optional and separate from saving locally. The recipient steward can read your note and coarse location, if supplied. Do not include personal information. No automatic public publishing.</p>
    <label for="relay-draft">Local draft</label><select id="relay-draft"></select>
    <button class="secondary" type="button" id="relay-load">Reload local drafts</button>
    <label for="relay-code">Field invitation code (not saved)</label>
    <input type="password" id="relay-code" autocomplete="off" placeholder="Invitation code"/>
    <button type="button" id="relay-send">Explicitly send for steward review</button>
    <p id="relay-result" role="status" class="muted"></p>
  </details>
  <p class="muted"><a href="./steward.html">Steward / independent witness review</a> (separate role codes required)</p>
`;
const main = document.querySelector("main");
main.insertBefore(shell, main.firstElementChild?.nextSibling ?? null);
const el = name => document.getElementById(name);
let relayOnline = false;
function drafts() {
  let rows = [];
  try { const x = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); if (Array.isArray(x)) rows = x; } catch {}
  const picker = el("relay-draft");
  picker.replaceChildren();
  for (const row of rows.slice().reverse()) {
    if (!row || !row.id) continue;
    const opt = document.createElement("option");
    opt.value = row.id;
    opt.textContent = row.kind + " · " + row.zone + " · " + (row.note || "").slice(0, 50);
    picker.append(opt);
  }
  if (!picker.childElementCount) picker.append(new Option("Save a local field trace first", ""));
  return rows;
}
async function board() {
  try {
    const response = await fetch("/api/board", { cache: "no-store" });
    if (!response.ok) throw Error("Relay unavailable");
    const data = await response.json();
    if (data.schema !== "gro/sibley-public-board/v0.2") throw Error("Wrong relay schema");
    const ul = el("relay-board"); ul.replaceChildren();
    if (!data.items.length) {
      const li = document.createElement("li");
      li.textContent = "No reviewed reports published yet.";
      ul.append(li);
    }
    for (const r of data.items.slice(-40).reverse()) {
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = r.zone + " · " + r.kind.replaceAll("_", " ");
      const desc = document.createElement("div");
      desc.textContent = r.summary;
      const small = document.createElement("small");
      small.textContent = r.witness_attestation ?
        "Separate human-role attestation · candidate only, NOT a Full Measure Deed" :
        "Steward-reviewed summary · not independently witnessed work";
      li.append(strong, desc, small); ul.append(li);
    }
    return true;
  } catch {
    el("relay-board").replaceChildren();
    return false;
  }
}
async function health() {
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    const d = await r.json();
    relayOnline = r.ok && d.locality === "gro:locality:sibley-park-mankato-mn";
  } catch { relayOnline = false; }
  el("relay-health").textContent = relayOnline ?
    "CONNECTED · experimental shared pilot, not an official cleanup service" :
    "OFFLINE · this copy is local-only; field traces still save on this device.";
  if (relayOnline) {
    await board();
    if ("EventSource" in window) {
      const stream = new EventSource("/api/stream");
      stream.addEventListener("refresh", () => void board());
      stream.onerror = () => { el("relay-health").textContent = "Relay stream interrupted; use Refresh board."; };
    }
  }
}
el("relay-load").addEventListener("click", drafts);
el("relay-refresh").addEventListener("click", () => relayOnline ? board() : health());
el("relay-send").addEventListener("click", async () => {
  if (!relayOnline) { el("relay-result").textContent = "No shared relay here."; return; }
  const record = drafts().find(r => r.id === el("relay-draft").value);
  const code = el("relay-code").value;
  if (!record || !code) { el("relay-result").textContent = "Choose a draft and supply the invitation code."; return; }
  if (!confirm("Share this local report and optional coarse map point privately with the relay steward for review? It will not be publicly posted automatically.")) return;
  const payload = {
    kind: record.kind, zone: record.zone, material: record.material, note: record.note,
    point: record.point, permission_affirmed: record.permission_affirmed,
    source_local_id: record.id, consent_to_review: true
  };
  try {
    const r = await fetch("/api/reports", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Sibley-Code": code },
      body: JSON.stringify(payload)
    });
    const answer = await r.json();
    el("relay-result").textContent = r.ok ?
      "Accepted for private steward review. Receipt: " + answer.id + ". Not a Deed or published report." :
      "Not accepted: " + answer.error;
  } catch { el("relay-result").textContent = "Relay transmission failed; local draft remains."; }
  el("relay-code").value = "";
});
drafts(); void health();
