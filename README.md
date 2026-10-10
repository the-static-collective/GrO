# GrO

**a postEmahh'n growth**

GrO is an embodied, provenance-preserving possibility game.

It does not gamify reality by painting points on top of it. GrO notices, carries, composes, and grows playable possibility already latent in reality.

## Prime loop

```text
NOTICE
  ↓
ADDRESS
  ↓
ENCOUNTER
  ↓
RECEIVE
  ↓
HOLD
  ↓
ACT / COMPOSE
  ↓
RECEIPT
  ↓
CONSEQUENCE
  ↓
NEW AFFORDANCE
  └────────────→ somebody else's ENCOUNTER
```

## First laws

- **The map is not content. The map is consequence.**
- RECEIVING is not owning.
- HOLDING is not canonizing.
- A receipt proves a bounded occurrence; it does not establish value.
- Value is receiver- and locality-relative.
- Proof is not authority.
- Progression is accumulated capability, relation, lineage, and opened possibility — not a universal XP number.
- A door becoming available does not compel anyone to cross it.
- **A tenet is an invitation with provenance, not a command with jurisdiction.**
- Ignoring an affordance is a valid disposition and need not produce a trace.
- **The same crossing may lawfully produce different local consequences.**
- Transport does not carry source jurisdiction into the destination.
- **A signed address is not the payload; admitted payload bytes are still independently verified.**
- REFUSE does not require payload fetch.
- **Retrieval path does not define world-seed identity.**
- Provider availability is not authority.
- **Discovery may reveal candidate roads; it does not define the seed or authorize the road.**
- **Discovery consensus is not required for seed identity.**
- **A descendant may preserve lineage without preserving the ancestor's road or inheriting its authority.**
- **Full lineage verification must precede pruning; a checkpoint is a resumability commitment, not history itself.**
- **A successor checkpoint may replace an older checkpoint body only by binding a compact predecessor anchor; root continuity is not full history re-verification.**
- **A fork is multiplicity, not conflict or canon; incompatibility must be declared by a relevant local rule.**
- **Recombination is a fresh local act over co-eligible parents; composition does not canonicalize or erase ancestry.**
- GrO preserves enough trace to make consequence attributable without requiring a single global game-master database.

## Landed proofs

### GENESIS 001 — The map is consequence

> An action leaves an attributable trace that changes what the same locality affords to the next encounter.

### TENET 001 — Leave possibility

> One actor can deliberately leave a bounded future possibility at a place; another actor may later notice, hold, ignore, or act through it without inheriting the author's authority.

### TENET 002 — Cross locality

> One signed tenet crossing may be admitted by one sovereign locality and refused by another; only local admission creates local playability.

### TENET 003 — Addressed world-seed

> A signed crossing may carry only a content address; an admitting locality independently resolves and verifies the addressed bytes before creating local playability, while a refusing locality does not fetch them.

### TENET 004 — Replaceable Roads

> The same addressed world-seed may be retrieved from materially different independent providers and produce the same verified local consequence; one provider may disappear without killing the seed.

### TENET 005 — Discovery is not the provider

> An untrusted discovery layer may suggest stale, duplicate, malformed, or lying provider candidates; only independently verified bytes matching the signed world-seed address may continue toward local playability.

### TENET 006 — Many Maps, One Seed

> Independent discovery systems with disjoint provider sets may disagree about the roads and still converge on the same world-seed and local consequence without directory consensus.

### TENET 007 — Descendant Without Broadcast

> A locally acted-through seed may produce a distinct R10 descendant that moves onto new providers and discovery; later localities can verify and admit the descendant after the ancestor's original provider and map have disappeared.

### TENET 008 — Generations / Pruning

> X → Y → Z can continue without recursively embedding every ancestor bundle: X→Y is fully verified before checkpointing, Y→Z is directly verified, and Z carries a bounded signed ancestry checkpoint that remains explicitly distinct from full historical re-verification.

### TENET 009 — Checkpoint Succession

> X → Y → Z → Q can continue with Q carrying only the newest checkpoint body: CHECKPOINT(Z) binds root(Y) through a compact signed predecessor anchor while older checkpoint history remains explicitly checkpointed rather than re-verified.

### TENET 010 — Fork ≠ Conflict

> Two verified successor checkpoints may lawfully share one predecessor root without producing a canonical winner or conflict; later sovereign localities may admit both, hold one, or declare a specific local incompatibility rule.

## Active proof

### TENET 011 — Recombination Without Collapse

> Two locally admitted, simultaneously eligible fork branches may become explicit parents of a fresh descendant W without canonicalizing, erasing, or inheriting authority from either parent.

## Phone field encounters — GrO FORAGE-001

The first phone-oriented GrO interface is the
[WALL-E Field Scout](apps/field-scout/index.html). It lets a person photograph
a salvage-looking or naturally occurring material candidate, report its
source/land context, describe known hazards, and export the matching Static OS
FORAGE-001 lead, SHA-256 photo evidence and an **actor-local GrO HOLD**.

The GrO encounter is not a permit, property transfer, public field trace or
robot-pickup command. `src/field-forage.js` projects the received record as an
*encounter*, never a pickup action. See
[GrO FORAGE-001 operating guide](docs/FORAGE-001-WALLE-PHONE.md).
The mobile interface requires an HTTPS host before it can be opened from a
phone; code in GitHub is not a live deployment.



## POCKET-DOOR 001 — Textable World Doors (experimental)

The phone-sized [Pocket Doors workbench](apps/pocket-door/index.html) lets a
person manually carry an authored public demonstration door as a text invitation
or content-verified JSON packet, choose one of four locally rendered entrances,
and export a stand-alone offline HTML room. Three sample doors are
`MOSS-042`, `ROSEMARY-001`, and `LIGHT-KEEP-003`.

`src/field-pocket-door.js` projects the verified door as a **GrO
actor-local encounter**, never an authority-bearing action or public trace.
The app **does not** send SMS, host a public `abundent.org/d/` route, accept
arbitrary unsigned worlds, collect recipients, or deploy itself. [Protocol,
tests, and remaining HOLD gates](docs/POCKET-DOOR-001.md).
