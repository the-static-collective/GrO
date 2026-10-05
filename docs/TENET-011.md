# TENET 011 — Recombination Without Collapse

Status: executable cross-repository specimen

## Claim under test

Two lawful fork branches may become inputs to a fresh descendant without selecting a winner, erasing either parent, or inheriting authority from either lineage.

```text
          ZA          ZB
           \          /
            \        /
             \      /
                W
```

W is not:

- ZA declared canonical;
- ZB declared canonical;
- ZA overwritten by ZB;
- ZB overwritten by ZA;
- an average that hides variation;
- a transfer of either parent's authority.

W is a new locally authored particular with two explicit parents.

## Recombination gate

Fork existence alone is not enough.

The composing locality must have:

1. a verified fork observation;
2. no local conflict under the active projection;
3. both branch checkpoints locally eligible;
4. a real local `R3_ADMIT` receipt for each parent crossing.

Therefore Room E from TENET 010 may compose W:

```text
ZA → ADMIT
ZB → ADMIT
projection → coexist
```

Room F may not:

```text
ZA → ADMIT
ZB → HOLD
```

Room G may not while its exclusivity rule reports local conflict.

```text
RECOMBINATION REQUIRES LOCAL COELIGIBILITY
```

## Explicit contribution record

Each parent receives its own declaration:

```text
parent ZA:
  preserved: [...]
  varied: [...]
  retired: [...]

parent ZB:
  preserved: [...]
  varied: [...]
  retired: [...]

introduced:
  [...]
```

Every parent must contribute at least one preserved statement and at least one varied statement.

This prevents a nominal multi-parent object where one branch is listed as ancestry but semantically ignored.

```text
MULTI-PARENT LABEL != MULTI-PARENT COMPOSITION
VARIATION != RETCON
```

## Fresh local act

W is born through a deterministic GrO occurrence receipt:

```text
action = compose-fork-branches
inputs = [ADMIT(ZA), ADMIT(ZB)]
actor = local composer
```

The action receipt does not inherit either branch's source authority.

The W payload fixes:

```text
inheritedFromParents = false
inheritedFromFork = false
localAuthorRequired = true
```

## Signed two-parent crossing

W is carried by a fresh signed reLATTE envelope:

```text
declared_kind = GRO_MULTI_PARENT_RECOMBINATION
parents = [crossing(ZA), crossing(ZB)]
requested_effect = {
  kind: fresh-candidate-local-uptake
  authority: receiver-local
}
```

Its extension also fixes:

```text
inherited_authority = false
canonicalizes_parents = false
erases_parents = false
```

General reLATTE crossing verification signs those two parents as part of W's identity.

## Parents remain intact

The executable witness serializes both signed parent crossings before W is created and compares them afterward.

They are unchanged.

```text
MERGE != ERASURE
PARENTS REMAIN INTACT
```

W therefore adds a new edge to the lineage graph.

It does not rewrite either incoming edge.

## Fresh downstream sovereignty

Room H receives W as a fresh crossing.

The parent worlds' ADMIT receipts do not carry forward as H's decision.

H first emits:

```text
RECEIVED
semantic_effect = none
```

and only after its own:

```text
R3_ADMIT
```

does GrO localize W as a playable tenet.

```text
PARENT ADMIT != CHILD ADMIT
COMPOSITION != ADMISSION
```

## Laws earned

```text
COMPOSITION != CANONIZATION
MERGE != ERASURE
MULTI-PARENT ANCESTRY != SHARED AUTHORITY
RECOMBINATION REQUIRES LOCAL COELIGIBILITY
PARENT ADMIT != CHILD ADMIT
VARIATION != RETCON
PARENTS REMAIN INTACT
```

## What this earns

- two lawful fork branches;
- local co-eligibility requirement;
- real signed parent ADMIT receipts;
- deterministic local composition receipt;
- explicit per-parent preserved / varied / retired declarations;
- explicit introduced material;
- fresh recombinant content address;
- signed two-parent reLATTE crossing;
- no parent canonicalization;
- no parent erasure;
- no inherited authority;
- fresh downstream admission;
- playable recombinant consequence.

## What this does not earn

- automatic semantic merge;
- proof that any two branches are meaningfully composable;
- conflict resolution;
- ranking among possible recombinations;
- inherited licensing or legal rights;
- automatic checkpointing of W;
- graph-wide cycle prevention;
- multi-parent checkpoint compression;
- global canon.

## The graph transition

TENET 010 turned the lineage chain into a branching tree.

TENET 011 turns that tree into a graph:

```text
        Y
       / \
     ZA   ZB
       \ /
        W
```

The important property is not merely multiple parents.

It is that ancestry remains attributable while authority and canon remain local.

## Next pressure

TENET 012 should test **recombinant checkpointing**.

Can W receive a bounded checkpoint that commits to two direct parent roots without recursively nesting both branches, so later descendants can carry a compact multi-parent ancestry frontier?

That would move TranchNode memory from a rolling chain checkpoint to a bounded **graph frontier**.
