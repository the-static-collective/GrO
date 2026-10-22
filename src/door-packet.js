const TOP_KEYS = new Set([
  "schema", "packetRef", "source", "anchor", "disclosure", "authority", "requestedEffect"
]);
const SOURCE_KEYS = new Set(["system", "sourceRef", "doorKind"]);
const ANCHOR_KEYS = new Set(["translationId", "book", "chapter", "startVerse", "endVerse"]);
const DISCLOSURE_KEYS = new Set([
  "includesPrivateText", "includesHumanNote", "includesParticipantIdentity"
]);
const DOOR_KINDS = new Set(["selection", "branch", "return"]);

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const keys = Object.keys(value);
  if (keys.length !== expected.size || keys.some(key => !expected.has(key))) {
    throw new Error(`${label} contains unsupported fields`);
  }
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateDoorPacket(packet) {
  exactKeys(packet, TOP_KEYS, "door packet");
  if (packet.schema !== "static.door-packet/0.1") throw new Error("unsupported door packet schema");
  if (typeof packet.packetRef !== "string" || !packet.packetRef.trim()) throw new Error("packetRef is required");
  if (packet.authority !== null) throw new Error("door packet authority must be null");
  if (packet.requestedEffect !== null) throw new Error("door packet requested effect must be null");

  exactKeys(packet.source, SOURCE_KEYS, "source");
  if (packet.source.system !== "upper-room") throw new Error("unsupported source system");
  if (typeof packet.source.sourceRef !== "string" || !packet.source.sourceRef.trim()) throw new Error("sourceRef is required");
  if (!DOOR_KINDS.has(packet.source.doorKind)) throw new Error("unsupported door kind");

  exactKeys(packet.disclosure, DISCLOSURE_KEYS, "disclosure");
  if (Object.values(packet.disclosure).some(Boolean)) {
    throw new Error("private room material may not cross in door packet v0");
  }

  exactKeys(packet.anchor, ANCHOR_KEYS, "anchor");
  if (typeof packet.anchor.translationId !== "string" || !packet.anchor.translationId.trim()) {
    throw new Error("translationId is required");
  }
  if (typeof packet.anchor.book !== "string" || !packet.anchor.book.trim()) {
    throw new Error("book is required");
  }
  for (const key of ["chapter", "startVerse", "endVerse"]) {
    if (!Number.isInteger(packet.anchor[key]) || packet.anchor[key] < 1) {
      throw new Error(`${key} must be a positive integer`);
    }
  }
  if (packet.anchor.endVerse < packet.anchor.startVerse) throw new Error("verse range must be ordered");
}

export function receiveDoorPacket(packet, {
  localityRef,
  disposition,
  localAffordanceRef = null,
}) {
  validateDoorPacket(packet);
  if (typeof localityRef !== "string" || !localityRef.trim()) {
    throw new Error("localityRef is required");
  }
  if (!["hold", "refuse", "admit"].includes(disposition)) {
    throw new Error("disposition must be hold, refuse, or admit");
  }
  if (disposition === "admit" && (typeof localAffordanceRef !== "string" || !localAffordanceRef.trim())) {
    throw new Error("admission requires an explicit local affordance");
  }
  if (disposition !== "admit" && localAffordanceRef !== null) {
    throw new Error("local affordance is only valid for admission");
  }

  return {
    schema: "gro.door-admission/0.1",
    localityRef,
    status: disposition === "admit" ? "admitted" : disposition === "refuse" ? "refused" : "held",
    playable: disposition === "admit",
    localAffordanceRef: disposition === "admit" ? localAffordanceRef : null,
    packet: copy(packet),
    authority: null,
    law: "ADMISSION IS LOCAL",
  };
}
