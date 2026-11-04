import type { AccessEnv } from "./access";

export type AuthMode = "owner-key" | "access" | "either";

export type GateEnv = AccessEnv & {
  AUTH_MODE?: string;
  OWNER_KEY_SHA256?: string;
};

const SHA256_HEX = /^[0-9a-f]{64}$/;

export function parseAuthMode(value: string | undefined): AuthMode | null {
  if (value === "owner-key" || value === "access" || value === "either") return value;
  return null;
}

export function ownerKeyConfigured(secret: string | undefined) {
  return typeof secret === "string" && SHA256_HEX.test(secret.trim().toLowerCase());
}

export function readPresentedOwnerKey(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
    if (match?.[1]) return match[1];
  }
  const header = request.headers.get("x-lvxu-owner-key");
  if (header && header.trim()) return header.trim();
  return null;
}

export async function sha256Bytes(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

export function decodeSha256Hex(hex: string) {
  const normalized = hex.trim().toLowerCase();
  if (!SHA256_HEX.test(normalized)) return null;
  const bytes = new Uint8Array(32);
  for (let index = 0; index < 32; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(actual: Uint8Array, expected: Uint8Array) {
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (left: BufferSource, right: BufferSource) => boolean;
  };
  if (
    typeof subtle.timingSafeEqual === "function" &&
    actual.byteLength === expected.byteLength
  ) {
    return subtle.timingSafeEqual(actual, expected);
  }
  const length = Math.max(actual.byteLength, expected.byteLength);
  let diff = actual.byteLength ^ expected.byteLength;
  for (let index = 0; index < length; index += 1) {
    diff |= (actual[index] ?? 0) ^ (expected[index] ?? 0);
  }
  return diff === 0;
}

export async function ownerKeyMatches(provided: string, expectedHex: string) {
  const actual = await sha256Bytes(provided);
  const decoded = decodeSha256Hex(expectedHex);
  const expected = decoded ?? new Uint8Array(32);
  const equal = constantTimeEqual(actual, expected);
  return decoded !== null && equal;
}
