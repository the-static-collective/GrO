# TENET 005 — Discovery is not the provider

Status: executable cross-repository specimen

## Claim under test

A discovery layer may help GrO locate candidate providers for an addressed world-seed without becoming authoritative over the seed, the provider, or the resulting world consequence.

The discovery layer may be stale, duplicated, malformed, unavailable, or actively misleading.

Identity still comes from the signed address and independently verified bytes.

```text
signed crossing
     ↓
 sha256:SEED
     ↓
untrusted discovery
     ↓
candidate hints
  ├─ dead
  ├─ liar
  ├─ duplicate
  └─ honest
     ↓
local candidate materialization
     ↓
try provider
     ↓
VERIFY BYTES AGAINST sha256:SEED
     ↓
only matching bytes survive
     ↓
GrO semantic intake
```

## Relation to reLATTE discovery work

The reLATTE DID:DHT Discovery witness states:

> A map may reveal a road. It may not move the traveler.

TENET 005 applies the same law to GrO world-seed discovery.

```text
DISCOVERY != AUTHORIZATION
DISCOVERED != SELECTED
SELECTED != VERIFIED
VERIFIED != ADMITTED
```

## Hostile discovery witness

The executable specimen exposes a real localhost HTTP discovery service.

For the correct world-seed address it returns:

1. a dead file provider;
2. a live HTTP provider that deliberately serves counterfeit bytes;
3. an honest HTTP provider;
4. a duplicate honest hint;
5. an unsupported FTP hint.

The local projection:

- keeps valid candidates as inert hints;
- deduplicates identical candidate descriptions;
- records malformed/unsupported observations as ignored evidence;
- never executes a candidate merely because discovery returned it.

Then resolution proceeds locally.

The dead provider fails.

The liar serves bytes, but their SHA-256 address does not match the signed seed address, so the bytes are rejected and resolution continues.

The honest provider serves matching bytes.

Only then can GrO semantic intake occur.

## Candidate identity

Candidate identity is locally derived from:

```text
providerId + kind + locator
```

The discovery service does not get to assign candidate identity.

This avoids treating an untrusted directory's labels as canonical objects.

## Unknown is not none

If discovery itself fails, TENET 005 returns:

```text
DISCOVERY_UNKNOWN
```

It does not convert resolver failure into:

```text
NO PROVIDER EXISTS
```

Likewise, observing zero usable candidates means only:

```text
NO_PROVIDER_CANDIDATE_OBSERVED
```

not that no provider exists anywhere.

```text
MAP FAILURE != ROAD ABSENCE
UNKNOWN != NONE
NO CANDIDATE OBSERVED != NO PROVIDER EXISTS
```

## World identity boundary

Discovery metadata is not included in the GrO local trace identity.

Changing:

- discovery server;
- candidate ordering;
- failed candidate history;
- directory noise;

does not change the resulting local trace if the destination, admission, local rules, crossing, and verified seed bytes are unchanged.

## Laws earned

```text
DISCOVERY != PROVIDER
DISCOVERY != AUTHORITY
DISCOVERED != SELECTED
SELECTED != VERIFIED
PROVIDER CLAIM != SEED IDENTITY
DIRECTORY LABEL != CANDIDATE IDENTITY
LYING DIRECTORY != LYING WORLD
MAP FAILURE != ROAD ABSENCE
```

## What this earns

- real HTTP discovery boundary;
- inert provider candidates;
- local candidate identity;
- duplicate filtering;
- malformed-hint retention;
- stale-provider survival;
- malicious-provider byte rejection;
- continued search after a lying candidate;
- discovery-independent GrO consequence identity.

## What this does not earn

- public DHT publication;
- cryptographic discovery records;
- provider reputation;
- endpoint authentication;
- private discovery;
- Sybil resistance;
- ranking economics;
- global availability;
- proof that an advertised provider controls its locator.

Those can be layered later without becoming seed identity.

## Next pressure

TENET 006 should test **many maps, one seed**:

> Can two mutually independent discovery systems disagree about provider sets, overlap on no directory state, and still converge on the same world-seed because verification closes on the content address?

That would prove:

```text
DISCOVERY CONSENSUS != REQUIRED FOR SEED IDENTITY
```
