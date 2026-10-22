import test from "node:test";
import assert from "node:assert/strict";
import { receiveDoorPacket } from "../src/door-packet.js";

const packet = {
  schema: "static.door-packet/0.1",
  packetRef: "door:upper-room:001",
  source: { system: "upper-room", sourceRef: "selection:john-1-5", doorKind: "selection" },
  anchor: { translationId: "webp", book: "JHN", chapter: 1, startVerse: 5, endVerse: 5 },
  disclosure: {
    includesPrivateText: false,
    includesHumanNote: false,
    includesParticipantIdentity: false,
  },
  authority: null,
  requestedEffect: null,
};

test("the same door can be admitted locally or refused without acquiring global authority", () => {
  const admitted = receiveDoorPacket(packet, {
    localityRef: "room:A",
    disposition: "admit",
    localAffordanceRef: "affordance:open-scripture-door",
  });
  const refused = receiveDoorPacket(packet, {
    localityRef: "room:B",
    disposition: "refuse",
  });

  assert.equal(admitted.status, "admitted");
  assert.equal(admitted.playable, true);
  assert.equal(admitted.localAffordanceRef, "affordance:open-scripture-door");
  assert.equal(refused.status, "refused");
  assert.equal(refused.playable, false);
  assert.equal(admitted.packet.authority, null);
  assert.equal(admitted.authority, null);
  assert.deepEqual(admitted.packet, packet);
  assert.equal(refused.packet.packetRef, admitted.packet.packetRef);
});

test("admission requires an explicit local affordance", () => {
  assert.throws(
    () => receiveDoorPacket(packet, { localityRef: "room:A", disposition: "admit" }),
    /local affordance/i,
  );
});
