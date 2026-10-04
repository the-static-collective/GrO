import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { act, resolveField } from "../src/field.js";
import {
  interpretTenetArrival,
  makeTenetTransferSpec
} from "../src/crossing.js";

const relatteRoot = resolve(process.argv[2] ?? ".deps/reLATTE");
const relatte = await import(
  pathToFileURL(resolve(relatteRoot, "src/index.ts")).href
);

const base = await mkdtemp(resolve(tmpdir(), "gro-tenet-002-"));

try {
  const sourcePlace = { id: "place:source-garden" };
  const sourceAuthor = {
    id: "actor:source-author",
    held: [
      {
        id: "tenet-seed:water-crossing-001",
        kind: "tenet-seed",
        label: "Water can continue what happened here.",
        offeredActionLabel: "Water the young tree",
        requiredHeldKind: "water"
      }
    ]
  };

  const sourceField = resolveField({
    place: sourcePlace,
    actor: sourceAuthor,
    traces: []
  });

  const left = act({
    place: sourcePlace,
    actor: sourceAuthor,
    field: sourceField,
    actionId: "leave-tenet",
    occurredAt: "2026-10-04T18:20:00.000Z",
    traces: []
  });

  const sourceTrace = left.traces.find((trace) => trace.kind === "tenet");
  const spec = makeTenetTransferSpec({
    trace: sourceTrace,
    sourceWorld: "world:gro-room-a",
    sourceHistoryHead: "history:gro-room-a:001",
    createdAt: "2026-10-04T18:21:00.000Z",
    returnAddress: "gro:return:room-a"
  });

  const crossing = await relatte.sealOpaqueOrganCrossing(
    spec,
    await relatte.generateP256KeyPair()
  );
  assert.equal(await relatte.verifyOpaqueOrganCrossing(crossing), true);

  const frame = await relatte.makeTransportFrame(
    crossing,
    "file-bundle",
    "2026-10-04T18:21:01.000Z",
    "GrO TENET 002: same crossing -> two sovereign rooms"
  );

  async function deliver({
    name,
    worldId,
    receiverParticular,
    contractRef,
    disposition,
    receivedAt,
    disposedAt
  }) {
    const bundlePath = resolve(base, `${name}.crossing.json`);
    await relatte.writeFileBundle(bundlePath, frame);
    const delivered = await relatte.readFileBundle(bundlePath);

    const receiver = await relatte.LocalReceiver.create(
      resolve(base, name),
      {
        world_id: worldId,
        receiver_particular: receiverParticular,
        contract_ref: contractRef
      }
    );

    const receiveReceipt = await receiver.receive(
      delivered.crossing,
      receivedAt
    );

    const dispositionReceipt = await receiver.dispose(
      crossing.crossing_id,
      disposition,
      disposedAt,
      disposition === "ADMIT"
        ? {
            note: "Room B locally admits a candidate GrO tenet",
            admit_effect: "gro-local-tenet-candidate"
          }
        : {
            note: "Room C keeps its field unchanged"
          }
    );

    const sovereign = relatte.buildSovereignResponseBundle(
      receiver,
      crossing.crossing_id
    );
    assert.equal(
      await relatte.verifySovereignResponseBundle(
        sovereign,
        crossing.crossing_id
      ),
      true
    );

    return {
      receiveReceipt,
      dispositionReceipt,
      sovereign
    };
  }

  const roomB = await deliver({
    name: "room-b",
    worldId: "world:gro-room-b",
    receiverParticular: "receiver:gro-room-b",
    contractRef: "contract:gro-room-b/v0",
    disposition: "ADMIT",
    receivedAt: "2026-10-04T18:21:02.000Z",
    disposedAt: "2026-10-04T18:21:03.000Z"
  });

  const roomC = await deliver({
    name: "room-c",
    worldId: "world:gro-room-c",
    receiverParticular: "receiver:gro-room-c",
    contractRef: "contract:gro-room-c/v0",
    disposition: "REFUSE",
    receivedAt: "2026-10-04T18:21:04.000Z",
    disposedAt: "2026-10-04T18:21:05.000Z"
  });

  assert.equal(
    roomB.receiveReceipt.crossing_id,
    roomC.receiveReceipt.crossing_id
  );
  assert.equal(roomB.receiveReceipt.kind, "RECEIVED");
  assert.equal(roomC.receiveReceipt.kind, "RECEIVED");
  assert.equal(roomB.dispositionReceipt.kind, "R3_ADMIT");
  assert.equal(roomC.dispositionReceipt.kind, "R3_REFUSE");

  const roomBLocal = interpretTenetArrival({
    crossing,
    dispositionReceipt: roomB.dispositionReceipt,
    destination: {
      worldId: "world:gro-room-b",
      placeId: "place:rain-room"
    },
    localRules: {
      label: "A carried invitation reached the Rain Room.",
      offeredActionLabel: "Refill the community rain bowl",
      requiredHeldKind: "water"
    }
  });

  const roomCLocal = interpretTenetArrival({
    crossing,
    dispositionReceipt: roomC.dispositionReceipt,
    destination: {
      worldId: "world:gro-room-c",
      placeId: "place:quiet-room"
    }
  });

  assert.equal(roomBLocal.status, "admitted");
  assert.ok(roomBLocal.trace);
  assert.equal(roomCLocal.status, "not-admitted");
  assert.equal(roomCLocal.trace, null);

  const roomBWalker = {
    id: "actor:room-b-walker",
    held: [{ id: "water:bottle-001", kind: "water" }]
  };
  const roomBField = resolveField({
    place: { id: "place:rain-room" },
    actor: roomBWalker,
    traces: [roomBLocal.trace]
  });
  const roomCField = resolveField({
    place: { id: "place:quiet-room" },
    actor: roomBWalker,
    traces: []
  });

  assert.ok(
    roomBField.affordances.some((a) => a.id.startsWith("through-tenet:"))
  );
  assert.equal(
    roomCField.affordances.some((a) => a.id.startsWith("encounter-tenet:")),
    false
  );

  console.log(JSON.stringify({
    schema: "gro.tenet-002-witness.v0",
    same_crossing_id: crossing.crossing_id,
    room_b: {
      relatte_disposition: roomB.dispositionReceipt.kind,
      gro_status: roomBLocal.status,
      local_action:
        roomBLocal.trace.tenet.offeredActionLabel,
      playable: true
    },
    room_c: {
      relatte_disposition: roomC.dispositionReceipt.kind,
      gro_status: roomCLocal.status,
      playable: false
    },
    laws: [
      "SAME CROSSING != SAME CONSEQUENCE",
      "TRANSPORT != ADMISSION",
      "SOURCE AUTHORITY != DESTINATION AUTHORITY",
      "LOCAL ADMISSION CREATES LOCAL PLAYABILITY"
    ]
  }, null, 2));
} finally {
  await rm(base, { recursive: true, force: true });
}
