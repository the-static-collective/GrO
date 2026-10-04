import { createHash } from "node:crypto";
import { createServer } from "node:http";

import { stableStringify } from "./stable.js";

function nonEmpty(value, code) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(code);
  return value;
}

function bytesOf(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  throw new Error("INVALID_DISCOVERED_PROVIDER_BYTES");
}

function requireSha256Address(value) {
  const address = nonEmpty(value, "INVALID_DISCOVERY_ADDRESS");
  if (!/^sha256:[0-9a-f]{64}$/.test(address)) {
    throw new Error("INVALID_DISCOVERY_ADDRESS");
  }
  return address;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function candidateId(body) {
  return `gro-provider-candidate-v0:${sha256(
    Buffer.from(stableStringify(body), "utf8")
  )}`;
}

function normalizeCandidate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_DISCOVERY_CANDIDATE");
  }

  const kind = nonEmpty(value.kind, "INVALID_DISCOVERY_CANDIDATE_KIND");
  if (kind !== "file" && kind !== "http") {
    throw new Error("UNSUPPORTED_DISCOVERY_CANDIDATE_KIND");
  }

  const providerId = nonEmpty(
    value.providerId,
    "INVALID_DISCOVERY_PROVIDER_ID"
  );
  const locator = nonEmpty(value.locator, "INVALID_DISCOVERY_LOCATOR");

  if (kind === "http") {
    let parsed;
    try {
      parsed = new URL(locator);
    } catch {
      throw new Error("INVALID_DISCOVERY_HTTP_URL");
    }
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error("INVALID_DISCOVERY_HTTP_URL");
    }
  }

  const body = {
    providerId,
    kind,
    locator
  };

  return {
    ...body,
    candidateId: candidateId(body)
  };
}

export function projectDiscoveryObservation(value) {
  if (!Array.isArray(value)) {
    return {
      status: "unknown",
      candidates: [],
      ignored: [
        {
          reason: "DISCOVERY_OBSERVATION_NOT_ARRAY"
        }
      ]
    };
  }

  const candidates = [];
  const ignored = [];
  const seen = new Set();

  for (const entry of value) {
    try {
      const candidate = normalizeCandidate(entry);
      if (seen.has(candidate.candidateId)) {
        ignored.push({
          reason: "DUPLICATE_CANDIDATE",
          candidateId: candidate.candidateId
        });
        continue;
      }
      seen.add(candidate.candidateId);
      candidates.push(candidate);
    } catch (error) {
      ignored.push({
        reason: error instanceof Error ? error.message : "INVALID_CANDIDATE"
      });
    }
  }

  return {
    status: candidates.length > 0 ? "candidates-observed" : "no-candidate-observed",
    candidates,
    ignored
  };
}

export async function retrieveVerifiedFromDiscovery({
  address,
  discover,
  materializeProvider
}) {
  const target = requireSha256Address(address);
  if (typeof discover !== "function") throw new Error("DISCOVERY_REQUIRED");
  if (typeof materializeProvider !== "function") {
    throw new Error("PROVIDER_MATERIALIZER_REQUIRED");
  }

  let observation;
  try {
    observation = await discover(target);
  } catch (error) {
    const failure = new Error("DISCOVERY_UNKNOWN");
    failure.cause = error;
    failure.discovery = {
      status: "unknown",
      candidates: [],
      ignored: []
    };
    throw failure;
  }

  const projected = projectDiscoveryObservation(observation);
  if (projected.status === "unknown") {
    const failure = new Error("DISCOVERY_UNKNOWN");
    failure.discovery = projected;
    throw failure;
  }
  if (projected.candidates.length === 0) {
    const failure = new Error("NO_PROVIDER_CANDIDATE_OBSERVED");
    failure.discovery = projected;
    throw failure;
  }

  const attempts = [];

  for (const candidate of projected.candidates) {
    let provider;
    try {
      provider = await materializeProvider(candidate);
      if (!provider || typeof provider.resolve !== "function") {
        throw new Error("CANDIDATE_NOT_MATERIALIZED");
      }
    } catch (error) {
      attempts.push({
        candidateId: candidate.candidateId,
        providerId: candidate.providerId,
        kind: candidate.kind,
        status: "not-materialized",
        error: error instanceof Error ? error.message : "materialization_failed"
      });
      continue;
    }

    try {
      const bytes = bytesOf(await provider.resolve(target));
      const actual = `sha256:${sha256(bytes)}`;
      if (actual !== target) {
        attempts.push({
          candidateId: candidate.candidateId,
          providerId: candidate.providerId,
          kind: candidate.kind,
          status: "address-mismatch",
          actualAddress: actual
        });
        continue;
      }

      attempts.push({
        candidateId: candidate.candidateId,
        providerId: candidate.providerId,
        kind: candidate.kind,
        status: "verified"
      });

      return {
        address: target,
        bytes,
        candidate,
        attempts,
        discovery: projected
      };
    } catch (error) {
      attempts.push({
        candidateId: candidate.candidateId,
        providerId: candidate.providerId,
        kind: candidate.kind,
        status: "provider-failed",
        error: error instanceof Error ? error.message : "provider_failed"
      });
    }
  }

  const failure = new Error("DISCOVERED_CONTENT_UNAVAILABLE");
  failure.attempts = attempts;
  failure.discovery = projected;
  throw failure;
}

export function createHttpDiscoveryServer({ lookup }) {
  if (typeof lookup !== "function") throw new Error("DISCOVERY_LOOKUP_REQUIRED");

  return createServer(async (request, response) => {
    try {
      if (request.method !== "GET") {
        response.statusCode = 405;
        response.end();
        return;
      }

      const prefix = "/discover/";
      if (!request.url?.startsWith(prefix)) {
        response.statusCode = 404;
        response.end();
        return;
      }

      const address = decodeURIComponent(request.url.slice(prefix.length));
      requireSha256Address(address);
      const observation = await lookup(address);

      response.statusCode = 200;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(JSON.stringify(observation));
    } catch {
      response.statusCode = 500;
      response.end(JSON.stringify({ error: "discovery_failed" }));
    }
  });
}

export async function listenHttpDiscoveryServer(
  server,
  { host = "127.0.0.1" } = {}
) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const bound = server.address();
  if (!bound || typeof bound === "string") {
    throw new Error("DISCOVERY_SERVER_ADDRESS_UNAVAILABLE");
  }

  return `http://${host}:${bound.port}`;
}

export async function closeHttpDiscoveryServer(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export function httpDiscovery({ baseUrl }) {
  const normalized = nonEmpty(baseUrl, "INVALID_DISCOVERY_URL").replace(
    /\/$/,
    ""
  );

  return async function discover(address) {
    const target = requireSha256Address(address);
    const response = await fetch(
      `${normalized}/discover/${encodeURIComponent(target)}`
    );
    if (!response.ok) throw new Error(`HTTP_DISCOVERY_${response.status}`);
    return response.json();
  };
}
