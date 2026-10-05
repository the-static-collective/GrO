# TENET 012 — Recombinant Checkpoint / Graph Frontier

Status: executable cross-repository specimen

## Claim under test

A recombinant descendant W with multiple lawful parent branches can be checkpointed without recursively carrying both parent checkpoint bodies.

```text
ZA        ZB
 \        /
  \      /
      W
      |
      | fully verified recombinant
      v
GRAPH FRONTIER CHECKPOINT(W)
      |
      | compact parent anchors only
      v
      V
```

The graph frontier preserves a bounded ancestry frontier for each direct parent branch:

- parent checkpoint ID;
- parent checkpoint content address;
- parent checkpoint crossing ID;
- parent lineage root;
- parent generation;
- parent subject crossing ID;
- parent subject payload address.

It does not embed the full parent checkpoint bodies.

## Full verification before graph pruning

The checkpoint may only be created from:

- a fully verified recombinant W;
- W's signed two-parent crossing;
- fully verified parent checkpoints for every recombinant parent;
- a local receipt-set commitment for the world checkpointing W.

Therefore:

```text
FULL PARENT VERIFICATION PRECEDES FRONTIER PRUNING
```

The frontier is not a shortcut that upgrades unknown ancestry into verified ancestry.

## Deterministic multi-parent frontier

The parent anchors are canonically ordered and hashed into:

```text
parentFrontierRoot
```

The checkpoint then computes:

```text
graphRoot = H(
  W subject identity,
  parentFrontierRoot,
  compact parent frontier,
  recombinant verification identifiers,
  local receipt-set root
)
```

The frontier root commits to the direct parent frontier. The graph root commits to the checkpointed recombinant state.

Neither grants authority.

```text
FRONTIER ROOT != AUTHORITY
MULTI-PARENT ROOT != CANON
```

## Signed graph-frontier carrier

The checkpoint body is content-addressed.

A fresh signed reLATTE crossing binds:

```text
declared_kind = GRO_GRAPH_FRONTIER_CHECKPOINT
parents = [
  W crossing,
  CHECKPOINT(ZA) crossing,
  CHECKPOINT(ZB) crossing
]
requested_effect = null
```

Its extension binds the checkpoint ID, graph root, parent frontier root, parent checkpoint IDs, parent lineage roots, parent count, semantic effect = none, and authority = null.

The carrier therefore makes the compact frontier attributable without turning it into global canon.

## Parent checkpoint bodies can disappear

The end-to-end witness writes both branch checkpoint bodies to independent stores before frontier creation.

After W's graph frontier is verified, those stores are deleted.

A later descendant V does not carry those old bodies.

The V payload contains:

```text
1 × gro.graph-frontier-checkpoint.v0
0 × gro.lineage-checkpoint.v0
```

The graph frontier contains only compact parent anchors.

Therefore:

```text
PARENT CHECKPOINT ANCHOR != PARENT CHECKPOINT BODY
GRAPH PRUNING != GRAPH ERASURE
```

## Direct relation remains detailed

Graph pruning applies to earlier multi-parent ancestry.

The current W→V relation remains directly evidenced through W's signed crossing, W's local ADMIT receipt, the local field projection, the cultural uptake, V's GrO action receipt, V's response trace, and V's signed descendant crossing.

Verification therefore reports:

```text
W→V = directly verified
ZA/ZB→W = graph-frontier-resumable
```

not full re-verification of the deleted parent checkpoint bodies.

## Fresh downstream sovereignty

Room I receives V as a new candidate.

It still requires a fresh local:

```text
R3_ADMIT
```

before V becomes playable.

The inherited graph frontier does not carry W's admission authority into Room I.

```text
GRAPH FRONTIER != ADMISSION
ANCESTRY != AUTHORITY
```

## Laws earned

```text
FRONTIER != HISTORY
FRONTIER ROOT != AUTHORITY
MULTI-PARENT ROOT != CANON
FULL PARENT VERIFICATION PRECEDES FRONTIER PRUNING
PARENT CHECKPOINT ANCHOR != PARENT CHECKPOINT BODY
GRAPH PRUNING != GRAPH ERASURE
DIRECT RELATION VERIFIED, EARLIER GRAPH CHECKPOINTED
GRAPH FRONTIER != ADMISSION
```

## What this earns

- recombinant W with two verified parent branches;
- full parent checkpoint verification before graph pruning;
- deterministic two-parent frontier root;
- deterministic graph root;
- signed graph-frontier checkpoint carrier;
- deletion of both parent checkpoint stores;
- one frontier checkpoint body carried by V;
- zero parent lineage-checkpoint bodies carried by V;
- direct W→V verification;
- graph-frontier-resumable earlier ancestry;
- fresh Room I admission;
- playable V after graph pruning.

## What this does not earn

- proof that deleted parent checkpoint bytes remain available;
- full branch-history re-verification after deletion;
- arbitrary graph-width compression;
- graph-cycle detection;
- frontier fork resolution;
- canonical graph head selection;
- authority inheritance;
- global checkpoint legitimacy.

## TranchNode consequence

TENET 008 gave bounded chain memory.

TENET 009 gave rolling checkpoint succession.

TENET 010–011 made lineage branch and recombine.

TENET 012 gives that graph a bounded memory frontier:

```text
recent direct relation
+
one graph-frontier checkpoint
+
compact parent anchors
```

That is the first graph-native TranchNode memory primitive in GrO.

## Next pressure

TENET 013 should test **frontier succession after recombination**.

Can V later recombine or branch again, then produce a new graph frontier that replaces the old W frontier body with a compact predecessor-frontier anchor?

That would ask whether bounded graph memory can roll forward through repeated branch → recombine → branch cycles without turning into recursive checkpoint nesting.
