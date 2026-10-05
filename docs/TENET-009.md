# TENET 009 — Checkpoint Succession

Status: executable cross-repository specimen

## Claim under test

A lineage can continue:

```text
X → Y → Z → Q
```

while Q carries only the **newest checkpoint body**.

TENET 008 proved:

```text
Y→Z = directly verified
X→Y = checkpointed-resumable
```

TENET 009 now checkpoints Z.

The Z checkpoint binds a compact predecessor anchor to the Y checkpoint:

```text
checkpoint ID
checkpoint content address
checkpoint crossing ID
lineage root
generation
```

It does not nest the full Y checkpoint body.

Q then carries CHECKPOINT(Z), whose predecessor anchor names CHECKPOINT(Y).

## Succession shape

```text
CHECKPOINT(Y)
  root = R1
  generation = 1

          ↓ full verification of Z

CHECKPOINT(Z)
  previous_root = R1
  root = R2
  generation = 2
  predecessor_anchor = {
    checkpoint_id(Y),
    address(Y),
    crossing_id(Y),
    root(Y),
    generation(Y)
  }

          ↓

Q
  direct Z→Q evidence
  +
  CHECKPOINT(Z)

CHECKPOINT(Y) body may now disappear.
```

## Signed carrier relation

A generation-1 checkpoint carrier has one parent:

```text
[Y crossing]
```

A successor checkpoint carrier has two:

```text
[Z crossing, CHECKPOINT(Y) crossing]
```

This makes the signed successor carrier bind both:

- the subject being checkpointed;
- the predecessor checkpoint identity it succeeds.

The successor extension also binds:

- current checkpoint ID;
- current lineage root;
- current generation;
- previous lineage root;
- compact predecessor anchor.

## What root continuity means

If CHECKPOINT(Z) verifies, a later node can prove:

> This signed checkpoint declares Z as generation 2 and binds its lineage root to exactly this predecessor root / checkpoint identity.

It cannot prove from CHECKPOINT(Z) alone:

> Every byte of CHECKPOINT(Y)'s historical evidence was re-fetched and re-verified now.

That distinction is mandatory.

```text
ROOT CONTINUITY != FULL HISTORY REVERIFICATION
PREDECESSOR ANCHOR != PREDECESSOR HISTORY
```

## Bounded carry

The executable witness asserts that Q contains exactly one object with:

```text
schema = gro.lineage-checkpoint.v0
```

That object is CHECKPOINT(Z).

CHECKPOINT(Y) survives only as a compact predecessor anchor inside CHECKPOINT(Z).

The witness constructs a naive alternative with the full old checkpoint body nested into Q and confirms that it is larger.

The exact byte delta is fixture-specific.

The structural claim is:

```text
newest checkpoint body + predecessor anchor
!=
recursive checkpoint nesting
```

## Death witness

Before Q is verified, the witness removes:

- the old CHECKPOINT(Y) backing store;
- Z's old semantic payload store.

Room E receives Q and can still:

1. verify Q bytes;
2. verify CHECKPOINT(Z)'s signed carrier;
3. verify CHECKPOINT(Z)'s receipt-set commitment shape;
4. verify Z→Q directly with reLATTE R10;
5. recognize earlier generations as checkpointed-resumable;
6. locally ADMIT Q;
7. expose Q as playable.

## Laws earned

```text
SUCCESSOR CHECKPOINT != PREDECESSOR CHECKPOINT
ROOT CONTINUITY != FULL HISTORY REVERIFICATION
NEWEST CHECKPOINT MAY REPLACE OLDER CHECKPOINT BODY
PREDECESSOR ANCHOR != PREDECESSOR HISTORY
BOUNDED MEMORY != AMNESIA
CHECKPOINT SUCCESSION != AUTHORITY
```

## What this earns

- four generations: X → Y → Z → Q;
- generation-numbered checkpoint succession;
- previous-root chaining;
- compact predecessor anchor;
- signed carrier parentage linking subject + predecessor checkpoint;
- one checkpoint body carried by Q;
- deletion of the old checkpoint body store;
- deletion of Z's old semantic payload store;
- direct Z→Q verification;
- checkpointed-resumable earlier ancestry;
- local Q admission and playability.

## What this does not earn

- full re-verification of the discarded checkpoint body;
- proof the discarded checkpoint bytes remain available;
- a Merkle proof for arbitrary ancestor membership;
- fork resolution between competing successor checkpoints;
- checkpoint revocation;
- global checkpoint authority;
- automatic retention policy;
- bounded memory for arbitrary branching graphs.

## TranchNode consequence

This is the first executable form of rolling ancestry memory:

```text
recent direct evidence
+
newest signed checkpoint
+
compact predecessor root anchor
```

A node no longer needs a growing stack of old checkpoint bodies just to continue lawfully.

The newest checkpoint says exactly where continuity came from without impersonating the history it replaced.

## Next pressure

TENET 010 should test **checkpoint forks**.

Two sovereign worlds may both descend from the same checkpoint and produce:

```text
R2a
R2b
```

Neither should become globally canonical merely because it exists.

The question becomes:

> Can GrO preserve both lawful successor branches, let later localities choose or compose them independently, and keep `FORK != CONFLICT` until a specific local rule actually makes them incompatible?
