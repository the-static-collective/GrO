// GrO POCKET-DOOR 001: project a verified public door as an actor-local
// encounter. Do not put a remote door ID into "action" or world jurisdiction.
import {resolveField} from "./field.js";
import {verifyDoor,enterDoor} from "../apps/pocket-door/pocket-core.mjs";

export async function projectPocketDoorEncounter({
  place, actor, traces=[], packet, subtle=globalThis.crypto?.subtle,
}) {
  if(typeof place?.id!=="string"||!place.id.startsWith("place:"))
    throw Error("ADDRESSABLE_GRo_PLACE_REQUIRED");
  if(typeof actor?.id!=="string"||!actor.id.startsWith("actor:"))
    throw Error("ADDRESSABLE_GRo_ACTOR_REQUIRED");
  const checked=await verifyDoor(packet,subtle);
  const field=resolveField({place,actor,traces});
  const offer={
    id:"pocket-door:"+checked.body.id,
    kind:"encounter",
    label:checked.body.title,
    because:["verified-curated-public-demo-envelope","actor-chose-to-inspect"],
    sourceDoorId:checked.body.id,
    sourceDigest:checked.digest,
    dispositions:["notice","hold","ignore","enter-locally","carry-manually"],
    permission:"NO_ADDITIONAL_AUTHORITY",
    actorLocal:true,
  };
  return {
    schema:"gro.pocket-door-local-field.v0",
    placeId:place.id,
    actorId:actor.id,
    field:{...field,affordances:[...field.affordances,offer]},
    doorPacket:checked,
    doorEncounterId:offer.id,
    traces,
    publicTraceEmitted:false,
    recipientIdentified:false,
    networkTransferPerformed:false,
    signedCrossingCreated:false,
    remoteWorldAdmitted:false,
    permissionToEnterPhysicalSpace:false,
  };
}

export async function selectPocketDoorEntrance({
  packet, entrance="letter", depth=10,
  subtle=globalThis.crypto?.subtle,
}) {
  return enterDoor(packet,entrance,depth,subtle);
}
