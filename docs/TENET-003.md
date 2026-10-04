# TENET 003 — Addressed world-seed

Status: executable cross-repository specimen

## Claim under test

A GrO tenet can cross reLATTE **without embedding its semantic payload in the crossing claims**.

The signed crossing binds a content address.

The destination that locally ADMITs the crossing independently resolves bytes for that address and verifies the bytes before GrO makes them playable.

A destination that REFUSEs the crossing need not fetch the payload at all.

```text
SOURCE TRACE
   ↓
canonical tenet payload bytes
   ↓
sha256:<address>
   ├──────────── content road ────────────┐
   ↓                                      │
signed reLATTE crossing                   │
contains ADDRESS, not payload             │
   ↓                                      │
destination RECEIVE                       │
   ↓                                      │
receiver-local disposition                │
   ├─ REFUSE → no fetch                   │
   └─ ADMIT  → resolve address ←──────────┘
                    ↓
               verify hash
                    ↓
               parse payload
                    ↓
             local GrO translation
                    ↓
               playable trace
```

## Chain of custody

TENET 003 earns a useful two-link proof:

```text
signed crossing → content address → exact payload bytes
```

The crossing signature binds the address because the address is inside the signed opaque-organ crossing.

The SHA-256 address binds the exact bytes.

The destination therefore does not need to trust the transport or the content store to tell it what the payload is.

It verifies the bytes itself.

## Critical separations

```text
ADDRESS != BYTES
DELIVERY != PAYLOAD FETCH
REFUSE != FETCH
ADMIT != TRUST BYTES
HASH MATCH != ADMISSION
VERIFIED BYTES != SOURCE AUTHORITY
CONTENT AVAILABILITY != PLAYABILITY
```

## What moved out of the envelope

TENET 002 embedded the compact tenet body in donor claims.

TENET 003 donor claims contain only carrier facts:

- source trace ID;
- source receipt ID;
- source authority = invitation-only;
- source author control = false;
- payload content address;
- payload media type.

The actual tenet body exists only as separately addressed canonical bytes.

## Receiver behavior

### REFUSE

The receiver can reject the crossing from envelope-level policy alone.

GrO returns:

```text
payloadResolved = false
trace = null
```

The resolver is never called.

### ADMIT

ADMIT authorizes GrO to attempt semantic intake.

It does **not** authorize blind trust.

GrO:

1. requests the bytes by address;
2. hashes the returned bytes;
3. requires an exact address match;
4. requires canonical JSON;
5. checks payload schema;
6. checks source trace / receipt / authority against the signed carrier claim;
7. checks source author control remains false;
8. only then creates a destination-local playable trace.

## Tamper witness

The executable specimen deliberately supplies incorrect bytes for a valid signed address.

Admission still fails with:

```text
PAYLOAD_ADDRESS_VERIFICATION_FAILED
```

So:

```text
ADMITTED CROSSING != ACCEPT ANY RETURNED PAYLOAD
```

## Content-road boundary

The test uses a file-backed content-addressed store as a deterministic stand-in for a content road.

This proves:

- separate payload bytes;
- content addressing;
- independent destination resolution;
- byte verification;
- no-fetch refusal.

It does **not** prove:

- internet or DHT discovery;
- replication;
- provider availability;
- privacy-preserving retrieval;
- authorization to read restricted payloads;
- global persistence.

Those are transport/content-network questions, not facts earned by this specimen.

## World-seed consequence

The addressed payload can still be translated by the destination.

The source may offer:

```text
Water the young tree
```

and Room B may admit the same lineage as:

```text
Refill the community rain bowl
```

The payload supplies provenance-bearing possibility.

The locality supplies meaning-in-place.

## Next pressure

TENET 004 should make the content road genuinely replaceable:

> Can the same addressed world-seed be resolved from two independent content providers, with identical verified bytes and no change to GrO or reLATTE semantics?

That is the point where a file store, IPFS-like store, HTTP mirror, DHT, TranchNode, or other content road can become implementation choices rather than world law.
