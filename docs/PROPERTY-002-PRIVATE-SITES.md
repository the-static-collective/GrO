# PROPERTY-002 — The Private Steward Porch

**State:** runnable, two-candidate private intake and review-gate experiment.
**Base:** GrO `LAND-CROSSING-001 — The Plot Thickens`, draft PR #20.
**Important:** No real candidate sites, names, addresses, documents, parcel identifiers,
coordinates, ownership records, or actual permission grants are committed to GitHub.
No real property, resident, owner, or public record has been searched or verified.

## Two distinct asset categories: a vehicle and a land site

This preparation path now accepts a generic `asset_kind` of `vehicle`,
`land`, or `unclassified`. A real vehicle title, insurance policy,
parking arrangement or land deed is **never** copied into GitHub.

**Vehicle route:** a vehicle may be parked, stored or driven/towed under
very different sets of permissions. `vehicle_title_record`,
`vehicle_possession`, `vehicle_registration`,
`vehicle_insurance_scope`, `vehicle_transport_plan`,
`vehicle_condition`, and `parking_permission` are separate evidence
questions. A motor-vehicle title can indicate a recorded owner and
vehicle description; it does not itself verify that the vehicle is
currently insured for a particular RV use, operable, registered, road-legal,
safe to occupy, or lawfully parked. The `vehicle-relocation` action is
only a *review category*, not a permit to tow or drive anything.

**Land route:** `land_title_chain`, `land_access_basis`, and
`land_use_constraints` are separate. A deed that has not been found
is simply **not yet located**, not proof that legal title exists or
does not exist. A county assessor's parcel record or online tax map
is a starting reference, not an automatic deed, consent or easement.
Desktop-only deed research may be planned without entering a property.

Both assets can eventually be parts of a proposed shared-resource system,
but a vehicle's ownership/possession does **not** grant any right to
park or live on land, and land control does **not** establish title
to a vehicle.

The local intake generator still starts with two deliberately
`unclassified` candidates. To classify them **locally**, obtain the
opaque candidate IDs from `init` (never copy identifying private
fields into command arguments), then run:

```bash
node scripts/property-002-local.mjs classify \
  /absolute/private/location/gro-sites \
  property-candidate:YOUR_FIRST_ID \
  vehicle vehicle-inspection

node scripts/property-002-local.mjs classify \
  /absolute/private/location/gro-sites \
  property-candidate:YOUR_SECOND_ID \
  land land-title-research

node scripts/property-002-local.mjs audit \
  /absolute/private/location/gro-sites
```

This saves types and local checklist needs in the private intake.
No network call, external ownership verification, automatic document
upload, or physical permission is triggered.

## The smallest field preparation

Use a local directory **outside the Git checkout**. The CLI refuses relative
or in-repository paths for its private intake:

```bash
node scripts/property-002-local.mjs init /absolute/private/location/gro-sites
node scripts/property-002-local.mjs audit /absolute/private/location/gro-sites
```

`init` creates a private root (mode 0700) with:

- `intake.private.json` (mode 0600), containing **Site A** and **Site B** blank records with independent opaque IDs;
- `hmac.secret` (mode 0600), a unique 32-byte local secret used to commit to evidence references *without publishing guessable address/document hashes*;
- `signer.secret.pem` (mode 0600), a local Ed25519 signing key, never uploaded;
- `signer.public.key` (mode 0600), the corresponding public key.

**Do not put your real private information in repo files, GitHub Issues, Actions
variables, workflow artifacts, or PR descriptions.** Edit your local intake
file offline. If multiple sites share the same location or use overlapping
premises, each candidate still receives an independent ID; no rights are
inferred from a shared address.

The CLI never accesses the internet, geocodes, sends documents, executes
property-related physical work, creates leases, registers titles, or dispatches
GHoT tasks.

## Minimal private intake

Each candidate contains these editable private fields:

| Field | Purpose |
|---|---|
| `private_label` | Your own short identification, not shared |
| `private_location` | Optional location, kept off-repo |
| `private_contact` | Optional contact or steward note, kept off-repo |
| `private_notes` | Anything you need to preserve locally |
| `activity` | Desired preliminary action, e.g., desk-study, visit, cleanup, fabrication |
| `evidence` | Independent factual/evidentiary review topics below |

The core evidence categories are **authority**, **steward consent**,
**occupant access**, **activity scope**, **local rules**, **site safety**,
**environmental review**, and **permits and engineering**. Additional
vehicle- and land-specific categories are listed above. The particular
requirements depend on the candidate's private asset type and activity.

Each category records `state` (`missing`, `claimed`, or `reviewed`);
a *private* local evidence reference; review timestamp; optional expiry;
and optional revocation. Self-claimed statements are never promoted to reviewed.
Expiry and revocation return the packet to HOLD. Future review dates also do
not create a presently valid review.

**"Reviewed" is only a local bookkeeping label.** The code does *not*
authenticate the actual identity of a property owner, renter, steward,
occupant, attorney, contractor or government agency. It does not establish
legal title, a right to enter, a safe worksite or compliance. A fully populated
packet is only `READY_FOR_INDEPENDENT_HUMAN_DECISION`.

