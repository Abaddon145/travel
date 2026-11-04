export type RateLimiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

export async function rateLimitKey(identityEmail: string | null, ip: string) {
  const material = identityEmail
    ? `id:${identityEmail.trim().toLowerCase()}`
    : `ip:${ip || "unknown"}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(material),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function enforceRateLimit(limiter: RateLimiter, key: string) {
  const result = await limiter.limit({ key });
  return result.success ? "ok" : "limited";
}
