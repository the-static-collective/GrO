import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { stableStringify } from "./stable.js";

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseAddress(address) {
  if (typeof address !== "string" || !/^sha256:[0-9a-f]{64}$/.test(address)) {
    throw new Error("INVALID_SHA256_ADDRESS");
  }
  return address.slice("sha256:".length);
}

export function addressJson(value) {
  const text = stableStringify(value);
  const bytes = Buffer.from(text, "utf8");
  return {
    address: `sha256:${digest(bytes)}`,
    bytes
  };
}

export function addressedPath(root, address) {
  const hash = parseAddress(address);
  return join(root, "sha256", hash);
}

export async function writeAddressedJson(root, value) {
  const { address, bytes } = addressJson(value);
  const path = addressedPath(root, address);
  await mkdir(join(root, "sha256"), { recursive: true });
  await writeFile(path, bytes);
  return { address, path, bytes: Buffer.from(bytes) };
}

export async function writeAddressedBytes(root, value) {
  const bytes = Buffer.isBuffer(value)
    ? Buffer.from(value)
    : value instanceof Uint8Array
      ? Buffer.from(value)
      : Buffer.from(value);
  const address = `sha256:${digest(bytes)}`;
  const path = addressedPath(root, address);
  await mkdir(join(root, "sha256"), { recursive: true });
  await writeFile(path, bytes);
  return { address, path, bytes };
}

export async function readAddressedBytes(root, address) {
  const path = addressedPath(root, address);
  const bytes = await readFile(path);
  const actual = `sha256:${digest(bytes)}`;
  if (actual !== address) throw new Error("CONTENT_ADDRESS_MISMATCH");
  return bytes;
}
