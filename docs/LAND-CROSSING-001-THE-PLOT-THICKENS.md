# LAND-CROSSING-001 — The Plot Thickens

**Status:** Runnable GrO land-site composer with cryptographically signed **simulation-only**
local decisions. No real land rights have been established, and no site work has been carried out.

## Question

Can a real physical site be described as an addressable possibility, without confusing:
a dot on a map, a proposal, consent, ownership, admission, physical action, and a
verified occurrence?

**001 answers the protocol/modeling question using two completely fictional sites.**

```text
        [site address, sketch/source witness]
                       |
                self-described facts
                       |
                signed land proposal
                       |
             portable reLATTE donor draft
                       |
        +--------------+----------------+
        |                               |
    local HOLD                     local simulation grant
        |                               |
    no allowed local action         separate signed witness
                                        |
                                 GrO field projection
                                        |
                             bounded GHoT task candidate
                                        |
                      neighbor independently decides
                                        |
                        simulated cooperation possible

 NO DEED, EASEMENT, ENTRY, NETWORK DISPATCH, PHYSICAL WORK,
 TITLE CERTIFICATION OR TRANSFER OF RIGHTS AT ANY ARROW.
```

## Existing integration points

GrO's prior TENET system already establishes that replaceable roads and
imported affordances preserve source provenance without moving jurisdiction.
001 is an **independent branch off GrO main**. It adds a land-specialized
module, not a new game engine or replacement for existing TENET rules.

- `src/land-crossing.js`: sites, proposals, receipts, local simulation
  registry and dispositions, GHoT work candidate, neighbor composition,
  reLATTE donor draft.
- `test/land-crossing.test.js`: false owner claims, tampered cryptographic
  signatures, expired use window, missing second site's permission, and
  other prohibited promotions.
- `examples/land-crossing-001.js`: simulated orchard and workshop, initially
  blocked by HOLD, then independently granted hypothetical cooperation.
- `scripts/verify-land-crossing-001.mjs`: verifies an independently
  serialized witness with specified out-of-band signer fingerprints.
- `.github/workflows/land-crossing-001.yml`: run, cold verification,
  hostile forged-ownership replay and public witness artifact.

## Site addresses: not cadastral records

`addressSite` accepts a WGS84-looking GeoJSON **Polygon** with exactly
one small ring, a locality ID and a source reference. It produces a
content-derived `gro-site:` ID and records:

```json
{
  "legal_boundary_verified": false,
  "ownership_claimed": false,
  "access_granted": false
}
```

These fields are invariant; validation rejects mutated objects that assert
ownership or access. The coordinates are *illustrative sketches*. 001 does
not query county parcel APIs, title records, zoning maps, utility easements,
tax assessment, zoning codes, owner addresses, or map imagery. It does not
calculate land area, check geodetic validity, discover legal parcel numbers,
or prove adjacency. A polygon can be changed with a different resulting ID;
a map edit is not a transfer of real property.

In real applications the physical-location layer must preserve public
source metadata and accuracy, protect precise private-home or resident
locations, and distinguish legal parcel registries from user sketches.

## Signed source proposals

Anyone may create an Ed25519 signed proposal for a verified site address.
A proposal contains a bounded proposed activity such as gardening,
fabrication, cleanup, survey, solar study, water study or shared resources,
plus attributed but **unverified** observation claims.

The addressed event binds:
1. exact signed content;
2. signer's public key;
3. event ID and signature.

The signature authenticates *which key signed*, not the factual truth of
the observations, the human identity, land rights or property value.

## Local simulated decisions

`registerSimulatedSiteSteward` pins a proposed local signing key to an
addressable site in a local world. It explicitly says:

- `authority_basis: "simulation-only"`;
- `legal_title_verified: false`;
- `permission_to_enter_real_property: false`.

A source cannot turn this registration into real authority by changing
fields. Under that pinned key, the separate local agent may issue a
signed `HOLD`, `REFUSE`, or `SIMULATED_GRANT` with a bounded time window,
scope tied to the specific proposal and site, nontransferability,
zero real-world permissions and a maximum **one** observed simulation
consequence in the local projection.

A `SIMULATED_GRANT` does not mean an owner legally authorized access.
Actual property authorization must eventually be bound to documented,
independently verified evidence of legal authority, the scope of
permission, and required safety/regulatory compliance.

The local projection detects duplicate observation consumption of a
simulation grant, but this is **not** a persistent atomic spent ledger,
concurrent physical scheduling, or revocation service. No real-world
work can be authorized through 001.

## Simulated work and witness

