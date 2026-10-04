# TENET 004 — Replaceable Roads

Status: executable cross-repository specimen

## Claim under test

One content-addressed GrO world-seed can be independently retained and served by materially different providers without changing seed identity or local GrO consequence.

One provider may later disappear.

The seed survives through another provider.

```text
                    sha256:SEED
                    /          \
                   /            \
          file provider A    HTTP provider B
                 |                |
                 +------ identical bytes
                              |
                       destination GrO
                              |
                     same verified seed
                              |
                      same local trace
```

Then:

```text
provider A dies
      X
      |
fallback resolver
      |
provider B survives
      |
same sha256:SEED
      |
same verified bytes
      |
same local trace
```

## Relation to reLATTE

reLATTE already proves a related transport law:

```text
ROAD CHANGE != CROSSING IDENTITY
```

Its Replaceable Transport witness carries the same signed crossing over filesystem and HTTP roads.

TENET 004 applies the same discipline to the **payload content road** rather than the crossing transport road.

The layers remain distinct:

```text
reLATTE transport road != GrO content road
crossing identity       != payload identity
transport provider      != content provider
```

## Providers in this specimen

### Provider A — file

An independent file-backed content-addressed store.

### Provider B — HTTP

A separate file-backed store exposed through a real localhost HTTP GET server.

The two providers:

- have separate roots;
- retain independently written copies;
- are accessed by materially different mechanisms;
- serve bytes for the same SHA-256 address.

They do not share authority.

## Deterministic consequence

TENET 004 resolves the same addressed payload through A and B separately.

GrO independently verifies the address in both cases.

The destination, crossing, local admission receipt, local rules, and verified payload are the same.

Therefore the resulting local GrO trace ID is the same.

Critically, **provider identity is not included in the local trace identity**.

```text
RETRIEVAL PATH != WORLD-SEED IDENTITY
PROVIDER ID != LOCAL CONSEQUENCE IDENTITY
```

## Provider-death witness

After both providers have independently retained the seed:

1. Provider A's backing store is deleted.
2. Resolution is attempted against A, then B.
3. A fails.
4. B serves the seed.
5. the bytes still verify against the signed content address.
6. the destination produces the same local trace as before A died.

This earns:

```text
PROVIDER DEATH != WORLD-SEED DEATH
```

It does **not** earn global durability. If every provider disappears, the bytes are unavailable even though the address remains meaningful.

## Authority boundary

A provider can make bytes available.

That does not make the provider:

- the source;
- the seed author;
- the destination;
- the admission authority;
- the local interpreter;
- the owner of the resulting affordance.

```text
PROVIDER != SOURCE
PROVIDER != AUTHORITY
SERVE != ADMIT
COPY != OWNERSHIP
```

## What this earns

- one payload identity across multiple providers;
- real file vs HTTP retrieval;
- identical verified bytes;
- identical local GrO consequence;
- deterministic fallback after provider failure;
- survival after one provider disappears.

## What this does not earn

- public internet discovery;
- DHT routing;
- provider authenticity;
- privacy-preserving retrieval;
- automatic replication policy;
- quorum durability;
- erasure coding;
- incentive economics;
- permanent availability.

## Next pressure

TENET 005 should separate **discovery** from **retrieval**:

> Can a destination learn multiple candidate providers for a world-seed from an untrusted or replaceable discovery layer, then verify the seed independently so lying discovery cannot redefine identity?

That would make:

```text
DISCOVERY != PROVIDER
PROVIDER != SEED
SEED != AUTHORITY
```
