import test from "node:test";
import assert from "node:assert/strict";

import { makeReceipt } from "../src/receipt.js";
import { stableStringify } from "../src/stable.js";
import {
  GRO_FRONTIER_DESCENDANT_MEDIA_TYPE,
  addressFrontierDescendantWorldSeed,
  addressGraphFrontierCheckpoint,
  createGraphFrontierCheckpoint,
  localizeFrontierDescendantWorldSeed,
  makeFrontierDescendantWorldSeed,
  makeGraphFrontierCheckpointDraft,
  verifyFrontierDescendantWorldSeed,
  verifyGraphFrontierCheckpoint
} from "../src/graph-frontier.js";

function sha(char) {
  return "sha256:" + char.repeat(64);
}

function parentVerified({
  id,
  address,
  crossingId,
  root,
  subjectCrossingId,
  subjectAddress
}) {
  return {
    checkpointVerified: true,
    successionVerified: true,
    address,
    checkpointCrossing: { crossing_id: crossingId },
    checkpoint: {
      checkpointId: id,
      generation: 2,
      lineageRoot: root,
      subject: {
        crossingId: subjectCrossingId,
        payloadAddress: subjectAddress
      }
    }
  };
}

async function fixture() {
  const parentA = parentVerified({
    id: "checkpoint:za",
    address: sha("a"),
    crossingId: "crossing:checkpoint-za",
    root: "gro-lineage-root-v0:" + "1".repeat(64),
    subjectCrossingId: "crossing:za",
    subjectAddress: sha("c")
  });
  const parentB = parentVerified({
    id: "checkpoint:zb",
    address: sha("b"),
    crossingId: "crossing:checkpoint-zb",
    root: "gro-lineage-root-v0:" + "2".repeat(64),
    subjectCrossingId: "crossing:zb",
    subjectAddress: sha("d")
  });

  const recombinantPayload = {
    schema: "gro.recombinant-world-seed.v1",
    fork: { forkId: "fork:ab" },
    parents: [
      {
        checkpointId: parentA.checkpoint.checkpointId,
        checkpointAddress: parentA.address,
        checkpointCrossingId: parentA.checkpointCrossing.crossing_id,
        lineageRoot: parentA.checkpoint.lineageRoot,
        subject: structuredClone(parentA.checkpoint.subject)
      },
      {
        checkpointId: parentB.checkpoint.checkpointId,
        checkpointAddress: parentB.address,
        checkpointCrossingId: parentB.checkpointCrossing.crossing_id,
        lineageRoot: parentB.checkpoint.lineageRoot,
        subject: structuredClone(parentB.checkpoint.subject)
      }
    ],
    action: {
      receipt: {
        receiptId: sha("e")
      }
    }
  };

  const verifiedW = {
    address: sha("f"),
    payload: recombinantPayload,
    recombinationVerified: true
  };
  const crossingW = {
    crossing_id: "crossing:w",
    parents: ["crossing:za", "crossing:zb"],
    payload_refs: [{ address: verifiedW.address }]
  };
  const commitment = {
    schema: "relatte.receipt-set-commitment/v0",
    commitment_id: "commitment:w",
    world_id: "world:h",
    local_history_head: "history:h",
    receipt_ids: ["receipt:receive-w", "receipt:admit-w"],
    receipt_count: 2,
    receipt_set_root: "relatte-receipt-set-v0:root-h",
    created_at: "2026-10-05T04:30:00Z",
    laws: ["COMMITMENT != HISTORY"]
  };

  const checkpoint = createGraphFrontierCheckpoint({
    verifiedRecombination: verifiedW,
    subjectCrossing: crossingW,
    verifiedParentCheckpoints: [parentB, parentA],
    localReceiptSetCommitment: commitment,
    checkpointWorldId: "world:h",
    createdAt: "2026-10-05T04:31:00Z"
  });
  const addressed = addressGraphFrontierCheckpoint(checkpoint);
  const draft = makeGraphFrontierCheckpointDraft({
    checkpoint,
    checkpointAddress: addressed.address,
    sourceParticular: "receiver:h",
    createdAt: "2026-10-05T04:31:01Z"
  });
  const checkpointCrossing = {
    ...draft,
    crossing_id: "crossing:frontier-w"
  };
  const verifiedFrontier = await verifyGraphFrontierCheckpoint({
    bytes: addressed.bytes,
    expectedAddress: addressed.address,
    checkpointCrossing,
    verifyRelatteCrossing: async () => true,
    verifyReceiptSetCommitmentShape: () => true
  });

  const localW = {
    schema: "gro.trace.v0",
    traceId: "trace:local-w",
    receiptId: "receipt:admit-w",
    kind: "tenet",
    lineage: {
      recombinantCrossingId: "crossing:w",
      recombinantPayloadAddress: verifiedW.address
    }
  };
  const action = makeReceipt({
    occurredAt: "2026-10-05T04:32:00Z",
    actorId: "actor:h",
    placeId: "place:h",
    action: "act-through-tenet",
    inputs: ["receipt:admit-w"],
    outputs: ["trace:tenet-response"],
    priorTraceIds: ["trace:local-w"]
  });
  const response = {
    schema: "gro.trace.v0",
    traceId: "trace:response-v",
    receiptId: action.receiptId,
    sourceActorId: "actor:h",
    kind: "tenet-response",
    relatedTenetTraceId: "trace:local-w",
    authority: "influence-only"
  };
  const directLineage = {
    parentCrossing: crossingW,
    parentAdmissionReceipt: {
      receipt_id: "receipt:admit-w",
      crossing_id: "crossing:w"
    },
    fieldProjection: {
      projection_id: "field:h",
      history_root: "history:h"
    },
    uptake: {
      uptake_id: "uptake:wv",
      ancestor_crossing_id: "crossing:w",
      admitted_receipt_id: "receipt:admit-w",
      field_projection_id: "field:h",
      field_history_root: "history:h"
    }
  };

  const payloadV = makeFrontierDescendantWorldSeed({
    parentLocalTrace: localW,
    actionReceipt: action,
    actionResponseTrace: response,
    descendantTenet: {
      seedId: "seed:v",
      label: "V",
      offeredActionLabel: "Act V",
      requiredHeldKind: null,
      authorId: "actor:h",
      authorControl: false
    },
    directLineageEvidence: directLineage,
    ancestryFrontier: verifiedFrontier
  });
  const addressedV = addressFrontierDescendantWorldSeed(payloadV);
  const crossingV = {
    crossing_id: "crossing:v",
    parents: ["crossing:w"],
    payload_refs: [
      {
        address: addressedV.address,
        role: "cultural-descendant",
        media_type: GRO_FRONTIER_DESCENDANT_MEDIA_TYPE
      }
    ]
  };

  return {
    parentA,
    parentB,
    checkpoint,
    addressed,
    checkpointCrossing,
    verifiedFrontier,
    payloadV,
    addressedV,
    crossingV
  };
}

