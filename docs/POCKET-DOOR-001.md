# GrO POCKET-DOOR 001 — Textable World Doors

**Status: experimental code / unmerged draft.** A small, phone-first local doorway prototype. Not a live SMS bot, not GrO app-store packaging, not a public `abundent.org/d/` route, not an authenticated publishing service, not a signed reLATTE crossing.

## Architectural split

- **webZ / Abundent**: future public web entry point and shareable URL routing. The existing Post Office, Seed Lab 002, Peer 003, Wandering Letter 004 and ROOTLINE 005 are separate, staged experiments; do not assume they are merged or live.
- **GrO**: local actor-specific **encounter** with a portable, verifiable authored public *demonstration* door; the phone operator can ignore, hold, enter locally, or deliberately carry it onward.
- **ROOTLINE**: candidate manual encouragement carrier. Full protocol compatibility and cross-repository acceptance are **not** claimed yet.
- **reLATTE**: future separately authorized crossing evidence, ownership and receipts; a SHA-256 demo door is **not** a reLATTE signature or an admission.

GrO's existing laws apply: a door becoming available does not compel crossing; transport does not import jurisdiction; HOLD is local; retrieving an address does not prove world-seed contents; proof ≠ authority.

## Implemented

- `apps/pocket-door/index.html`, `style.css`, `app.mjs`: a stand-alone mobile-sized static browser UI; no external assets, no passive fetches, SMS APIs, contact lists or database. Choose a demo door, four authored entrance modes, an 11-stop depth dial, a local unsent personal reflection, a copied text invite, a JSON carrier and an offline standalone HTML page. The app's Content Security Policy blocks all network connections.
- `apps/pocket-door/pocket-core.mjs`: canonical JSON SHA-256, strict envelope schema `gro.pocket-door.v0`, a small allowlist of three curated **unsigned public artistic demonstration fixtures**, validation of complete source content rather than trusting a supplied hash, and deterministic view projection. Unsupported additional claims, externally forged demo material, arbitrary entered door names or altered permissions fail closed.
- `src/field-pocket-door.js`: binds a **verified** packet to a GrO local field `encounter` affordance. Original traces remain unchanged; `act(...)` refuses an encounter-only action. No signed crossing, public trace, sender identity or physical-world authority is issued.
- `test/pocket-door-001.test.js`: valid/demo/tampered/recomputed digest tests; 3 doors × 4 entrances × 11 depth positions; local field refusal of attempted `act`; script-free, standalone export; no network or subscriber collection in UI.
- `.github/workflows/pocket-door-ci.yml`: guarded PR/push checks; **no deployment job**.

## Demo door content

1. `MOSS-042`: an intentionally imperfect room for things that survived winter, with a broken radio. *Sound* is a written listening scene, not streamed audio.
2. `ROSEMARY-001`: a lived-in kitchen and an enduring relationship. No private testimony or licensed track is included.
3. `LIGHT-KEEP-003`: an encouragement whose recipient owes nothing. *Wander* deliberately offers no quest requirement.

Each demo has `letter`, `sound`, `wander`, and `workbench` authored projections. All are public artistic samples rather than provenance-authenticated external source documents. Projecting them cannot invent missing multimedia.

## How to test locally

```sh
npm test
node --check apps/pocket-door/pocket-core.mjs
node --check apps/pocket-door/app.mjs
node --check src/field-pocket-door.js
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000/apps/pocket-door/`, pick `MOSS-042`, enter. Change entrance and depth; use **Carry door (.json)** to download the envelope. Open a separate browser profile, choose that JSON, independently reverify it. Generate the offline HTML and open it after disconnecting from the network. Change one JSON byte without changing digest; it must reject.

To text a door manually, the app prepares a human-readable invitation containing the *current host's door query link* only when it is served over HTTPS. Paste into a message yourself. No SMS is sent by GrO. A custom short URL or live `abundent.org/d/MOSS-042` remains a separately owned webZ integration.

A simple `file://` opening may be restricted from loading ES modules in some browsers; use a local static server or independently verified HTTPS hosting. No GitHub Pages deployment is enabled by this PR.

## HOLD before a public rollout

- Cross-repository wire agreement with **webZ**: public route `/d/:id`, exact hash/fixture source or signed payload, and local GrO handoff; tests must actually fetch and verify identical accepted bytes from both systems.
- A genuine direct SMS reply world needs explicit phone ownership, documented opt-in, carrier/SMS provider compliance, STOP/HELP, abuse prevention, and evidence of live service availability. This app is **manual share only**.
- Real publisher signatures, key rotation and trust pinning before accepting arbitrary third-party world seeds. No automatic trust of unsigned digest-only payloads.
- Real audio/manga/workbench content should only be shown after independent rights, source and authority verification. No invented/generated audiovisual component is promised by this slice.
- Review on a physical Android phone and across two devices. The PR's unit tests **do not** constitute a witnessed physical-device transfer.
- Any installable PWA or production deployment must be independently authorized and separately verified.

**Law: DOOR ≠ CROSSING; LINK ≠ SEED; VIEW ≠ AUTHORITY; KEEP ≠ OBLIGATION.**
