# DOOR PACKET 001

GrO receives `static.door-packet/0.1` as a candidate crossing from Upper Room.

The same packet may be treated differently by different sovereign localities:

```text
Room A → ADMIT + explicit local affordance → playable locally
Room B → REFUSE                         → not playable
Room C → HOLD                           → unresolved
```

The packet carries `authority = null` and `requestedEffect = null`. Local ADMIT therefore requires a separately supplied `localAffordanceRef`; the sender cannot choose the GrO consequence.

```text
PACKET != AUTHORITY
ADMISSION IS LOCAL
SAME PACKET != SAME LOCAL CONSEQUENCE
REFUSE != GLOBAL REJECTION
```

The adapter also refuses private room material and unsupported packet fields. It copies the packet into the local result rather than mutating source identity.
