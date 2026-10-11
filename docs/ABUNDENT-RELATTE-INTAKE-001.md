# GrO × Abundent / reLATTE 001 — native local HOLD intake

Status: **EXPERIMENT ONLY**. This is a GrO-owned, offline adapter for the exact public LemonPRESS `catalog.yaml` crossing in [webZ PR #49](https://github.com/the-static-collective/webZ/pull/49). No production endpoint, GrO sovereign node signature, operator authentication, or real reLATTE RECEIVED receipt is asserted.

## What exists

- `src/abundent-arrival.js` independently recomputes the original LemonPRESS catalog SHA-256 and Git blob SHA-1, matches the source commit/path pins, reconstructs the reLATTE v0 canonical crossing ID and checks the experimental P-256 signature with Node crypto.
- The experimental key and carrier identity are pinned. The source-world is `world:abundent-experimental-adapter`, **not** a LemonPRESS authority.
- `recordAbundentHold` creates GrO's *own* `gro.occurrence-receipt.v0`, representing an actual explicit local review action. A GrO occurrence receipt is **not** a cryptographically signed reLATTE RECEIVE/disposition receipt.
- `examples/receive-abundent-001.js` requires an input carrier, explicit local output path, actor label and place label. It writes once with create-only semantics and never sends, publishes or overwrites a prior review.
- The signed fixture is an exact copied public carrier from `the-static-collective/webZ`, git blob `48cc256b5b8cb6439b3691e6ba28895d8a1f379e`, source SHA-256 `cbe0bca162dea2d7f828bbb3546f3de3ab7f787084fcc7f4b8b193ca0d866d75`.

## Usage

Export `lemonpress-relatte-arrival-001.json` from the webZ `/arrivals/` experiment or use the pinned test fixture.

```sh
node examples/receive-abundent-001.js path/to/parcel.json /tmp/gro-arrival-hold.json actor:reviewer place:local-review
node --test
```

The operator chooses to produce this local receipt. It does **not** alter reLATTE state or write a new world history for a remote service. The source bytes and crossing are not rewritten. The new receipt claims the local review occurrence only.

## Boundaries

```
EXPERIMENTAL SIGNATURE != PUBLISHER AUTHORITY
VERIFIED REFERENCE != AUTHORIZED REUSE
LOCAL OCCURRENCE != SOVEREIGN RECEIVE
HOLD != ADMIT
LABELLED GRo DESTINATION != GRo WORLD DELEGATION
```

No private keys, external network connections, automatic publication, ownership transfers, user contact records or remote effects are part of this slice.

## Verification

Tests reject changed source content, source Git identity, audience destination, signature, crossing ID, and forged source authority. The CLI test exercises create-only local output and tampered-input refusal.

The **next separate gate** for a real sovereign GrO receiver is an owner-controlled reLATTE-compatible local signer, verifiable RECEIVE + disposition receipt chain, restart replay, and publication/privacy review. Do not infer those guarantees from this GrO-local occurrence receipt.