`recordSimulatedConsequence` requires a signed local simulation grant,
current scoped timestamp, and a separate observer key. It writes an
Ed25519-signed *statement about a simulation*, never a physical-work
attestation. Cold validation pins the observer key separately to
avoid treating self-declared witness keys as external authority.

The system never converts a witness into a deed, a legal access permit,
proof of factual work, ownership, assessed value, or an obligation to pay.

## GHoT task bridge

`makeGhotLandSimulationTask` emits a proposed artifact compatible with
the existing GHoT `schemas/task.v0.json` minimal contract:

```json
{
  "kind": "ghot.task",
  "version": "0",
  "capability": "gro.land.simulation-study.v0",
  "requester_node_id": "ghot:fictional-desk-computer",
  "constraints": {
    "requires_installed_declared_capability": true,
    "physical_actuation": false,
    "property_entry": false,
    "network": false
  }
}
```

Only a valid time-scoped simulated grant can create the candidate.
The work task is **not dispatched** to a GHoT node. There is no installed
corresponding `gro.land.simulation-study.v0` executor or scheduler selected.
Even a capable worker would still need an independent owner selection under
GHoT's usual rules. Task submission is not permission to actuate hardware.

## reLATTE bridge

`makeLandCrossingDraft` creates an
`relatte.opaque-organ-spec/v0` donor-facing **proposal** for a
content-addressed GrO land-proposal payload. The crossing requests
`candidate-land-use-proposal` with receiver-local authority and
`entry_authorized:false`, `physical_work_allowed:false`.

This draft is not yet a signed reLATTE CrossingEnvelope v0 or an R3 receipt.
An actual receiver must independently validate the source and issue its
own RECEIVE/HOLD/ADMIT; no land proposal inherits admission.

## Two-site composition

`composeNeighboringSites` requires two distinct sites, independent
local worlds and two independently pinned local signing keys. Both
must separately grant the *shared-resource simulation* and their
allowed time windows must overlap. A HOLD or forged second grant blocks
composition.

The name refers to a proposed cooperation between sites, not
cadastrally certified physical neighbors. The result preserves:

```text
cadastral_adjacency_verified = false
legal_easement_created = false
utility_interconnection_granted = false
owner_rights_transferred = false
```

## Run the experiment

```bash
npm test
node examples/land-crossing-001.js ./work/land-001
```

The example writes `work/land-001/land-crossing-001-witness.json`.
The human-readable output indicates initial consent was blocked,
two independently signed local decisions were later available,
a witness recorded a hypothetical simulation, and a GHoT task
candidate and reLATTE donor draft were prepared.

The cold verifier requires the public orchard steward, workshop steward
and witness fingerprints from a **separate trusted source**:

```bash
node scripts/verify-land-crossing-001.mjs \
  ./work/land-001/land-crossing-001-witness.json \
  sha256:ORCHARD_STEWARD_PUBKEY_FINGERPRINT \
  sha256:WORKSHOP_STEWARD_PUBKEY_FINGERPRINT \
  sha256:WITNESS_PUBKEY_FINGERPRINT
```

The CI demo extracts the pins from its own generated evidence *as a
self-consistency check only*. That proves signatures and crossing
relationships, not outside-world independent identity certification.

The dedicated GitHub workflow runs these checks and deliberately forges
`ownership_claimed:true`, requiring the cold verifier to reject it.

## The real-world frontier: PROPERTY-002

1. Choose **a site whose lawful steward willingly enrolls** (or use
   publicly owned space with the appropriate administering authority).
2. Introduce externally validated permission proofs without publishing
   personal identification or sensitive addresses.
3. Distinguish title, occupancy, leasehold, easement, local ordinance,
   zoning, environmental limitations and task-specific access grants.
4. Add owner revocation, local durable time/nonce checks, contractor
   safety, witness consent and granular privacy controls.
5. Extend GHoT from a *simulation work suggestion* to only tasks whose
   required real-world authorizations have been independently admitted
   by a properly authorized decision-maker.
6. Integrate live parcel maps as observed third-party sources, never as
   legal authority on their own.
7. Compose multiple steward-approved resources into a block/neighborhood
   proposal without converting adjacency into an easement.

## Laws

```text
MAP != DEED
BOUNDARY SKETCH != LEGAL PARCEL
DISCOVERY != ACCESS
PROPOSAL != CONSENT
PINNED KEY != PROVEN LEGAL OWNER
CONSENT FOR ONE SITE != CONSENT FOR ITS NEIGHBOR
SIMULATED GRANT != REAL-WORLD PERMISSION
OBSERVATION != PHYSICAL FACT
TASK CANDIDATE != DISPATCH
COMPUTATION != RIGHT TO ENTER
NEIGHBORHOOD COMPOSITION != UTILITY EASEMENT
```
