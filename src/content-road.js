import { createServer } from "node:http";

import { readAddressedBytes } from "./payload-store.js";

function nonEmpty(value, code) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(code);
  return value;
}

function bytesOf(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  throw new Error("INVALID_PROVIDER_BYTES");
}

function requireProvider(provider) {
  if (!provider || typeof provider !== "object") {
    throw new Error("INVALID_CONTENT_PROVIDER");
  }
  const id = nonEmpty(provider.id, "INVALID_CONTENT_PROVIDER_ID");
  if (typeof provider.resolve !== "function") {
    throw new Error("INVALID_CONTENT_PROVIDER_RESOLVER");
  }
  return {
    id,
    kind: nonEmpty(provider.kind ?? "unknown", "INVALID_CONTENT_PROVIDER_KIND"),
    resolve: provider.resolve
  };
}

export function fileContentProvider({ id, root }) {
  nonEmpty(root, "INVALID_FILE_PROVIDER_ROOT");
  return {
    id: nonEmpty(id, "INVALID_CONTENT_PROVIDER_ID"),
    kind: "file",
    async resolve(address) {
      return readAddressedBytes(root, address);
    }
  };
}

export function createHttpContentProviderServer({ root }) {
  nonEmpty(root, "INVALID_HTTP_PROVIDER_ROOT");

  return createServer(async (request, response) => {
    try {
      if (request.method !== "GET") {
        response.statusCode = 405;
        response.end();
        return;
      }

      const prefix = "/objects/";
      if (!request.url?.startsWith(prefix)) {
        response.statusCode = 404;
        response.end();
        return;
      }

      const encoded = request.url.slice(prefix.length);
      const address = decodeURIComponent(encoded);
      const bytes = await readAddressedBytes(root, address);

      response.statusCode = 200;
      response.setHeader("content-type", "application/octet-stream");
      response.setHeader("content-length", String(bytes.length));
      response.end(bytes);
    } catch {
      response.statusCode = 404;
      response.end();
    }
  });
}

export async function listenHttpContentProvider(
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

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("HTTP_PROVIDER_ADDRESS_UNAVAILABLE");
  }

  return `http://${host}:${address.port}`;
}

export async function closeHttpContentProvider(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export function httpContentProvider({ id, baseUrl }) {
  const normalized = nonEmpty(baseUrl, "INVALID_HTTP_PROVIDER_URL").replace(
    /\/$/,
    ""
  );

  return {
    id: nonEmpty(id, "INVALID_CONTENT_PROVIDER_ID"),
    kind: "http",
    async resolve(address) {
      const response = await fetch(
        `${normalized}/objects/${encodeURIComponent(address)}`
      );
      if (!response.ok) {
        throw new Error(`HTTP_CONTENT_PROVIDER_${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    }
  };
}

export async function retrieveFromProviders(address, providers) {
  if (!Array.isArray(providers) || providers.length === 0) {
    throw new Error("CONTENT_PROVIDERS_REQUIRED");
  }

  const attempts = [];

  for (const candidate of providers) {
    const provider = requireProvider(candidate);
    try {
      const bytes = bytesOf(await provider.resolve(address));
      attempts.push({
        providerId: provider.id,
        providerKind: provider.kind,
        status: "served"
      });
      return {
        address,
        bytes,
        providerId: provider.id,
        providerKind: provider.kind,
        attempts
      };
    } catch (error) {
      attempts.push({
        providerId: provider.id,
        providerKind: provider.kind,
        status: "failed",
        error: error instanceof Error ? error.message : "provider_failed"
      });
    }
  }

  const failure = new Error("CONTENT_UNAVAILABLE");
  failure.attempts = attempts;
  throw failure;
}
