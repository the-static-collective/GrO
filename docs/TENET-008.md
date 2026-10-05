# TENET 008 — Generations / Pruning

Status: executable cross-repository specimen

## Claim under test

A lineage can grow:

```text
X → Y → Z
```

without making every descendant recursively embed all prior lineage evidence forever.

TENET 008 introduces a bounded lineage checkpoint after Y.

Full X→Y verification happens **before pruning**.

The checkpoint then preserves:

- Y's signed crossing identity;
- Y's payload content address;
- X's crossing identity and content address as Y's direct parent;
- Y's verified uptake/action identifiers;
- a local R11-style receipt-set commitment;
- a chained lineage root;
- the address of the full Y evidence bundle for possible later rehydration.

Z carries that checkpoint plus the **direct Y→Z evidence**.

It does not recursively carry Y's full X→Y evidence bundle.

## Shape

```text
X full evidence
    |
    | full verify
    v
Y full evidence
    |
    | full verify
    v
CHECKPOINT(Y)
    |
    | bounded commitment
    v
Z payload
  ├─ direct Y→Z evidence
  └─ CHECKPOINT(Y)

X payload store deleted
Y payload store deleted

Room D
  |
verify Z bytes
  |
verify signed CHECKPOINT(Y)
  |
verify Y→Z directly
  |
earlier X→Y = checkpointed / resumable
  |
local ADMIT
  |
playable Z
```

## Full verification precedes pruning

This order is constitutional.

The checkpoint creator must receive a GrO seed object that already has:

```text
lineageVerified = true
```

A checkpoint cannot be used to turn unverified ancestry into verified ancestry.

```text
CHECKPOINT != VERIFICATION SHORTCUT
FULL VERIFICATION PRECEDES PRUNING
```

## What the checkpoint means

The checkpoint is a compact commitment made by a local world after full verification.

It says, roughly:

> At this point, this world had fully verified this descendant relation, and here are the exact identities, roots, and evidence addresses needed to resume or rehydrate that claim later.

It does **not** say:

> The checkpoint is the history.

Therefore:

```text
CHECKPOINT != HISTORY
COMMITMENT != EVIDENCE
LINEAGE ROOT != AUTHORITY
```

## R11 receipt-set composition

The checkpoint includes reLATTE's existing:

```text
relatte.receipt-set-commitment/v0
```

for the local world's receive/admit history around Y.

Future verification checks the commitment's deterministic shape.

It does not silently claim to possess the underlying receipts after pruning.

This matches reLATTE R11:

```text
COMMITMENT != HISTORY
ROOT != RECEIPT
```

## Signed checkpoint carrier

The checkpoint body is content-addressed.

A separate signed reLATTE crossing binds that exact checkpoint address:

```text
declared_kind = R11_LINEAGE_CHECKPOINT
requested_effect = null
semantic_effect = none
authority = null
parents = [Y crossing]
```

The carrier itself has no gameplay effect and grants no authority.

## Chained lineage root

The first checkpoint computes:

```text
root(Y) = H(
  previous_root = null,
  subject = Y,
  direct_parent = X,
  verified relation IDs,
  local receipt-set root
)
```

A later checkpoint for Z can compute:

```text
root(Z) = H(
  previous_root = root(Y),
  subject = Z,
  direct_parent = Y,
  verified relation IDs,
  local receipt-set root
)
```

So the carried root stays bounded while the family tree grows.

The root commits to continuity.

It does not expose every historical fact by itself.

## Two verification modes

TENET 008 makes a distinction that must remain visible.

### Full lineage verification

All historical evidence needed for a relation is present and directly rechecked.

This is what happens to X→Y before Y is checkpointed.

### Checkpointed resumable lineage

The direct current relation is fully verified, while earlier generations are represented by a verified signed checkpoint.

This is what happens to Z:

```text
Y→Z = directly verified
X→Y = checkpointed-resumable
```

The verifier reports:

```text
lineageMode = checkpointed-resumable
```

It must never label that state as identical to full historical re-verification.

## Rehydration

The checkpoint retains Y's full evidence content address.

If old evidence becomes available later, a stricter verifier can fetch it and rerun the full historical verifier.

Therefore:

```text
PRUNED != FORGOTTEN
CHECKPOINTED != UNRECOVERABLE
```

subject, of course, to the actual bytes still existing somewhere.

The checkpoint does not guarantee their availability.

## Executable death/pruning witness

The CI witness:

1. builds X;
2. admits and acts through X to produce Y;
3. fully verifies Y;
4. checkpoints Y;
5. acts through Y to produce Z;
6. stores Z;
7. deletes the X payload store;
8. deletes the Y payload store;
9. gives Room D only Z plus its embedded checkpoint;
10. verifies the checkpoint signature and receipt-set commitment shape;
11. directly verifies Y→Z through reLATTE R10;
12. reports X→Y as checkpointed-resumable;
13. locally admits Z;
14. exposes Z as playable.

## Bounded-size witness

The executable specimen also constructs a naive alternative:

```text
Z + recursively nested full Y payload
```

and asserts that the pruned Z payload is smaller.

The exact byte savings in this tiny fixture are not a scaling claim.

The structural claim is stronger and simpler:

```text
Z does not recursively embed Y's full historical payload.
```

Each generation carries:

- direct parent evidence;
- one bounded ancestry checkpoint.

That prevents automatic recursive payload nesting.

## Laws earned

```text
CHECKPOINT != HISTORY
COMMITMENT != EVIDENCE
PRUNING != RETCON
PRUNED != FORGOTTEN
FULL VERIFICATION PRECEDES PRUNING
DIRECT RELATION VERIFIED, EARLIER HISTORY CHECKPOINTED
LINEAGE ROOT != AUTHORITY
CHECKPOINT AVAILABILITY != GLOBAL CANON
```

## What this earns

- three generations: X → Y → Z;
- full X→Y verification before pruning;
- deterministic lineage checkpoint;
- R11 receipt-set commitment inside checkpoint;
- signed checkpoint carrier;
- chained lineage root;
- direct Y→Z R10 verification;
- deletion of X and Y semantic payload stores;
- checkpointed-resumable verification of Z;
- local admission and playability after pruning;
- proof that recursive full-parent embedding is unnecessary.

## What this does not earn

- proof that pruned historical bytes remain available;
- full X→Y re-verification after X and Y payload destruction;
- Merkle inclusion proofs for arbitrary ancient ancestors;
- bounded storage for unbounded branching;
- checkpoint quorum;
- checkpoint revocation;
- automatic TranchNode pruning policy;
- legal or moral authority from ancestry.

## Why this is the TranchNode seam

TENET 008 finally gives pruning a semantic job.

A node can retain:

```text
recent direct relations
+
bounded lineage checkpoints
+
content addresses for possible rehydration
```

instead of retaining every ancestor bundle inline forever.

That is the beginning of a lawful memory lattice rather than an infinitely nesting archive.

## Next pressure

TENET 009 should test **checkpoint succession**:

```text
X → Y → Z → Q
```

Checkpoint Z using `root(Y)` as its previous root, then discard the Y checkpoint body from Q.

The question becomes:

> Can a later node verify root continuity across successive checkpoints while carrying only the newest checkpoint, and still know exactly what it can and cannot claim about pruned generations?

That is where bounded TranchNode memory starts becoming executable.