test("frontier checkpoint carries two compact parent anchors, not parent checkpoint bodies", async () => {
  const { checkpoint } = await fixture();

  assert.equal(checkpoint.parentFrontier.length, 2);
  assert.match(checkpoint.parentFrontierRoot, /^gro-frontier-root-v0:/);
  assert.match(checkpoint.graphRoot, /^gro-graph-root-v0:/);

  const serialized = stableStringify(checkpoint);
  assert.equal(
    serialized.split('"schema":"gro.lineage-checkpoint.v0"').length - 1,
    0
  );
  assert.equal(checkpoint.authority, null);
  assert.equal(checkpoint.semanticEffect, "none");
});

test("signed frontier carrier binds W and both parent checkpoint crossings", async () => {
  const { checkpointCrossing } = await fixture();

  assert.deepEqual(checkpointCrossing.parents, [
    "crossing:checkpoint-za",
    "crossing:checkpoint-zb",
    "crossing:w"
  ]);
  assert.equal(
    checkpointCrossing.extensions.gro_graph_frontier.parent_count,
    2
  );
  assert.equal(
    checkpointCrossing.extensions.gro_graph_frontier.authority,
    null
  );
});

test("frontier tampering fails deterministic root verification", async () => {
  const { addressed, checkpointCrossing } = await fixture();
  const tampered = JSON.parse(addressed.bytes.toString("utf8"));
  tampered.parentFrontier[0].lineageRoot =
    "gro-lineage-root-v0:" + "0".repeat(64);
  const bytes = Buffer.from(stableStringify(tampered), "utf8");

  await assert.rejects(
    () =>
      verifyGraphFrontierCheckpoint({
        bytes,
        expectedAddress: addressed.address,
        checkpointCrossing,
        verifyRelatteCrossing: async () => true,
        verifyReceiptSetCommitmentShape: () => true
      }),
    /GRAPH_FRONTIER_CHECKPOINT_ADDRESS_MISMATCH|GRAPH_FRONTIER_ROOT_MISMATCH|GRAPH_ROOT_MISMATCH/
  );
});

test("later descendant carries one graph frontier and no parent checkpoint bodies", async () => {
  const { payloadV } = await fixture();
  const serialized = stableStringify(payloadV);

  assert.equal(
    serialized.split('"schema":"gro.graph-frontier-checkpoint.v0"').length - 1,
    1
  );
  assert.equal(
    serialized.split('"schema":"gro.lineage-checkpoint.v0"').length - 1,
    0
  );
});

test("V verifies direct W relation plus bounded multi-parent frontier", async () => {
  const { addressedV, crossingV } = await fixture();

  const verified = await verifyFrontierDescendantWorldSeed({
    bytes: addressedV.bytes,
    expectedAddress: addressedV.address,
    descendantCrossing: crossingV,
    verifyRelatteLineage: async () => true,
    verifyRelatteCrossing: async () => true,
    verifyReceiptSetCommitmentShape: () => true
  });

  assert.equal(verified.lineageVerified, true);
  assert.equal(verified.lineageMode, "graph-frontier-resumable");
  assert.equal(verified.frontierParentCount, 2);

  const trace = localizeFrontierDescendantWorldSeed({
    verifiedSeed: verified,
    descendantCrossing: crossingV,
    dispositionReceipt: {
      receipt_id: "receipt:admit-v",
      crossing_id: "crossing:v",
      world_id: "world:i",
      receiver_particular: "receiver:i",
      kind: "R3_ADMIT"
    },
    destination: {
      worldId: "world:i",
      placeId: "place:i"
    }
  });

  assert.equal(trace.lineage.frontierParentCount, 2);
  assert.equal(trace.lineage.ancestryAuthority, false);
  assert.equal(trace.lineage.lineageMode, "graph-frontier-resumable");
});
