# Sibley Park Stewardship — whole-park GrO locality 001

**Status: runnable, device-local proposal. Not an approved cleanup operation, production real-time network, or organizational partnership.**

This is the first bounded **real-world locality candidate** for a GrO × Full Measure contribution loop. The **entire park** is one addressable locality; trails, farm, hillside/oak savanna, northern grounds, riverside and event routes are descriptive sub-zones. They are not exclusive ownership, land access licenses, or surveyed polygons. [Locality manifest](locality.json) makes that distinction machine-readable.

## Run

Open `index.html` from a local static server, e.g. from this repository root:

```sh
python3 -m http.server 8080
# http://localhost:8080/apps/sibley-stewardship/
```

No account, token or backend is needed. The prototype can:
- show a Leaflet/OpenStreetMap whole-park **focus** map (requires internet for map tiles; no verified park polygon);
- display example quest types for the whole park;
- capture observation, authorized-cleanup self-report, or prevention proposal with zone, material and **optional** coarse map pin;
- save up to 500 local-only drafts per browser, display them, export explicit JSON, or erase them from that browser;
- label every item `local_hold` / `self_report_unverified`; **never** mint a Deed, Penny, reimbursement or volunteer credit.

No GPS tracking or photograph upload. Map click location is rounded to about 0.001° (~100 m). A broad viewport proximity filter is **not a legal park boundary check**. The app does not upload field reports: they remain in browser storage until exported. Loading this page and its map makes ordinary web requests to the hosting server, the Leaflet CDN and OpenStreetMap tile hosts, which may receive standard connection metadata. Avoid sensitive details in free text because exports may be reshared.

## Shared field relay v0.2 (new, experimental)

A real **single-process, account-free shared pilot** now exists: [Runbook 002](RUNBOOK-002.md). Start `relay-server.mjs` with distinct server-side invitation, steward and witness codes. It serves the whole-park map, the private review desk, a steward-curated public board with SSE refresh, and follow-on quest **proposals**. Volunteers explicitly choose whether to send a local draft and separately consent to any public-safe summary. Private raw notes and even coarse point locations stay off the public board.

This relay is **not hosted on Abundent, not an approved live park cleanup service, not suitable for unattended production use**, and not authorized to mint Full Measure Deeds or Penny value. See the runbook's missing HTTPS, external approvals, abuse management and identity verification gates. The static local-only field porch remains functional without it.

## A real park-wide production service needs additional gates

1. **Park/event scope & safety:** obtain an appropriate agreement with City of Mankato parks staff and Kiwanis before presenting volunteer tasks as authorized; distinguish park-wide observation from event-site physical activity. Avoid waterways, habitat restoration areas, active routes and electrical displays unless supervised by qualified stewards. Schedule and safety procedures govern pickups.
2. **Environmental authority:** ask Blue Earth Project whether EcoMapper is the appropriate existing source of truth for litter categories, photographs, environmental measures and verification. Agree on an import/export contract; do not scrape participant records or silently copy their leaderboard. Provide source timestamps and method (before/during/after, route, weather, area/time sampled) so comparable findings remain comparable.
3. **Live operations:** a separate HTTPS backend with access control, event-scoped roles, moderation, consent, abuse controls and real-time updates is required. It should emit **public-safe aggregate map cells**, never live worker locations. Offline drafts can sync only after a separate explicit SEND decision; user must be able to REFUSE and retain a local draft.
4. **Human confirmation:** self-report → independent reviewer/witness → source-local approved event → Full Measure Deed candidate. A human witness cannot be inferred from an uploaded photo, local checkbox or AI summary. On conflict, retain both accounts and HOLD.
5. **Financial authority:** volunteer scheduling / nonprofit share decisions belong to Kiwanis; no claim of an allocation until formally approved and received. Treasury and Penny must only recognize actual documented receipts held by an authorized entity. No generated XP, logged hours or Deeds convert into redeemable money without a separately designed, reviewed and funded program.

## Suggested crossing contracts

| Crossing | Source and output | Human gate |
| --- | --- | --- |
| GrO field → environmental steward | `gro/sibley-local-export/v0.1` proposed observations; redacted/public-safe subset only | submitter explicit send; steward admission |
| EcoMapper → GrO | reviewed location/material finding with source id, method, observation date, precision | Blue Earth Project consent and mapping agreement |
| GrO → volunteer scheduler | scoped need: zone, risk, supplies, time, headcount, contact through approved organizer | Kiwanis / authorized coordinator accepts task |
| Volunteer report → Full Measure | report id, reviewer id, source records, disposition `admitted/refused/held`; only admitted may become Deed candidate | independent authorized human witness |
| Funding → Treasury / Penny | bank-supported received donation allocation, depositor/holder designation, restriction, eligible uses, actual available balance | organization/treasurer and relevant donor restriction review |

**No imported system obtains authority over its donor merely by receiving a packet.**

## Fund accounting proposal — Penny is downstream, not an incentive currency

Maintain an explicit ledger of documented custody for any future funds:

```sh
donation_allocated   (notice only; no reserve claim)
→ eligibility_verified
→ cash_received       (documented deposit at named legal custodian)
→ restrictions_recorded
→ steward_appropriated (authorized amount available for allowed purposes)
→ expense_authorized
→ disbursed_and_reconciled
```

`PENNY = 1` may remain a constant of account/presentation in existing Collective experiments, **not a declaration that a unit is collateralized, redeemable, issued against volunteered labor or legally equivalent to a cent**. Never display "backed" without actual custodied reserves, restrictions, liabilities and an external reconciliation. Unpaid volunteers are volunteers; the event's organization-level donation program is separate from pay, wages and exchangeable credits.

## First field demonstration

- Ask for an approved park-wide observation role and one or more existing volunteer-group partnerships; the current Kiwanis volunteer website reports participating nonprofit groups at capacity and offers a waitlist / helping existing groups.
- Agree on one *data schema for the entire park*, not a tiny pilot geography. Distinct activities may have different approval status: observing can be open where normal public access is allowed; cleaning active event installations requires authorization.
- Open the static porch, record a few **clearly labelled demonstrations**, and export the proposal bundle. Do not pass it off as real verified environmental data.
- Once the actors agree on review, onboarding and publication, connect a consentful sync service and measurements; only then describe map markers as live, shared, steward-reviewed quests.

## Provenance

- Park: [City of Mankato](https://www.mankatomn.gov/about-mankato/parks-trails-and-recreation/community-parks/sibley-park)
- Event volunteer rules: [Kiwanis Holiday Lights](https://www.kiwanisholidaylights.com/volunteers)
- Environmental platform: [Blue Earth Project EcoMapper](https://blueearthproject.org/)
- Gameplay: [Full Measure — World Layer](https://github.com/the-static-collective/full-measure-world-layer)
- Possible receipt protocol, **not live payment rail**: [Jubilee Treasury](https://github.com/the-static-collective/Jubilee-treasury)

The third parties have **not** endorsed this experiment. Attribution is informational, not a partnership claim.
