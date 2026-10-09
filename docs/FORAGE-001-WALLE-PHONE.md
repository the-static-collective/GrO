# GrO FORAGE-001 — WALL-E phone encounters

**Status:** runnable first phone-native GrO field interface, in its own
experimental branch. It is a static, installable-style web app and does not
claim native Android binary packaging, pre-enabled GitHub Pages or an actual
live hosted address.

This binds [Static OS FORAGE-002](https://github.com/the-static-collective/static-os/pull/83)
to [GrO's Genesis loop](../README.md):

```text
NOTICE     — photo a candidate item from a lawful vantage
ADDRESS    — choose a locality reference (no automatic GPS)
ENCOUNTER  — source-verified lead + unchanged-photo SHA-256
RECEIVE    — receive a possibility *to investigate*, not property
HOLD       — unresolved actor-local, no public trace
ACT        — only future independent permission/inspection organs
RECEIPT    — current unsigned local HOLD digest; NOT signed legal proof
CONSEQUENCE— none automatically; no pickup, stock, credits or robot motion
```

The photograph, even one captured in the app, does not establish item
ownership, land permission, species safety, image authenticity or physical
custody. A discarded-looking object is not automatically legally abandoned.

## What is actually built

- `apps/field-scout/index.html`, `style.css`, `app.mjs`: responsive phone
  camera/file-picker interface. No automatic camera activation. Browser page
  does not request GPS, scan remote sites, upload the user photo or call GHoT.
- `apps/field-scout/scout-core.mjs`: exact copied FORAGE-002 lead/photo
  compiler from Static OS. The source Git blob is pinned in GrO native tests to
  `363c7127cb0405e32a86a58d79f6365151a1ed1d` (original
  `static-os:forage/mobile/scout-core.mjs`, experiment FORAGE-002). Updates
  to this contract need deliberate revalidation.
- `apps/field-scout/gro-hold.mjs`: independently rehash original local
  JPEG/PNG bytes and compare to the exact photo-evidence record, validate the
  original FORAGE-001 lead, bind actor+place+world to an unsigned local
  `gro.local-held-forage-encounter.v0` record. Cold replay regenerates it and
  rejects changed evidence.
- `apps/field-scout/stable.mjs`: exact browser module mirror of the GrO
  `src/stable.js` serializer; tests prove equality rather than allowing
  copies to silently drift. The GrO encounter digest is *not* an authenticated
  camera signature or a reLATTE receipt.
- `src/field-forage.js`: the explicit GrO field adapter; takes the original
  bytes and locally held encounter; calls native `resolveField`, adds an
  `encounter` affordance with dispositions `notice|hold|ignore`, **not**
  an `action` affordance. GrO's `act` properly refuses "pick up" attempts.
  Public traces are not changed.
- `manifest.webmanifest`, `sw.js`: small standalone mobile app shell with
  offline cached **static source files only**. Does not cache original media
  files, exported JSON, personal locations or private manifests. No photo
  storage outside the user's local device and their chosen downloaded files.
- `test/forage-001.test.js`: independent forgery, locality mismatch,
  idempotent cold-replay and robot-authority denial tests.
- `.github/workflows/field-scout-pages.yml`: guarded Pages configuration
  that publishes **only `apps/field-scout`** after checks succeed on
  reviewed `main`. GitHub repository Pages must support the GitHub Actions
  build source. The existence of a deployment workflow is **not** proof that
  hosting has been enabled or deployed.

## Open on a phone

**At present the implementation lives in GitHub, not a confirmed HTTPS host.**
To run the interface on a phone, use an HTTPS static host or a Pages
deployment of the `apps/field-scout` subtree.

With GitHub Pages (when enabled in repository settings for GitHub Actions):
1. Merge the reviewed implementation into GrO `main` (or explicitly
   dispatch the Pages workflow after merging).
2. Confirm the `GrO phone Field Scout` deployment workflow completed.
3. Open the exact `page_url` reported by that run, **not** an imagined
   pre-existing URL.
4. On compatible mobile browsers use Add to Home Screen / Install to make
   it a standalone field interface. Its first load requires network;
   later static code can run from the service-worker cache.
5. Choose an original JPEG/PNG (max 16 MiB) and complete the manual
   observations. The app downloads **three files**: FORAGE-001 lead,
   photo-evidence, and GrO local HOLD. Keep the original photo unchanged.
   The image is not saved by the app or hosted server.

For a desktop test of the web app in a secure local context:
```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory apps/field-scout
# Open http://localhost:8765 on that same computer.
```

For a phone on a different LAN machine, **localhost is not the computer's
address** and plain HTTP LAN origins generally cannot access SubtleCrypto.
Use HTTPS with valid origin security; don't bypass those protections.

## Next separate physical crossings

1. **True visual classification donor:** connect an opt-in, attributable
   GHoT perception organ. Current three suggested uses are fixed menu labels
   selected by human category, not machine recognition.
2. **FORAGE-001 authority review:** owner/land manager must actually provide
   site-, time-, quantity- and purpose-scoped permission to enter and remove.
   A software claim about a person's permission is not proof.
3. **reLATTE physical handoff:** independent transport/recipient-local
   signatures with no authority carried by a photo.
4. **Robot Garden:** safety/condition verification of lawfully acquired
   material; still no automatic motion, cutting, battery reuse or stock credit.
5. **Jubilee:** local accepting owner can choose how a verified part has value;
   nobody gains points simply by photographing someone else's property.

### Pinned laws

PHOTO != OWNERSHIP; NOTICE != TAKE; RECEIVING A FILE != RECEIVING A PART;
HOLD != ACCEPTANCE; FIELD ENCOUNTER != ACTUATION;
SUGGESTION != GHoT CLASSIFICATION; HASH != VERIFIED SIGNATURE;
UNVERIFIED RIGHTS != LEGAL COLLECTION; RESCUE != SAFE ROBOT PART.

No robotics are commanded by this experiment. No off-device source photo is
published, and the test suite uses only synthetic image bytes.
