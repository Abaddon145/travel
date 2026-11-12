const COOKIE = "lvxu_map";
const TTL_SECONDS = 30 * 60;

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

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

export async function signMapClaim(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

export function mapCookieSecret(env: {
  ENVIRONMENT?: string;
  ACCESS_DEV_BYPASS?: string;
  OWNER_KEY_SHA256?: string;
}) {
  const owner = env.OWNER_KEY_SHA256?.trim().toLowerCase() ?? "";
  if (/^[0-9a-f]{64}$/.test(owner)) return owner;
  if (env.ENVIRONMENT !== "production" && env.ACCESS_DEV_BYPASS === "1")
    return "lvxu-dev-map";
  return null;
}

export async function mapCookieHeader(secret: string, now = Date.now()) {
  const exp = Math.floor(now / 1000) + TTL_SECONDS;
  const signature = await signMapClaim(secret, String(exp));
  return `${COOKIE}=${exp}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL_SECONDS}`;
}

export function readCookie(header: string | null, name = COOKIE) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export async function mapCookieValid(
  secret: string,
  header: string | null,
  now = Date.now(),
) {
  const value = readCookie(header);
  if (!value) return false;
  const [expText, signature] = value.split(".");
  const exp = Number(expText);
  if (!expText || !signature || !Number.isFinite(exp) || exp * 1000 <= now) return false;
  const expected = await signMapClaim(secret, expText);
  return constantTimeEqual(signature, expected);
}
