/** Shared, single-process Sibley GrO pilot. No official park/event authority. */
import http from "node:http";
import { readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALITY, sameCode, checkCodes, makeReport, reviewReport,
  witnessReport, publicBoard, openStore, makeOpportunity, publicOpportunities } from "./relay-core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const staticFiles = {
  "/": ["index.html", "text/html"], "/index.html": ["index.html", "text/html"],
  "/app.js": ["app.js", "text/javascript"],
  "/relay-client.js": ["relay-client.js", "text/javascript"],
  "/steward.html": ["steward.html", "text/html"],
  "/steward.js": ["steward.js", "text/javascript"],
  "/locality.json": ["locality.json", "application/json"],
  "/README.md": ["README.md", "text/plain"],
  "/RUNBOOK-002.md": ["RUNBOOK-002.md", "text/plain"]
};
function reply(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const item of req) {
    size += item.length;
    if (size > 4096) { const error = Error("Body too large"); error.status = 413; throw error; }
    chunks.push(item);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { const error = Error("Invalid JSON"); error.status = 400; throw error; }
}
function isSameOrigin(req) {
  if (!req.headers.origin) return true;
  try { return new URL(req.headers.origin).host === req.headers.host; }
  catch { return false; }
}
export function createRelay(config) {
  checkCodes(config);
  const store = openStore(resolve(config.dataFile || ".local-sibley-state/relay.json"));
  const subscribers = new Set(), rate = new Map();
  function publishRefresh() {
    for (const res of subscribers) {
      try { res.write("event: refresh\ndata: {}\n\n"); }
      catch { subscribers.delete(res); }
    }
  }
  function authorized(req, code) { return sameCode(req.headers["x-sibley-code"], code); }
  function limit(req) {
    const key = req.socket.remoteAddress || "unknown", now = Date.now();
    const recent = (rate.get(key) || []).filter(t => now - t < 600000);
    if (recent.length >= 12) return false;
    recent.push(now); rate.set(key, recent);
    return true;
  }
  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    const method = req.method || "GET";
    if (method === "GET" && staticFiles[pathname]) {
      const [name, type] = staticFiles[pathname];
      try {
        res.writeHead(200, { "Content-Type": type + "; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": "default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https://*.tile.openstreetmap.org https://unpkg.com; connect-src 'self'" });
        res.end(readFileSync(join(here, name)));
      } catch { reply(res, 404, { error: "Missing static asset" }); }
      return;
    }
    if (method === "GET" && pathname === "/api/health") {
      return reply(res, 200, { locality: LOCALITY, mode: "experimental opt-in live pilot",
        official_partner_approval: false, money_backing: false, full_measure_deeds_issued: 0 });
    }
    if (method === "GET" && pathname === "/api/board") {
      return reply(res, 200, publicBoard(store.records));
    }
    if (method === "GET" && pathname === "/api/opportunities") {
      return reply(res, 200, publicOpportunities(store.opportunities));
    }
    if (method === "GET" && pathname === "/api/stream") {
      res.writeHead(200, { "Content-Type": "text/event-stream",
        "Cache-Control": "no-store", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
      res.write("event: refresh\ndata: {}\n\n"); subscribers.add(res);
      const heartbeat = setInterval(() => {
        try { res.write(": heartbeat\n\n"); } catch {}
      }, 25000);
      req.on("close", () => { clearInterval(heartbeat); subscribers.delete(res); });
      return;
    }
    if (method === "GET" && pathname === "/api/steward/reports") {
      if (!authorized(req, config.stewardCode)) return reply(res, 403, { error: "Steward code required" });
      return reply(res, 200, { schema: "gro/sibley-steward-review/v0.2",
        nonpublic: true, records: store.records });
    }
    if (method !== "POST") return reply(res, 404, { error: "Unknown route" });
    if (!isSameOrigin(req)) return reply(res, 403, { error: "Cross-origin writes denied" });
    try {
      if (pathname === "/api/reports") {
        if (!authorized(req, config.inviteCode)) return reply(res, 403, { error: "Invitation code required" });
        if (!limit(req)) return reply(res, 429, { error: "Rate limited" });
        if (store.records.length >= 3000) return reply(res, 503, { error: "Pilot intake at capacity" });
        const record = makeReport(await readBody(req), store.records);
        store.records.push(record); store.save();
        return reply(res, 202, { id: record.id, accepted_for_review: true,
          public: false, deed: false, monetary_claim: false });
      }
      if (pathname === "/api/steward/review") {
        if (!authorized(req, config.stewardCode)) return reply(res, 403, { error: "Steward code required" });
        const data = await readBody(req), record = store.records.find(r => r.id === data?.id);
        const result = reviewReport(record, data);
        store.save(); publishRefresh();
        return reply(res, 200, result);
      }
      if (pathname === "/api/steward/opportunity") {
        if (!authorized(req, config.stewardCode)) return reply(res, 403, { error: "Steward code required" });
        if (store.opportunities.length >= 600) return reply(res, 503, { error: "Pilot opportunity capacity reached" });
        const data = await readBody(req);
        const source = store.records.find(r => r.id === data?.source_report_id);
        const item = makeOpportunity(source, data);
        store.opportunities.push(item); store.save(); publishRefresh();
        return reply(res, 201, { id: item.id, state: item.state,
          official_approval: false, deed: false, monetary_claim: false });
      }
      if (pathname === "/api/steward/opportunity-close") {
        if (!authorized(req, config.stewardCode)) return reply(res, 403, { error: "Steward code required" });
        const data = await readBody(req);
        const item = store.opportunities.find(o => o.id === data?.id);
        if (!item) return reply(res, 400, { error: "Invalid opportunity ID" });
        item.state = "closed_by_steward"; item.closed_at = new Date().toISOString();
        store.save(); publishRefresh();
        return reply(res, 200, { closed: true, full_measure_deed_issued: false });
      }
      if (pathname === "/api/steward/witness") {
        if (!authorized(req, config.witnessCode)) return reply(res, 403, { error: "Separate witness code required" });
        const data = await readBody(req), record = store.records.find(r => r.id === data?.id);
        const result = witnessReport(record, data);
        store.save(); publishRefresh();
        return reply(res, 200, { ...result,
          warning: "Passcode attestation is not verified identity or official Full Measure admission" });
      }
      return reply(res, 404, { error: "Unknown route" });
    } catch (error) {
      if (error.status === 409 || error.status === 413) return reply(res, error.status, { error: error.message });
      if (/required|Invalid|Unknown|unavailable|too long|Consent|Authorization|Explanatory|Separate|Independent|Local report|opportunity|Reviewed source/.test(error.message)) {
        return reply(res, 400, { error: error.message });
      }
      console.error("[sibley-relay]", error.message);
      return reply(res, 500, { error: "Write failed; no receipt issued" });
    }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createRelay({
    inviteCode: process.env.SIBLEY_INVITE_CODE,
    stewardCode: process.env.SIBLEY_STEWARD_CODE,
    witnessCode: process.env.SIBLEY_WITNESS_CODE,
    dataFile: process.env.SIBLEY_DATA_FILE
  });
  const host = process.env.HOST || "127.0.0.1", port = Number(process.env.PORT || 8787);
  server.listen(port, host, () =>
    console.log("Sibley experimental relay: http://" + host + ":" + port));
}
