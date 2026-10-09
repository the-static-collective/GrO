// GrO POSTAL-ENCOUNTER-001 — local-only possibility from a portable
// GHoT two-phone SYNTHETIC custody claim. No ledger or public world trace.
// Input is an independently reviewed, minimized descriptor, never a
// source-signed, certified transport event. The caller owns crypto checks.

const SHA = /^[0-9a-f]{64}$/;
const ROUTE = /^[a-z][a-z0-9-]{2,63}$/;
const CHOICES = Object.freeze(["notice","hold","refuse","leave-open"]);

function assert(condition, message) {if(!condition)throw Error(message);}

export function inspectPostalEncounterDescriptor(value) {
  assert(value && typeof value === "object" && !Array.isArray(value),
         "POSTAL_DESCRIPTOR_OBJECT_REQUIRED");
  assert(Object.keys(value).sort().join("|") === [
    "classification","history_head","parcel_sha256","route_id","source",
  ].sort().join("|"), "POSTAL_DESCRIPTOR_EXTRA_OR_MISSING_FIELDS");
  assert(value.source==="GHoT-POSTAL-CORPS-003" &&
         value.classification==="SYNTHETIC_CUSTODY_CLAIM_ONLY" &&
         ROUTE.test(value.route_id) && SHA.test(value.parcel_sha256) &&
         SHA.test(value.history_head), "POSTAL_DESCRIPTOR_OUTSIDE_SIMULATION");
  // This does NOT verify a GHoT signature or the physical meaning of events.
  return Object.freeze({
    schema:"gro.postal-encounter-descriptor/v0",
    source:"GHoT-POSTAL-CORPS-003",
    route_id:value.route_id,
    parcel_sha256:value.parcel_sha256,
    history_head:value.history_head,
    source_verification:"UNVERIFIED_EXTERNAL_IMPORT",
    physical_custody:"NOT_ESTABLISHED",
  });
}

export function projectPostalEncounter({
  descriptor, place, actor, traces=[], choice="notice",
}) {
  const checked=inspectPostalEncounterDescriptor(descriptor);
  assert(place && typeof place.id==="string" && place.id==="place:local-pocket",
         "POSTAL_PLACE_MUST_BE_LOCAL");
  assert(actor && typeof actor.id==="string" && actor.id==="actor:local-holder",
         "POSTAL_ACTOR_MUST_BE_LOCAL");
  assert(Array.isArray(traces) && CHOICES.includes(choice),
         "POSTAL_CHOICE_INVALID");
  const affordance={
    id:"postal-inspect:"+checked.history_head,
    kind:"encounter",label:"Review an unverified synthetic handoff",
    sourceHistoryHead:checked.history_head,
    because:["external-signed-claim-may-be-inspected","physical-custody-not-established"],
    dispositions:CHOICES,
    permission:"NONE",actorLocal:true,
  };
  // All choices, including HOLD/REFUSE, are actor-local observations.
  return {
    schema:"gro.postal-local-field-projection/v0",
    descriptor:checked,choice,placeId:place.id,actorId:actor.id,
    field:{schema:"gro.postal-local-field/v0",placeId:place.id,actorId:actor.id,
           affordances:[affordance]},
    traces,publicTraceEmitted:false,
    physicalParcelMoved:false,postalServiceAuthorized:false,
    fullMeasureDeedAwarded:false,pennyUnitsIssued:0,paymentClaimed:false,
    destinationPermission:"NONE",
  };
}
