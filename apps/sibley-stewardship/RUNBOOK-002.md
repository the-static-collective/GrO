# Sibley Stewardship Relay 002 — running the shared pilot

**Actual implementation:** Node 20+ `relay-server.mjs` with a file-backed report store, a private steward desk, separate witness disposition, SSE read-only updates, and a curated opportunity board. Its world is the **entire Sibley Park locality**, not a fenced-off pilot sector. No new park permissions are conferred by a software map.

**Not implemented / not proven:** production cloud hosting; on-site test; official authorization by City of Mankato, Kiwanis or Blue Earth Project; real partner accounts; verified personal identities; EcoMapper automatic ingestion; Full Measure source-owned Deed minting; treasury receipts, payments, or Penny backing. **No third-party outreach has been sent.**

## Run a same-device prototype

From the GrO repository root:

```sh
npm test

# In the same shell, supply three distinct random 16+ character values.
# Never commit real values, share screenshots of values, or put them in URLs.
export SIBLEY_INVITE_CODE='<locally generated distinct secret>'
export SIBLEY_STEWARD_CODE='<locally generated distinct secret>'
export SIBLEY_WITNESS_CODE='<locally generated distinct secret>'
export SIBLEY_DATA_FILE="$PWD/.local-sibley-state/relay.json"

node apps/sibley-stewardship/relay-server.mjs
```

Open `http://127.0.0.1:8787/` for the park-wide field porch.
Open `http://127.0.0.1:8787/steward.html` for the review/witness desk.
The process refuses to start without three different codes of at least 16 characters. Different codes **do not** establish that two different, authorized human witnesses exist.

The state file remains on the server machine and is not a public asset. Do not commit or email it: raw report notes and coarse submitted locations are private steward information. Back it up with appropriate retention rules and encrypt backups if real reports ever enter.

## Source-to-public round trip

1. A participant creates a device-local report on the map. Its original local record stays on that device.
2. **Explicit SEND** requires a field invitation code, disclosure confirmation, and a separate opt-in if any curated public-safe summary is permitted. The server checks consent and moves the submission into private steward HOLD.
3. A steward with a separate code reads private records, checks facts outside the software, and may HOLD, REFUSE, or PUBLISH a separately written **public-safe summary**. No raw notes or original coordinate data are copied into the public board.
4. SSE announces publication/review changes to connected browsers. The public board refreshes without a page reload; no worker location or private report is streamed.
5. From a published record the steward can create a **new GrO quest possibility**. Observation-only proposals have a public unapproved label. Cleanup quests always display **awaiting official authorization**; the relay does not assign a team or direct physical work.
6. For a steward-published cleanup claim, a **separately coded human witness** can record CONFIRM, DISPUTE or HOLD, affirming independent knowledge and work authorization for CONFIRM. That creates only a **source-labelled Deed candidate**. It is not a source-owned Full Measure Deed; signatures/verified identities and event-organizer admission are still missing.
7. A steward-authenticated `GET /api/steward/deed-candidates` endpoint returns a minimal, **non-authoritative** `gro/full-measure-candidates/v0.1` envelope only for separately affirmed cleanup reports that were published with contributor consent. It carries no original field note or location pin, no person identity proof and no automatic Full Measure admission; a receiving authority must HOLD pending separate review.
8. If funds are ultimately allocated to a duly eligible organization, **cash receipt and any authorized transfer to a Penny reserve remain outside this software** and follow the separate Treasury proposal. There is no automated hours-to-money ratio.

## Real-time guarantee — and its limits

SSE updates are immediate **while a browser has an active connection to the same running Node process**. Reports are synchronously persisted in a JSON file. It is not multi-instance safe, has no offline replay queue, authentication provider, DDoS protection, disaster recovery, geo-fenced verified GIS geometry, or audit-log signing. The only automatically public reports are curated summaries.

Default binding is `127.0.0.1`. **Do not expose this experimental relay directly to the internet.** A remote trial needs an HTTPS reverse proxy, access controls, rate protections, security review, properly configured persistent disk/DB, designated reviewers, appeal and takedown procedures, and consent/retention policies. Never run it as an ephemeral Vercel Function expecting file persistence or persistent SSE connections. Keep access secrets in server environment only. Do not place them in frontend JavaScript or in a public repository.

## Program permissions and next external gates

- **City of Mankato** — confirm park-wide observation and cleanup procedures, protected areas and access restrictions. City lists park, trail and stormwater cleanups among volunteer opportunities: https://www.mankatomn.gov/about-mankato/volunteer-opportunities. Phone listed: (507) 387-8621.
- **Kiwanis Holiday Lights** — ask how a new team can participate through an existing nonprofit or future waiting list, and whether environmental reporting can be included. Event volunteer contact: volunteer@kiwanisholidaylights.com; the volunteer page currently says nonprofit groups are at capacity.
- **Blue Earth Project / EcoMapper** — propose opt-in read-only evidence exchange with an owner-approved data dictionary, observation sampling method, permissions and attribution; never scrape private maps, badges or participant profiles.
- **Brian Schneider / MSU contact** — offer a technical/volunteer relay prototype, not a claim that he controls Kiwanis or city operations.
- **Penny custodian** — identify actual beneficiary and lawful cash custodian before any public statement of a funded reserve.

## Three proof tests after obtaining permission

**Human:** One participant submits a private report, steward curates a summary, and a distinct actual witness records a supported disposition.

**Environmental:** One observation's description is reconciled against an agreed Blue Earth Project method and its exact source/date, without treating the field report as a scientific assessment.

**Economic:** One legitimate grant or donation (if any) is independently recorded as received by its eligible custodian and restricted/appropriated under authorized rules; no reported volunteer hour becomes money.

## Repo trails

- Whole-park locality and offline field porch: [GrO PR #30](https://github.com/the-static-collective/GrO/pull/30)
- Shared review / SSE / opportunities: [GrO PR #31](https://github.com/the-static-collective/GrO/pull/31)
- Penny reserve design, no live funds: [Jubilee Treasury PR #26](https://github.com/the-static-collective/Jubilee-treasury/pull/26)

**Permissions not yet obtained. Projects remain independent. Proposal ≠ admission. Report ≠ witness. Witness ≠ authorized Deed. Allocation ≠ cash received.**
