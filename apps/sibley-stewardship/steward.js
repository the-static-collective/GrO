const el = id => document.getElementById(id);
const status = message => { el("status").textContent = message; };
function element(tag, value, className) {
  const x = document.createElement(tag);
  if (value != null) x.textContent = value;
  if (className) x.className = className;
  return x;
}
async function call(url, method, code, data) {
  const headers = { "X-Sibley-Code": code };
  if (method === "POST") headers["Content-Type"] = "application/json";
  const response = await fetch(url, { method, headers,
    body: method === "POST" ? JSON.stringify(data) : undefined, cache: "no-store" });
  let output = {};
  try { output = await response.json(); } catch {}
  if (!response.ok) throw Error(output.error || "Review request failed");
  return output;
}
function formLabel(container, text, input) {
  const label = element("label", text);
  label.append(input);
  container.append(label);
}
async function load() {
  const key = el("steward-key").value;
  if (!key) { status("Enter steward code."); return; }
  try {
    const data = await call("/api/steward/reports", "GET", key);
    el("queue").replaceChildren();
    status(data.records.length + " held/reviewed reports loaded; none publicly released without a steward action.");
    for (const record of data.records.slice().reverse()) makeCard(record);
    if (!data.records.length) el("queue").append(element("p", "No reports in the shared relay."));
  } catch (err) { el("queue").replaceChildren(); status(err.message); }
}
function makeCard(r) {
  const card = element("article"); el("queue").append(card);
  card.append(element("h2", r.zone + " · " + r.kind.replaceAll("_", " ")));
  card.append(element("small", r.id + " | " + r.created_at + " | " + r.material));
  card.append(element("p", "Private self-report (NOT proven): " + r.note, "claim"));
  if (r.point) card.append(element("p", "Private coarse point: " + r.point.lat + ", " + r.point.lng, "small"));
  card.append(element("p", "Public summary consent: " + (r.public_summary_consent ? "YES" : "NO · private review only"), "small"));
  card.append(element("p", "Steward: " + (r.review?.decision || "pending") +
    " | witness: " + (r.witness?.decision || "none"), "small"));
  const summary = element("textarea");
  summary.placeholder = "Separate public-safe summary only; do not copy names, private details or location pins.";
  summary.value = r.public_summary || "";
  formLabel(card, "Steward-curated summary (required for publish)", summary);
  const note = element("textarea");
  note.placeholder = "Private reasoning or refusal note (optional)";
  formLabel(card, "Private review note", note);
  for (const decision of ["publish", "hold", "refuse"]) {
    if (decision === "publish" && !r.public_summary_consent) continue;
    const button = element("button", "Review: " + decision, decision === "refuse" ? "warn" : "secondary");
    button.type = "button";
    button.addEventListener("click", async () => {
      if (decision === "publish" && !confirm("Publish ONLY the separate curated summary, zone, kind and material to the public relay board?")) return;
      try {
        const response = await call("/api/steward/review", "POST", el("steward-key").value,
          { id: r.id, decision, summary: summary.value, note: note.value });
        status("Review recorded: " + response.status + ". This is not a Full Measure Deed.");
        await load();
      } catch (err) { status(err.message); }
    });
    card.append(button);
  }
  if (r.review?.decision === "publish") {
    card.append(element("h3", "Propose a follow-on GrO quest"));
    const title = document.createElement("input");
    title.placeholder = "10–90 characters, e.g. Record decorative debris by trail";
    formLabel(card, "Quest title", title);
    const desc = element("textarea");
    desc.placeholder = "Describe observation or proposed future work. Physical cleanup still requires official approval.";
    formLabel(card, "Quest description", desc);
    const action = document.createElement("select");
    for (const [value, name] of [
      ["observation_only", "Open observation invitation (no physical cleanup)"],
      ["physical_cleanup", "Proposed cleanup · awaits park/event authorization"]
    ]) { const option = document.createElement("option"); option.value = value; option.textContent = name; action.append(option); }
    formLabel(card, "Action type / permission state", action);
    const propose = element("button", "Publish proposed next quest", "secondary");
    propose.type = "button";
    propose.addEventListener("click", async () => {
      if (!confirm("Publish a clearly unaffiliated GrO opportunity proposal, NOT an official park/event assignment?")) return;
      try {
        const answer = await call("/api/steward/opportunity", "POST", el("steward-key").value, {
          source_report_id: r.id, title: title.value, description: desc.value, action: action.value
        });
        status("Opportunity " + answer.id + " · " + answer.state + " · official approval false.");
      } catch (err) { status(err.message); }
    });
    card.append(propose);
  }
  if (r.kind !== "cleanup_report" || r.review?.decision !== "publish") return;
  card.append(element("h3", "Separate independent human witness"));
  const independent = document.createElement("input"); independent.type = "checkbox";
  formLabel(card, "I directly or reliably independently observed the physical work (not just its self-report)", independent);
  const authorized = document.createElement("input"); authorized.type = "checkbox";
  formLabel(card, "I confirmed that the physical action had required park/event authorization", authorized);
  const witnessNote = element("textarea");
  witnessNote.placeholder = "How did you independently confirm the work? No sensitive names.";
  formLabel(card, "Witness note", witnessNote);
  for (const decision of ["confirm", "hold", "dispute"]) {
    const button = element("button", "Witness: " + decision, decision === "dispute" ? "warn" : "secondary");
    button.type = "button";
    button.addEventListener("click", async () => {
      if (decision === "confirm" && !confirm("You are attesting to independently observed and authorized physical work. This is NOT a Deed or payment. Continue?")) return;
      try {
        const answer = await call("/api/steward/witness", "POST", el("witness-key").value, {
          id: r.id, decision, note: witnessNote.value,
          independent_observation: independent.checked, authorized_activity: authorized.checked
        });
        status("Witness disposition: " + answer.disposition + ". Deed candidate only.");
        await load();
      } catch (err) { status(err.message); }
    });
    card.append(button);
  }
}
el("load").addEventListener("click", load);
