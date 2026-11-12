import { mapFrameTokenHeader } from "../../shared/map-frame";
import { mapCookieSecret, signMapClaim } from "./cookie";

const TTL_SECONDS = 30 * 60;

export type FrameTokenEnv = {
  ENVIRONMENT?: string;
  ACCESS_DEV_BYPASS?: string;
  OWNER_KEY_SHA256?: string;
};

function constantTimeEqual(actual: string, expected: string) {
  const left = new TextEncoder().encode(actual);
  const right = new TextEncoder().encode(expected);
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
}

export function readMapFrameToken(request: Request) {
  const value = request.headers.get(mapFrameTokenHeader)?.trim() ?? "";
  if (!value || value.length > 80) return null;
  return value;
}

export async function mintMapFrameToken(secret: string, now = Date.now()) {
  const exp = Math.floor(now / 1000) + TTL_SECONDS;
  const signature = await signMapClaim(secret, `map-frame.${exp}`);
  return { token: `${exp}.${signature}`, expiresAt: exp * 1000 };
}

export async function mapFrameTokenValid(
  secret: string,
  token: string | null,
  now = Date.now(),
) {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0 || token.indexOf(".", dot + 1) !== -1) return false;
  const expText = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const exp = Number(expText);
  if (!expText || !signature || !Number.isFinite(exp) || exp * 1000 <= now) return false;
  const expected = await signMapClaim(secret, `map-frame.${expText}`);
  return constantTimeEqual(signature, expected);
}

export async function requestHasMapFrameToken(request: Request, env: FrameTokenEnv) {
  const secret = mapCookieSecret(env);
  if (!secret) return false;
  return mapFrameTokenValid(secret, readMapFrameToken(request));
}
