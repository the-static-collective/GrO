# USEFUL LATER 001 — service-for-advance field card

**Status: working, local-only experimental interface. Not a shared marketplace, bank, lender, token exchange, identity service, or financial product.**

> I can do this later. Can somebody help with this small need now?

This sidecar in GrO's phone Field Scout deploy asks whether a specific skill can become an actual small exchange without introducing public reputation scoring or a transferable debt token. The card is a **proposal about a possible relation**, not an enforceable legal instrument created by the software.

## Try it

Open `apps/field-scout/useful-later/index.html` in a browser (or serve this directory statically). It works without a login or backend. The page's **Try synthetic example** button only fills the form; it does not create imaginary transactions.

1. Maker records a specific task, estimated time, bounded $0–25 advance request, deadline, and limits.
2. Maker copies the invitation and sends it privately. An offer is not acceptance.
3. A named supporter may make a local advance offer. **The maker records advance receipt only after value was actually received outside this page.**
4. Maker reports work. **The current holder independently confirms** fulfillment; report does not equal confirmation.
5. Optionally, the holder requests a change of who receives the work. The maker must approve and the incoming holder must accept. This is a recorded **consensual change of beneficiary**, not automated trading or legal assignment.
6. Either participant can place a HOLD. The holder can release the service request. Every self-attested event remains in the local history.

Offer cards are stored in `localStorage` on one device. Export a backup; import a card or backup on another device to carry an **unverified copy**. Imports reject incompatible history forks, but there are **no signatures, online sync, delivery receipts, or human identity proofs**. Anyone who can use the device can type any name. The card is therefore only a human-auditable rehearsal/field notebook. **Do not confuse typing another person's name with securing their actual consent.** Confirm all agreements directly outside this app.

## Run the tests

```sh
node --test apps/field-scout/useful-later/test.mjs
```

The tests cover distinct stages, missing receipt, consensual 3-person change, HOLD/release, bad transitions, and append-only replay. They do not establish external identity, real payment, real-world work, or legal enforceability.

## Product boundaries

- No automatic loans, payments, escrow, collections, penalties, interest, credit scores, transferable balances, lending yield, or secondary market.
- No tobacco commerce or age-restricted inventory is sold or facilitated by the page. The skill description field is user-authored.
- No server, tracking pixels, third-party scripts, API keys, geolocation, or account data.
- No personally sensitive information should be put on exported/public cards. Backups are plain JSON.
- `$25` is a UI experiment cap, **not** a statement of legal exemption.
- Actual agreements, employment law, consumer protections, licensing, taxes, and local rules are external to the software. Don't treat a digital card as legal advice or a signed agreement.

## Next field proof

One maker; one willing supporter; one small skill; one externally acknowledged exchange. Record offer → actual receipt → reported work → other person's confirmation. Capture what friction occurred and whether the task really helped. A live multi-device implementation requires authenticated roles, verified consent, secure replay-resistant signed receipts, abuse controls, cancellation/restitution/dispute processes, privacy review, and legal analysis before transferring legal claims or processing payments.

Architectural neighbors (not implemented integrations): BananaSpork's Help Slip/HOLD and separately confirmed participation; Jubilee Campfire's offer/accept/report/confirm; reLATTE's crossing custody; Full Measure's non-score capacity projection. A local UI event has **not** been admitted as a shared ledger fact.

**ONE CLAIM ≠ TWO PEOPLE'S AGREEMENT. REPORT ≠ CONFIRMATION. HOLDER CHANGE ≠ TRADED CURRENCY.**
