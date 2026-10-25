import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRelay } from "../apps/sibley-stewardship/relay-server.mjs";

test("Sibley report → steward → independent witness → public-safe board, persisted", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gro-sibley-"));
  const config = {
    dataFile: join(dir, "relay-state.json"),
    inviteCode: "pilot-field-invite-2026",
    stewardCode: "pilot-steward-separate-2026",
    witnessCode: "pilot-independent-witness-2026"
  };
  let server = createRelay(config);
  let base;
  const start = async () => {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    base = "http://127.0.0.1:" + server.address().port;
  };
  const close = () => new Promise(resolve => server.close(resolve));
  const req = async (path, method = "GET", code = "", body = null, extra = {}) =>
    fetch(base + path, {
      method,
      headers: { ...(code ? { "X-Sibley-Code": code } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}), ...extra },
      body: body ? JSON.stringify(body) : undefined
    });
  try {
    await start();
    const healthy = await (await req("/api/health")).json();
    assert.equal(healthy.official_partner_approval, false);
    assert.equal((await req("/api/steward/reports")).status, 403);
    assert.equal((await req("/api/reports", "POST", "", {})).status, 403);
    assert.equal((await req("/api/reports", "POST", config.inviteCode, {}, { Origin: "https://other.example" })).status, 403);

    const draft = { source_local_id: "local-sibley-001", kind: "cleanup_report",
      zone: "river", material: "tinsel", note: "Private claim with sensitive words THAT MUST NEVER AUTO-PUBLISH",
      point: { lat: 44.1611333, lng: -94.03334 }, consent_to_review: true };
    assert.equal((await req("/api/reports", "POST", config.inviteCode, draft)).status, 400);
    const result = await req("/api/reports", "POST", config.inviteCode,
      { ...draft, permission_affirmed: true });
    assert.equal(result.status, 202);
    const { id, public: isPublic, deed, monetary_claim } = await result.json();
    assert.equal(isPublic, false); assert.equal(deed, false); assert.equal(monetary_claim, false);
    assert.equal((await req("/api/reports", "POST", config.inviteCode,
      { ...draft, permission_affirmed: true })).status, 409);

    let board = await (await req("/api/board")).json();
    assert.equal(board.items.length, 0);
    const reviewerState = await (await req("/api/steward/reports", "GET", config.stewardCode)).json();
    assert.equal(reviewerState.records.length, 1);
    assert.equal(reviewerState.records[0].point.lat, 44.161);
    assert.equal(reviewerState.records[0].point.lng, -94.033);

    assert.equal((await req("/api/steward/review", "POST", config.inviteCode,
      { id, decision: "publish", summary: "Debris reviewed in riverside zone." })).status, 403);
    assert.equal((await req("/api/steward/review", "POST", config.stewardCode,
      { id, decision: "publish", summary: "short" })).status, 400);
    const review = await req("/api/steward/review", "POST", config.stewardCode,
      { id, decision: "publish", summary: "Reviewed example: decorative debris in riverside zone." });
    assert.equal(review.status, 200);

    board = await (await req("/api/board")).json();
    assert.equal(board.items.length, 1);
    assert.equal(board.items[0].summary, "Reviewed example: decorative debris in riverside zone.");
    assert.equal(board.items[0].deed_candidate_only, false);
    assert.ok(!JSON.stringify(board).includes("THAT MUST NEVER"));
    assert.ok(!JSON.stringify(board).includes("44.161"));

    assert.equal((await req("/api/steward/witness", "POST", config.stewardCode,
      { id, decision: "confirm", note: "Observed work myself" })).status, 403);
    assert.equal((await req("/api/steward/witness", "POST", config.witnessCode,
      { id, decision: "confirm", note: "Observed physical work directly" })).status, 400);
    const witnessed = await req("/api/steward/witness", "POST", config.witnessCode,
      { id, decision: "confirm", note: "Observed approved cleanup directly",
        independent_observation: true, authorized_activity: true });
    assert.equal(witnessed.status, 200);
    assert.equal((await witnessed.json()).full_measure_deed_issued, false);
    board = await (await req("/api/board")).json();
    assert.equal(board.items[0].deed_candidate_only, true);

    assert.equal((await req("/relay-client.js")).status, 200);
    assert.equal((await req("/steward.html")).status, 200);
    assert.equal((await req("/steward.js")).status, 200);
    assert.equal((await req("/.local-sibley-state/relay.json")).status, 404);

    await close(); server = createRelay(config); await start();
    board = await (await req("/api/board")).json();
    assert.equal(board.items[0].id, id);
  } finally {
    if (server.listening) await close();
    rmSync(dir, { force: true, recursive: true });
  }
});

test("relay refuses missing or shared review/witness credentials", () => {
  assert.throws(() => createRelay({ inviteCode: "short", stewardCode: "a", witnessCode: "b" }));
  assert.throws(() => createRelay({
    inviteCode: "long-common-secret-001", stewardCode: "long-common-secret-001",
    witnessCode: "long-separate-secret"
  }));
});
