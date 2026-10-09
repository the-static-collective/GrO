# GrO GLEAN-001 — Remainder Quest

A phone-native **encounter** for steward-declared surplus. This is not a collection action.

The GrO side consumes an exact, unverified `static-os.glean-offer/v0`
record from [Static OS GLEAN-001](https://github.com/the-static-collective/static-os/pull/85).
The user chooses a local JSON offer on `apps/field-scout/glean.html`.
A sample orchard offer is available for testing.

The module validates the shape, quantity, source type and purpose;
creates a SHA-256 anchored actor-local HOLD; and can cold replay this
against the identical source input. The GrO `resolveField` projection
offers notice, hold and ignore. It never adds a collection action,
changes public traces or grants inventory or robotic authority.

**Separate legal and physical gates:** consent of the actual source steward,
scope of access and removal, recipient, duration, handling and independent
acceptance. These are outside GrO and are never inferred from a hash.

Local tests: `node --test test/glean-001.test.js`, `npm test`.

When reviewed and deployed through the connected GrO project,
`/glean.html` becomes the phone route. An unmerged PR is not deployed.
