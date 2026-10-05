# TENET 010 — Fork ≠ Conflict

Status: executable cross-repository specimen

## Claim under test

One verified predecessor checkpoint may lawfully have multiple verified successor checkpoints.

```text
             CHECKPOINT(Y)
                 root R1
                /       \
               /         \
       CHECKPOINT(ZA)  CHECKPOINT(ZB)
          root R2a        root R2b
```

Both successors:

- bind the same predecessor checkpoint;
- name the same previous lineage root;
- occupy the same generation;
- have distinct subject crossings;
- have distinct lineage roots;
- remain separately signed and attributable.

The existence of two successors does not itself establish conflict.

```text
FORK != CONFLICT
```

## Fork observation

GrO derives a fork observation only from already verified successor checkpoints.

It requires:

- at least two distinct verified checkpoints;
- the same generation;
- the same previous lineage root;
- the same compact predecessor anchor;
- distinct successor subjects;
- distinct successor lineage roots.

The resulting object explicitly contains:

```text
canonicalBranchId = null
conflict = false
authority = null
```

The fork observer does not select a winner.

## No global canon

A fork means:

> More than one lawful continuation currently descends from this same checkpoint.

It does not mean:

> Exactly one branch is the real continuation.

Therefore:

```text
FORK != CANON
BRANCH EXISTENCE != BRANCH SELECTION
```

## Sovereign locality witness

TENET 010 carries two real signed reLATTE branch crossings and two real signed successor checkpoint crossings.

A later sovereign receiver may treat the branches differently.

### Room E — coexist

Room E receives both branch crossings and locally ADMITs both.

```text
ZA → R3_ADMIT
ZB → R3_ADMIT
```

The GrO fork projection keeps both eligible.

No conflict is inferred.

### Room F — local asymmetry

Room F receives the same two branches.

It locally:

```text
ZA → R3_ADMIT
ZB → R3_HOLD
```

That disposition does not rewrite the fork.

It does not make ZA globally canonical.

It does not invalidate ZB elsewhere.

```text
LOCAL SELECTION != GLOBAL CANON
HOLD != HISTORICAL ERASURE
```

### Room G — declared incompatibility

Room G's projection declares:

```text
exclusive-key = waterRoute
```

ZA carries one local route value.

ZB carries another.

Only because Room G declares that dimension exclusive does the local projection report:

```text
localConflict = true
```

Both branches are held under that projection.

Neither becomes globally false or globally canonical.

```text
LOCAL INCOMPATIBILITY != GLOBAL CONFLICT
CONFLICT REQUIRES A DECLARED LOCAL RULE
```

## Why this matters

Distributed branching does not require immediate consensus.

A system may preserve:

- alternate interpretations;
- alternate creative continuations;
- alternate local adaptations;
- alternate game paths;
- alternate descendants;

without converting multiplicity into contradiction.

Conflict exists only when a relevant authority actually declares a rule under which the branches cannot coexist in that locality or operation.

## Laws earned

```text
FORK != CONFLICT
FORK != CANON
BRANCH EXISTENCE != BRANCH SELECTION
SHARED ANCESTRY != SHARED AUTHORITY
LOCAL SELECTION != GLOBAL CANON
HOLD != REJECTION OF HISTORY
LOCAL INCOMPATIBILITY != GLOBAL CONFLICT
CONFLICT REQUIRES A DECLARED LOCAL RULE
```

## What this earns

- two distinct successor checkpoints from one predecessor root;
- real signed reLATTE checkpoint carriers;
- deterministic fork identity;
- no default canonical branch;
- no default conflict;
- sovereign ADMIT/ADMIT behavior;
- sovereign ADMIT/HOLD behavior;
- explicit local incompatibility rule;
- retention of both branches under local conflict.

## What this does not earn

- automatic branch composition;
- a merge algorithm;
- universal conflict semantics;
- branch ranking;
- branch reputation;
- canonical-head election;
- fork resolution by voting;
- proof that every pair of branches is semantically compatible.

Those remain local or higher-layer concerns.

## Next pressure

TENET 011 should test **recombination without collapse**.

Given two lawful fork branches:

```text
ZA     ZB
 \     /
  \   /
    W
```

Can a third locality create a fresh descendant W that explicitly cites both parents, records what it preserved / varied / introduced / retired from each, and inherits authority from neither?

That would earn:

```text
COMPOSITION != CANONIZATION
MERGE != ERASURE
MULTI-PARENT ANCESTRY != SHARED AUTHORITY
```
