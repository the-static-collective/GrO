# TENET 007 — Descendant Without Broadcast

Status: executable cross-repository specimen

## Claim under test

A player can encounter world-seed **X**, act through it locally, and author a distinct descendant world-seed **Y** with explicit lineage.

Y can then move onto new providers and a new discovery map.

After X's original provider and original discovery map disappear, another locality can still:

1. discover Y;
2. verify Y's exact bytes;
3. verify Y's reLATTE R10 cultural-descendant relation back to X;
4. locally ADMIT Y;
5. expose Y as a playable GrO affordance.

No central broadcast service is required.

```text
X
|
| discovered + verified
v
Room B ADMIT
|
| player acts through X
v
GrO occurrence receipt
|
| reLATTE field + cultural uptake
v
Y = distinct descendant seed
|
+--> new provider 1
|
+--> new provider 2
|
+--> new discovery map

DELETE X provider
DELETE X discovery map

new Room C
   |
discover Y
   |
verify Y bytes
   |
verify R10 lineage to signed X crossing
   |
local ADMIT
   |
playable Y
```

## Composition with reLATTE R10

TENET 007 does not invent a second lineage protocol.

It uses reLATTE's existing cultural-descendant machinery:

- signed ancestor crossing;
- signed local ADMIT receipt;
- deterministic field projection;
- cultural uptake;
- descendant crossing with `parents = [ancestor_crossing_id]`;
- receiver-local requested effect;
- explicit `ANCESTRY != AUTHORITY`.

GrO supplies the gameplay/action layer around that lineage.

## The local action matters

Y is not emitted merely because X arrived.

Room B must:

1. locally ADMIT X;
2. expose X as a GrO tenet;
3. have an actor who satisfies X's bounded requirement;
4. record an actual `act-through-tenet` occurrence;
5. create a new descendant tenet authored by that actor.

The GrO occurrence receipt for the action includes the ancestor's local ADMIT receipt ID as an input.

Therefore the descendant seed carries a deterministic bridge:

```text
signed X crossing
  ↓
signed X ADMIT receipt
  ↓
GrO act-through receipt
  ↓
descendant Y
```

## What Y carries forward

Y contains lineage evidence sufficient for the current R10 verifier:

- X's signed crossing;
- B's signed X ADMIT receipt;
- B's field projection;
- B's cultural uptake;
- the GrO action receipt;
- the GrO response trace;
- X's content address;
- Y's new tenet semantics.

Y does **not** copy X's semantic payload bytes.

That distinction is deliberate.

```text
LINEAGE EVIDENCE != ANCESTOR PAYLOAD REPLICATION
DESCENDANT != BACKUP COPY
```

X's signed crossing still binds X's old content address, so Y can prove which ancestor identity it descends from without requiring X's original content provider to remain online.

## Death witness

Before Room C discovers Y, the executable witness:

- deletes X's only content-provider store;
- closes X's discovery server;
- confirms the old discovery route is unavailable.

Y's new providers and new map remain independent of that infrastructure.

Room C then discovers and verifies Y successfully.

This earns:

```text
ANCESTOR PROVIDER DEATH != DESCENDANT DEATH
ANCESTOR MAP DEATH != DESCENDANT UNDISCOVERABLE
```

## Local admission remains sovereign

Verified lineage does not force Room C to play Y.

Y receives its own fresh reLATTE crossing and Room C produces its own local ADMIT receipt.

Only after that does GrO localize Y as a playable tenet.

```text
LINEAGE VERIFIED != ADMITTED
DESCENDANT RECEIVED != PLAYABLE
ANCESTRY != AUTHORITY
```

## Laws earned

```text
DESCENDANT != ANCESTOR
LINEAGE != CENTRAL REGISTRY
PROPAGATION != BROADCAST
ANCESTOR PROVIDER DEATH != DESCENDANT DEATH
ANCESTOR MAP DEATH != DESCENDANT UNDISCOVERABLE
LINEAGE EVIDENCE != ANCESTOR PAYLOAD REPLICATION
ANCESTRY != AUTHORITY
```

## Important limit

This witness verifies lineage back to **X's signed crossing identity and content address** after X's original road disappears.

It does **not** prove that X's semantic payload bytes remain reconstructible after every copy of X is destroyed.

That stronger claim would require retention or replication of X itself.

Likewise, reLATTE R10's current verifier proves its declared structural/cryptographic lineage relationships. TENET 007 does not promote that into legal authorship, moral authority, ownership, or universal identity.

## What this earns

- real local action through an imported seed;
- distinct descendant semantics;
- deterministic GrO action receipt;
- reLATTE R10 cultural uptake;
- signed descendant crossing;
- new descendant content providers;
- new descendant discovery map;
- ancestor provider death;
- ancestor map death;
- later lineage verification;
- later sovereign admission;
- later GrO playability.

## Next pressure

TENET 008 should let **Y create Z in a different locality** and then verify a multi-generation chain without requiring all ancestors to be online.

The hard question becomes:

> How much lineage evidence must a descendant carry before a growing family tree becomes too heavy?

That is where pruning, checkpoints, TranchNode, and lawful resumability can enter naturally.
