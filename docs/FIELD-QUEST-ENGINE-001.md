# FIELD QUEST ENGINE — GrO encounter adapter 001

**Status:** bounded source-driven GrO experiment; no live geographic quest publication, no physical test evidence, no shared authority plane.

## Cross-repository seam

A Full Measure `static.field-test-entry/v0` source-owned, unfinished physical test can be considered as a GrO tenet seed.

1. Source laboratory publishes a version-pinned gate and a field-unverified proposal, not a physical pass.
2. Full Measure may display it as an optional proposed Quest, but cannot award a Deed.
3. GrO `prepareQuestTenet(entry, {placeId, authorId})` independently validates the entry, content-addresses it and creates a **held tenet seed**, not a public trace.
4. A real local GrO actor must explicitly choose `leave-tenet` through the existing `resolveField` / `act` kernel to make the invitation discoverable at the declared place.
5. A later actor may encounter/ignore/HOLD the invitation. Only an actor with a bounded `field-test-kit` capability can elect an `act-through-tenet` response. This action remains an attributable **attempt/influence trace**, not proof of camera success.
6. Raw measurements, source-owned technical verdict, and human-confirmed Full Measure participation remain separate processes. No claim of network delivery, signed reLATTE RECEIVE, or legal authority arises from a GrO trace.

The prepared seed ID includes SHA-256 of deterministic sorted field-test source bytes. It references a pinned source revision, and changes to the source entry result in a different seed. GrO does not infer trust from a revision-looking string; an actual trusted source fetch/proof gate is future work.

```
LAB SOURCE (FIELD_UNVERIFIED)
        |
        +-> FULL MEASURE QUEST PROPOSAL -> human PLEDGE -> REPORT -> distinct human WITNESS -> DEED
        |
        +-> GrO source digest -> held TENET SEED
                                   |
                              human leave-tenet
                                   |
                              encounter / ignore / HOLD / choose to ACT
                                   |
                              influence-only trace, NOT source verdict
```

## Non-collapse

```
INBOX != LEDGER
GAME ENCOUNTER != TECHNICAL VERDICT
RECEIPT != HUMAN WORTH
TENET INVITATION != COMMAND
LOCAL HOLD != PUBLIC HISTORY
SOURCE REVISION != VERIFIED SOURCE
ATTEMPT != DEED
REFLECTION != PERMISSION
```

## Run

`npm test` runs the existing GrO suite plus the cross-project intake, opt-in publication and agent-boundary tests.

Source: [Full Measure](https://github.com/the-static-collective/full-measure-world-layer), [SKYMIRROR-002](https://github.com/the-static-collective/reLATTE/pull/95), [webZ optical lab](https://github.com/the-static-collective/webZ/pull/9). No neighboring repo is mutated by this adapter.
