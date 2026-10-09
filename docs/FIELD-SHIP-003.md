# FIELD-SHIP-003 — The Static Field Ship

**Status:** Executable, entirely synthetic planning experiment. No vehicle has
been started, inspected, repaired, moved, licensed or judged roadworthy.

**Base branch:** `experiment/property-002-private-site-readiness` (GrO
PROPERTY-002 draft PR #25); no change to GrO main.

## One decision, three independent particulars

The intended outcome is a **mobile** computing and creative node (the
Static Field Ship), not an indefinitely stationary workshop.

1. **Ship:** a vehicle with its own title, possession, registration,
   insurance, mechanical and qualified-driver/tow requirements.
2. **Hangar:** the land/house where repairs might be staged, subject
   to its separate lawful steward(s) and occupants. Land ownership does
   not itself establish consent for repairs, electrical work, use of the
   house, or vehicle departure.
3. **Other land candidate:** a **separate** site from the current
   hangar, as reported by the participant. The code can preserve
   `relation_to_other_land_candidate: "participant-reported-distinct"`.
   This is a factual input for planning, **not independently verified**
   geometry, ownership, consent or documentary evidence. There is no
   automatic link to that land's private candidate ID.

The **only** current real-world inputs from conversation are a user
description of a broken-down bus, an image of an older vehicle title,
a statement about RV insurance, and a statement about family control
of its present parking location. None is committed as a real record
and none independently confirms current legal title, a valid policy,
qualified operation or roadworthiness.

**Don't upload the VIN, title photo, exact house location, policy
numbers, identifying occupancy information or private notes into
GitHub, the public PR, or CI fixtures.**

## Road revival stages

| Stage | Goal | Actual guard |
|---|---|---|
| 0. Desktop intake | Organize existing information without touching equipment | Candidate IDs only, no authorization |
| 1. Records and hangar consent | Verify authority, lawful storage, inspection and departure access | Separate land and vehicle review |
| 2. Qualified condition assessment | Document what actually failed and inspect brakes, tires, steering, fuel/cooling, electrical, structure | Qualified, owner-approved inspection |
| 3. Repair decision | Estimate critical safety repairs, availability of parts and labor | Separate human work authorization and estimates |
| 4. Select route | Compare safe self-propelled repair versus professional tow/transport | Different mechanical and driver/tow evidence gates |
| 5. Safe road return | Confirm jurisdictional documents, classification, actual insurance use, driver and legal road test | Independent regulatory and mechanical release; not conferred by GrO |
| 6. Fit-out | Integrate battery/power, computing, networking, radios and GrO encounters | Only permitted and appropriately installed systems |

**Do not try starting, driving or towing a mechanically compromised bus
as a shortcut past a professional safety assessment.** A professional
tow method still needs safe structural/towing assessment, proper
equipment, weight/dimension/route constraints and appropriate operator.
Disconnecting/using house utilities requires separate consent and
qualified installations as applicable, not improvised wiring.

A motor-vehicle title is not in itself evidence of current registration,
insurance coverage, legal occupancy, an RV classification for every
purpose, or operability. Review jurisdiction-dependent requirements
once the vehicle's location, titled state and planned road route
are independently established.

## Code

- `src/field-ship.js` introduces strict, address-free
  `makeStagingBase()` and `makeFieldShipChecklist()` models.
- `assessFieldShip` projects different `self-propelled`,
  `professional-tow` and `undecided` review paths.
- `SHIP_CHECKS` spans brake/parking brake, steering/suspension,
  wheels and axles, structural integrity, engine/cooling/fuel leaks,
  battery/electrical/lighting, weight/dimensions, qualified driver,
  towing points/equipment/operator, route restrictions.
- Staging-base permissions are independently reviewed for storage,
  inspection, repairs, power hookup and departure.
- Records can be missing, claimed, reviewed, revoked or expired;
  out-of-window review is treated as unreviewed.
- Even a complete packet is only
  `READY_FOR_SEPARATE_QUALIFIED_HUMAN_DECISION`, not permission
  to operate, tow, connect to utilities, enter property or dispatch
  machinery.
- `makeFieldShipDeskWorkCandidate` returns a valid-form
  **unexecuted** GHoT task.v0 candidate for offline inventory,
  with explicit `vehicle_actuation:false`,
  `network:false`, `physical_work:false`.
- `makeFieldShipCrossingDraft` returns a content-addressed
  **donor-facing proposal** for reLATTE; not a signed reLATTE
  CrossingEnvelope, no R3 admission, no inherited local authority.

### Synthetic rehearsal

```bash
node --test test/field-ship.test.js
node examples/field-ship-003.mjs ./work/field-ship-003
```

This simulates a bus with a *claimed* title source and *claimed*
insurance description, plus an unrelated synthetic staging base. It
produces two identical HOLD decisions for drive and tow (and an
inspection-only plan), plus draft GHoT/reLATTE objects.
No private candidate information is used or exported by the example.

## Crossings after verified mechanical recovery

```text
Consenting vehicle stewardship       Consenting hangar stewardship
              |                                 |
    documentation and checks           separate local permissions
              +---------------+-----------------+
                              |
                  qualified inspection / repair
                              |
                   actual lawful vehicle movement
                              |
              mobile power / battery / thermal budget
                              |
           Static-OS + GHoT + GrO + reLATTE + 11-dial
                              |
       Wi-Fi + BLE + lawful off-grid links + store/forward
```

The digital nodes can be tested while the bus is parked, provided the
site's consent and safe power arrangements permit it. A successful
compute or radio simulation does not prove mechanical or legal
mobility.

## To start an actual field plan

The most useful first facts are *non-sensitive*: jurisdiction where the
bus is parked, whether its present parking site is distinct from the
separately mentioned New Mexico property, and a short description of
why it cannot currently move (won't start, engine/driveline issue,
tires/brakes, body condition, unknown). There is **no need** to share
VIN, title numbers, street address or family contacts.

Then plan an owner/steward-consented inspection and get a qualified
mechanic/transport professional's assessment before recommending any
mechanical action.

## Laws

```text
THE SHIP != THE HANGAR
STORED ON LAND != OWNS LAND
LAND OWNER != VEHICLE TITLE HOLDER
TITLE IMAGE != CURRENT ROAD STATUS
RV POLICY CLAIM != COVERAGE VERIFICATION
INSPECTED != REPAIRED
REPAIRED != ROADWORTHY
TOWED != LEGAL TO DRIVE
COMPUTE CAN RUN != ENGINE CAN RUN
REVIEW COMPLETE != AUTHORIZATION
DOOR != CROSSING
```
