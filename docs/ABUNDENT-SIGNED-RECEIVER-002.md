# GrO signed reLATTE receiver 002 — bounded local ACCEPT / HOLD

This extends GrO's ABUNDENT-RELATTE-INTAKE-001 without upgrading its earlier unsigned `gro.occurrence-receipt.v0` to sovereign authority.

## Local operation

```sh
node examples/receive-abundent-signed-002.js /path/to/lemonpress-relatte-arrival-001.json /safe/local/gro-receiver-001
```

The input must be the exact pinned, individually verified public LemonPRESS catalog carrier. The destination is `world:gro-local-review`. If the local receiver directory is absent, the operator creates a fresh persistent P-256 signer, restricted local `receiver-key.json`, and a reLATTE-shaped config. **No key material may be committed, uploaded, shared, or placed in webZ public files.** Reopening requires the same directory and same key.

The action writes `journal.json` **once** (create-only) with two separately signed receipts and two hash-linked events:
- **RECEIVED:** `semantic_effect=none`, receive receipt identifier, unchanged original crossing.
- **R3_HOLD:** `semantic_effect=none`, link to original RECEIVE, and separate post-HOLD local state reference.

On a second delivery the code checks the previously stored journal and key and returns its prior record. It never re-signs an already received crossing or resets its key. On a mismatch, malformed journal, or unexpected operator configuration, it refuses rather than silently repairing.

The journal is a bounded **single-crossing append-once proof**, not reLATTE's general multi-article append-only journal engine. It has no remote network listener, multi-process lock service or fleet-grade key management.

`journal.json` is a **portable public-review candidate** and includes the original public source bytes, crossing, signed receipts and receiver public key, but **not** the private key. It remains unshared unless the human deliberately carries it elsewhere.

## Verifications

- `test/abundent-signed-receiver.test.js` checks real signatures, state references, local key persistence, cold replay, duplicates and tampering.
- `examples/abundent-relatte-compatibility-002.mjs` calls the pinned reLATTE `verifyReceipt` and `verifyCrossingEnvelope` directly under GrO CI. The receipt bytes must be accepted by the **independent protocol implementation**.
- webZ's `/arrivals/receipts/` reader checks the same formal signatures and local chain in WebCrypto.

## Authority

The public key's fingerprint can be independently compared through a pretrusted channel, but the signed journal itself does not bind the process to the Static Collective as a real-world operator. Nor does the original experimental signed crossing authenticate LemonPRESS's publisher. The process has created real cryptographic **receiver-local** reLATTE-format receipts, but it claims only a single process's local action, not a network service or global admission.

```text
LOCAL SIGNATURE != LEGAL OR HUMAN IDENTITY
RECEIVE != ADMIT
HOLD != PUBLISH
EXPORTED JOURNAL != INDEPENDENT MIRROR
DUPLICATE DELIVERY != REDECISION
```

No production site change, public signer endpoint, private manuscript delivery, automatic newsletter delivery, or DNS changes.
