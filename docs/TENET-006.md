# TENET 006 — Many Maps, One Seed

Status: executable cross-repository specimen

## Claim under test

Two independent discovery systems can disagree about where a world-seed is available, share no directory state, advertise disjoint provider sets, and still converge on the same seed because identity closes on the signed content address rather than directory consensus.

```text
                    signed sha256:X
                    /              \
                   /                \
              MAP A                MAP B
          Alice, Ghost       Liar, Carol
               |                  |
             Alice              Carol
               |                  |
          bytes hash X        bytes hash X
               \                  /
                \                /
                  SAME WORLD-SEED
                        |
                 SAME LOCAL TRACE
```

## No synthetic consensus directory

TENET 006 does **not** merge Map A and Map B into a new authoritative directory.

Each map is queried and evaluated independently.

Each map keeps its own:

- candidate set;
- failures;
- malformed observations;
- provider identities;
- ordering;
- local uncertainty.

The only convergence point is the already-signed target address.

```text
DISCOVERY CONSENSUS != SEED IDENTITY
```

## Executable topology

### Map A — Orchard map

Advertises only:

- Alice — honest file provider;
- Ghost A — dead file provider.

### Map B — Lantern map

Advertises only:

- Liar B — live HTTP provider serving counterfeit bytes;
- Carol — honest HTTP provider.

The maps:

- run as separate HTTP discovery servers;
- share no mutable directory state;
- advertise no common provider;
- use materially different honest provider roads.

Yet Alice and Carol independently retained exact bytes for the same SHA-256 address.

Map A reaches Alice.

Map B rejects Liar B on address mismatch, then reaches Carol.

Both independently verify:

```text
sha256(bytes) == signed target address
```

## Consequence convergence

The independently verified bytes from Map A and Map B are passed through the same destination admission and local GrO rules.

They yield the same local GrO trace ID.

Directory identity, map URL, provider identity, provider locator, failed candidates, and route history are absent from that trace identity.

Therefore:

```text
DIRECTORY DISAGREEMENT != WORLD DISAGREEMENT
RETRIEVAL HISTORY != CONSEQUENCE IDENTITY
```

## Failure does not veto

A separate witness gives one map total discovery failure while another map successfully resolves the seed.

The successful map still wins operationally.

No vote is taken.

```text
ONE MAP UNKNOWN != SEED UNKNOWN
ONE MAP FAILURE != GLOBAL VETO
```

This does not mean failed discovery is erased. Its unresolved observation remains available as evidence.

## Laws earned

```text
MANY MAPS != MANY SEEDS
DISCOVERY CONSENSUS != SEED IDENTITY
DIRECTORY DISAGREEMENT != IDENTITY CONFLICT
CONVERGENCE IS VERIFIED, NOT VOTED
MAP SET != PROVIDER SET
ONE MAP FAILURE != GLOBAL VETO
```

## What this earns

- two independent discovery servers;
- disjoint provider sets;
- no shared directory state;
- honest convergence through file and HTTP providers;
- malicious provider rejection inside one map;
- identical local consequence across independent maps;
- continued resolution when another map is unknown.

## What this does not earn

- global provider discovery;
- Byzantine consensus;
- Sybil resistance;
- ranking legitimacy;
- discovery privacy;
- proof that every map is independent in an organizational sense;
- public DHT propagation;
- probabilistic availability guarantees.

None are required for seed identity.

## The inversion

Conventional distributed systems often ask:

> How do all nodes agree on the directory?

GrO can ask a weaker and often more useful question:

> Can partial, contradictory maps independently lead us to bytes that verify as the same particular?

For addressed world-seeds, that is enough to converge on identity.

## Next pressure

TENET 007 should test **forward propagation without central broadcast**:

> Can a player act through a world-seed, create a descendant seed with explicit lineage, and let independent maps discover the descendant without requiring the ancestor's provider or discovery systems to remain alive?

That would move the architecture from durable discovery into genuine distributed growth.