For a desk-only proposal the result is always `DESK_STUDY_ONLY`.
For visit/noninvasive survey requests, the core authority, consent,
occupant, scope, rule and safety topics are required before the review
packet is complete. More intrusive work proposes adding environmental,
engineering and permitting review. These checks are **not a substitute**
for activity-specific permits or laws.

All assessment results explicitly contain:

```text
external_identity_certified = false
legal_permission_proven_by_software = false
entry_authorized = false
physical_work_authorized = false
automated_dispatch_allowed = false
```

Thus **even a "ready" packet cannot activate GrO phone geofencing,
GHoT scheduling, robotics, land entry, fabrication or construction**.

## The optional redacted export

By default, no publication file exists. If you intentionally want a
minimal report with pseudonymous candidate IDs, per-topic counts and
readiness statuses, run:

```bash
node scripts/property-002-local.mjs export-redacted \
  /absolute/private/location/gro-sites \
  /absolute/public/location/property-002-redacted.json \
  --explicit-redacted-export
```

Without `--explicit-redacted-export` the command refuses to run.
It never uploads the result anywhere. Review the output before any
sharing. Even when addresses are removed, activity categories and
evidence-status counts can reveal sensitive contextual information.

The public report contains **no private label, physical address, precise
location, contact information, document name, reference, narrative, or
private key**. It includes:

- independently random candidate IDs, activity category and readiness
  status;
- evidence counts and blocked-topic counts;
- HMAC-SHA256 commitments for nonmissing evidence records, using the local
  secret key; the secret itself is never exported;
- an Ed25519 digital signature made by the local signer;
- permanent explicit `false` assertions for access, ownership,
  authority attestation, publication permission, admission or physical work.

To cold-verify that report, the public key's fingerprint must have been
obtained *independently*, not merely copied from the same report:

```bash
node scripts/property-002-local.mjs verify-redacted \
  /absolute/public/location/property-002-redacted.json \
  sha256:OUT_OF_BAND_SIGNER_FINGERPRINT
```

The signature demonstrates attribution to a key, not ownership of land.
HMAC commitment verification also requires an authorized holder of the
**private** HMAC key and original record; the public verifier checks only
the commitment shape and report signature.

## GHoT bridge

For a purely desktop-only candidate:

```bash
node scripts/property-002-local.mjs desk-task \
  /absolute/private/location/gro-sites \
  property-candidate:YOUR_OPAQUE_ID
```

This prints an **unexecuted candidate** compatible with GHoT's existing
`schemas/task.v0.json` format:

```text
capability = gro.property.private-review.v0
network = false
property_entry = false
physical_actuation = false
execution_authorized = false
installed_capability_confirmed = false
```

No such executor is installed or selected by this tool.
No GHoT job, reLATTE R3 admission or phone encounter is triggered.

## Safety and honest limitations

- There is **no external title, address, parcel, legal, or credential
  verification**. Those must be done for each actual site using applicable
  county/city records, the verified person or entity holding authority,
  and the relevant local rules. An online listing or parcel map alone
  is not proof of a right to enter or use land.
- Some sites may have **multiple relevant permission holders**:
  owner/landlord, tenant, occupant, employer, trustee, local agency,
  utility, or another party. A single person's signature may not be
  sufficient.
- Public access does not automatically permit machinery, excavation,
  vegetation removal, camping, construction, or commercial use.
- Do not collect sensitive personal details or photos of occupants
  without permission. Protect exact private-home coordinates and keys.
- File modes and an off-repository root help prevent accidental uploads;
  they are **not encrypted-at-rest storage**, security against a compromised
  device or a multiuser access-control system.
- `PROPERTY-002` is a **readiness packet only**, not real-world authorization.
  Physical work will need an entirely new explicitly verified authority
  path in a future release. No feature in this PR creates that path.

## Verification

```bash
node --test test/property-readiness.test.js
npm test
```

GitHub Actions `PROPERTY-002 Private Site Readiness` initializes
**fictional** private records in the runner's temporary directory and
attempts a prohibited unapproved export. It verifies that export is denied,
then explicitly exports and cold verifies a signed synthetic redacted report.
It checks that planted *fake* address/contact/notes/document strings never
appear in the result and uploads **only the synthetic redacted artifact**.

Real user locations and document contents are never used by this workflow.

## Next physical seam — PROPERTY-003

The two private candidates can then be considered individually:

1. Establish the actual steward(s) and legal scope of authority outside
   automated software, accounting for occupants and other rightsholders.
2. Preserve only permission proofs appropriate for the limited intended
   action, with expiry and a direct revocation path.
3. Separately verify any inspection, safety, engineering, environmental,
   zoning and building requirements.
4. If and only if a legitimate owner/steward explicitly agrees, conduct
   a consensual noninvasive visit or observation; do not infer it from
   a digital HOLD/RECEIVE/ADMIT.
5. Link a real GrO phone observation to the candidate ID while preserving
   privacy, not claiming the observation itself proves title.
6. Keep GHoT suggestions separate from owner/local legal permissions,
   equipment authorization and actual work.

**PROPOSAL != PERMISSION. REVIEW COMPLETE != ENTRY. PHYSICAL PLACE != OPEN WORLD.**
