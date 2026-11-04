const STORAGE_KEY = "lvxu-owner-key";

export type OwnerKeyCheck = "ok" | "invalid" | "limited" | "unconfigured" | "error";

export function readOwnerKey() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveOwnerKey(value: string) {
  localStorage.setItem(STORAGE_KEY, value);
}

export function clearOwnerKey() {
  localStorage.removeItem(STORAGE_KEY);
}

const gatedPath = /^\/api\/(?:paid|admin|auth|ai)(?:\/|$)/;

export function gatedHeaders(path: string, extra?: HeadersInit) {
  const headers = new Headers(extra);
  if (gatedPath.test(path)) {
    const key = readOwnerKey();
    if (key) headers.set("Authorization", `Bearer ${key}`);
  }
  return headers;
}

export async function checkOwnerKey(
  fetchImpl: typeof fetch = fetch,
): Promise<OwnerKeyCheck> {
  try {
    const response = await fetchImpl("/api/auth/check", {
      method: "GET",
      headers: gatedHeaders("/api/auth/check", { accept: "application/json" }),
    });
    if (response.status === 429) return "limited";
    if (response.status === 401) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      return body?.error === "unconfigured" ? "unconfigured" : "invalid";
    }
    if (!response.ok) return "error";
    const body = (await response.json()) as { ok?: boolean };
    return body.ok === true ? "ok" : "error";
  } catch {
    return "error";
  }
}
