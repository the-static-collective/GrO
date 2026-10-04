import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { act, resolveField } from "../src/field.js";
import {
  interpretAddressedTenetArrival,
  makeAddressedTenetTransferSpec,
  makeTenetPayload
} from "../src/crossing.js";
import {
  readAddressedBytes,
  writeAddressedJson
} from "../src/payload-store.js";

const relatteRoot = resolve(process.argv[2] ?? ".deps/reLATTE");
const relatte = await import(
  pathToFileURL(resolve(relatteRoot, "src/index.ts")).href
);

const base = await mkdtemp(resolve(tmpdir(), "gro-tenet-003-"));

try {
  const roadStore = resolve(base, "content-road");

  const sourcePlace = { id: "place:source-garden" };
  const sourceAuthor = {
    id: "actor:source-author",
    held: [
      {
        id: "tenet-seed:water-addressed-001",
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
    occurredAt: "2026-10-04T18:30:00.000Z",
    traces: []
  });

  const sourceTrace = left.traces.find((trace) => trace.kind === "tenet");
  const payload = makeTenetPayload(sourceTrace);
  const published = await writeAddressedJson(roadStore, payload);

  const spec = makeAddressedTenetTransferSpec({
    trace: sourceTrace,
    payloadAddress: published.address,
    sourceWorld: "world:gro-room-a",
    sourceHistoryHead: "history:gro-room-a:tenet-003",
    createdAt: "2026-10-04T18:31:00.000Z",
    returnAddress: "gro:return:room-a"
  });

  assert.equal(spec.donor_claims.tenet, undefined);

  const crossing = await relatte.sealOpaqueOrganCrossing(
    spec,
    await relatte.generateP256KeyPair()
  );
  assert.equal(await relatte.verifyOpaqueOrganCrossing(crossing), true);

  const frame = await relatte.makeTransportFrame(
    crossing,
    "file-bundle",
    "2026-10-04T18:31:01.000Z",
    "GrO TENET 003: address crosses; payload stays independently resolvable"
  );

  async function receiveIn({
    name,
    worldId,
    receiverParticular,
    contractRef,
    disposition,
    receivedAt,
    disposedAt
  }) {
    const receiver = await relatte.LocalReceiver.create(
      resolve(base, name),
      {
        world_id: worldId,
        receiver_particular: receiverParticular,
        contract_ref: contractRef
      }
    );

    const bundlePath = resolve(base, `${name}.crossing.json`);
    await relatte.writeFileBundle(bundlePath, frame);
    const delivered = await relatte.readFileBundle(bundlePath);

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
            note: "destination admits addressed GrO seed",
            admit_effect: "gro-addressed-tenet-candidate"
          }
        : {
            note: "destination refuses before payload fetch"
          }
    );

    return { receiveReceipt, dispositionReceipt };
  }

  const admitted = await receiveIn({
    name: "room-b",
    worldId: "world:gro-room-b",
    receiverParticular: "receiver:gro-room-b",
    contractRef: "contract:gro-room-b/v0",
    disposition: "ADMIT",
    receivedAt: "2026-10-04T18:31:02.000Z",
    disposedAt: "2026-10-04T18:31:03.000Z"
  });

  const refused = await receiveIn({
    name: "room-c",
    worldId: "world:gro-room-c",
    receiverParticular: "receiver:gro-room-c",
    contractRef: "contract:gro-room-c/v0",
    disposition: "REFUSE",
    receivedAt: "2026-10-04T18:31:04.000Z",
    disposedAt: "2026-10-04T18:31:05.000Z"
  });

  let admittedFetches = 0;
  const roomB = await interpretAddressedTenetArrival({
    crossing,
    dispositionReceipt: admitted.dispositionReceipt,
    destination: {
      worldId: "world:gro-room-b",
      placeId: "place:rain-room"
    },
    resolvePayloadBytes: async (address) => {
      admittedFetches += 1;
      return readAddressedBytes(roadStore, address);
    },
    localRules: {
      label: "A verified world-seed reached the Rain Room.",
      offeredActionLabel: "Refill the community rain bowl",
      requiredHeldKind: "water"
    }
  });

  let refusedFetches = 0;
  const roomC = await interpretAddressedTenetArrival({
    crossing,
    dispositionReceipt: refused.dispositionReceipt,
    destination: {
      worldId: "world:gro-room-c",
      placeId: "place:quiet-room"
    },
    resolvePayloadBytes: async () => {
      refusedFetches += 1;
      throw new Error("REFUSED_ROOM_MUST_NOT_FETCH");
    }
  });

  assert.equal(roomB.status, "admitted");
  assert.equal(roomB.payloadResolved, true);
  assert.equal(admittedFetches, 1);
  assert.equal(roomC.status, "not-admitted");
  assert.equal(roomC.payloadResolved, false);
  assert.equal(refusedFetches, 0);

  const walker = {
    id: "actor:room-b-walker",
    held: [{ id: "water:bottle-003", kind: "water" }]
  };
  const field = resolveField({
    place: { id: "place:rain-room" },
    actor: walker,
    traces: [roomB.trace]
  });
  assert.ok(field.affordances.some((item) =>
    item.id.startsWith("through-tenet:")
  ));

  await assert.rejects(
    () =>
      interpretAddressedTenetArrival({
        crossing,
        dispositionReceipt: admitted.dispositionReceipt,
        destination: {
          worldId: "world:gro-room-b",
          placeId: "place:rain-room"
        },
        resolvePayloadBytes: async () =>
          Buffer.from('{"wrong":"seed"}', "utf8")
      }),
    /PAYLOAD_ADDRESS_VERIFICATION_FAILED/
  );

  console.log(JSON.stringify({
    schema: "gro.tenet-003-witness.v0",
    crossing_id: crossing.crossing_id,
    payload_address: published.address,
    carrier_embeds_payload: false,
    admitted_room: {
      disposition: admitted.dispositionReceipt.kind,
      payload_fetches: admittedFetches,
      payload_verified: roomB.payloadResolved,
      playable_action: roomB.trace.tenet.offeredActionLabel
    },
    refused_room: {
      disposition: refused.dispositionReceipt.kind,
      payload_fetches: refusedFetches,
      playable: false
    },
    tampered_payload_rejected: true,
    laws: [
      "CROSSING SIGNATURE BINDS ADDRESS",
      "CONTENT ADDRESS BINDS BYTES",
      "ADDRESS != BYTES",
      "REFUSE != FETCH",
      "ADMIT != TRUST BYTES",
      "VERIFIED BYTES != SOURCE JURISDICTION"
    ]
  }, null, 2));
} finally {
  await rm(base, { recursive: true, force: true });
}
