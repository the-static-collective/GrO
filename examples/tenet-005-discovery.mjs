import assert from "node:assert/strict";
import { createServer } from "node:http";
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
import { writeAddressedJson } from "../src/payload-store.js";
import {
  closeHttpContentProvider,
  createHttpContentProviderServer,
  fileContentProvider,
  httpContentProvider,
  listenHttpContentProvider
} from "../src/content-road.js";
import {
  closeHttpDiscoveryServer,
  createHttpDiscoveryServer,
  httpDiscovery,
  listenHttpDiscoveryServer,
  retrieveVerifiedFromDiscovery
} from "../src/discovery.js";

const relatteRoot = resolve(process.argv[2] ?? ".deps/reLATTE");
const relatte = await import(
  pathToFileURL(resolve(relatteRoot, "src/index.ts")).href
);

const base = await mkdtemp(resolve(tmpdir(), "gro-tenet-005-"));
const honestRoot = resolve(base, "provider-honest");
const deadRoot = resolve(base, "provider-dead");

const honestServer = createHttpContentProviderServer({ root: honestRoot });
const liarServer = createServer((_request, response) => {
  const bytes = Buffer.from('{"counterfeit":"seed"}', "utf8");
  response.statusCode = 200;
  response.setHeader("content-type", "application/octet-stream");
  response.setHeader("content-length", String(bytes.length));
  response.end(bytes);
});

let discoveryServer;

try {
  const sourcePlace = { id: "place:source-garden" };
  const sourceAuthor = {
    id: "actor:source-author",
    held: [
      {
        id: "tenet-seed:discovery-001",
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
    occurredAt: "2026-10-04T18:50:00.000Z",
    traces: []
  });
  const sourceTrace = left.traces.find((x) => x.kind === "tenet");
  const payload = makeTenetPayload(sourceTrace);
  const published = await writeAddressedJson(honestRoot, payload);

  const spec = makeAddressedTenetTransferSpec({
    trace: sourceTrace,
    payloadAddress: published.address,
    sourceWorld: "world:gro-room-a",
    sourceHistoryHead: "history:gro-room-a:tenet-005",
    createdAt: "2026-10-04T18:51:00.000Z"
  });

  const crossing = await relatte.sealOpaqueOrganCrossing(
    spec,
    await relatte.generateP256KeyPair()
  );
  assert.equal(await relatte.verifyOpaqueOrganCrossing(crossing), true);

  const receiver = await relatte.LocalReceiver.create(
    resolve(base, "room-b-receiver"),
    {
      world_id: "world:gro-room-b",
      receiver_particular: "receiver:gro-room-b",
      contract_ref: "contract:gro-room-b/v0"
    }
  );

  await receiver.receive(crossing, "2026-10-04T18:51:01.000Z");
  const dispositionReceipt = await receiver.dispose(
    crossing.crossing_id,
    "ADMIT",
    "2026-10-04T18:51:02.000Z",
    {
      note: "Room B admits candidate seed before discovery",
      admit_effect: "gro-addressed-tenet-candidate"
    }
  );

  const honestUrl = await listenHttpContentProvider(honestServer);

  await new Promise((resolveListen, reject) => {
    liarServer.once("error", reject);
    liarServer.listen(0, "127.0.0.1", () => {
      liarServer.off("error", reject);
      resolveListen();
    });
  });
  const liarBound = liarServer.address();
  const liarUrl = `http://127.0.0.1:${liarBound.port}`;

  discoveryServer = createHttpDiscoveryServer({
    lookup: async (address) => {
      assert.equal(address, published.address);
      return [
        {
          providerId: "provider:dead",
          kind: "file",
          locator: "store:dead"
        },
        {
          providerId: "provider:liar",
          kind: "http",
          locator: liarUrl
        },
        {
          providerId: "provider:honest",
          kind: "http",
          locator: honestUrl
        },
        {
          providerId: "provider:honest",
          kind: "http",
          locator: honestUrl
        },
        {
          providerId: "garbage",
          kind: "ftp",
          locator: "ftp://example.invalid/seed"
        }
      ];
    }
  });

  const discoveryUrl = await listenHttpDiscoveryServer(discoveryServer);
  const discover = httpDiscovery({ baseUrl: discoveryUrl });

  const resolved = await retrieveVerifiedFromDiscovery({
    address: published.address,
    discover,
    materializeProvider: async (candidate) => {
      if (candidate.kind === "file") {
        if (candidate.locator !== "store:dead") {
          throw new Error("UNKNOWN_FILE_LOCATOR");
        }
        return fileContentProvider({
          id: candidate.providerId,
          root: deadRoot
        });
      }

      if (candidate.kind === "http") {
        return httpContentProvider({
          id: candidate.providerId,
          baseUrl: candidate.locator
        });
      }

      throw new Error("UNSUPPORTED_PROVIDER_KIND");
    }
  });

  assert.equal(resolved.candidate.providerId, "provider:honest");
  assert.equal(resolved.attempts[0].status, "provider-failed");
  assert.equal(resolved.attempts[1].status, "address-mismatch");
  assert.equal(resolved.attempts[2].status, "verified");

  const local = await interpretAddressedTenetArrival({
    crossing,
    dispositionReceipt,
    destination: {
      worldId: "world:gro-room-b",
      placeId: "place:rain-room"
    },
    resolvePayloadBytes: async () => resolved.bytes,
    localRules: {
      label: "A verified seed was found through an untrusted map.",
      offeredActionLabel: "Refill the community rain bowl",
      requiredHeldKind: "water"
    }
  });

  console.log(JSON.stringify({
    schema: "gro.tenet-005-witness.v0",
    payload_address: published.address,
    discovery_url: discoveryUrl,
    discovery_authoritative: false,
    discovery_status: resolved.discovery.status,
    ignored_discovery_observations: resolved.discovery.ignored,
    attempts: resolved.attempts,
    selected_provider: resolved.candidate.providerId,
    selected_because: "served bytes matched signed sha256 address",
    local_trace_id: local.trace.traceId,
    laws: [
      "DISCOVERY != PROVIDER",
      "DISCOVERED != SELECTED",
      "SELECTED != VERIFIED",
      "PROVIDER CLAIM != SEED IDENTITY",
      "LYING DIRECTORY != LYING WORLD",
      "MAP FAILURE != ROAD ABSENCE"
    ]
  }, null, 2));
} finally {
  await closeHttpContentProvider(honestServer);
  if (liarServer.listening) {
    await new Promise((resolveClose) => liarServer.close(() => resolveClose()));
  }
  if (discoveryServer) {
    await closeHttpDiscoveryServer(discoveryServer);
  }
  await rm(base, { recursive: true, force: true });
}
