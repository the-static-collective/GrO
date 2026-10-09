# POSTAL-ENCOUNTER-001 — GrO Carrier's Local HOLD

GrO receives a **minimized, untrusted descriptor** of a completed *synthetic* GHoT POSTAL-CORPS-003 two-phone experiment, never the original fieldkit with signed event history, private addresses, photos or private keys.

`src/postal-encounter.js` offers four optional local dispositions: `notice`, `hold`, `refuse`, `leave-open`. A local actor at `place:local-pocket` may inspect the descriptor without creating any public GrO trace or adding a postal action. A signature or public route history fingerprint is not a credential to deliver a physical parcel.

The source **does not cryptographically validate the GHoT fieldkit**; that remains the independent webZ preflight and GHoT station verifier. GrO explicitly labels its projection `UNVERIFIED_EXTERNAL_IMPORT`. The webZ Postal Porch may invoke this source code as a **byte-for-byte pinned donor** after independently replaying the fictional route's P-256 signatures.

No recipient address, full parcel, authoritative GrO occurrence receipt, Full Measure Deed, PENNY unit, payment, transport permission, device pickup or public world event is created.

Run: `npm test`. Consumer: webZ `/postal/` (proposed in a separate draft PR). Canonical station: GHoT POSTAL-CORPS-003 PR #124.

**Laws:** ENCOUNTER != CARRIAGE. HOLD != AUTHORIZATION. SIGNATURE != PHYSICAL CUSTODY. LOCAL CHOICE != PUBLIC TRACE. DEED != PENNY.
