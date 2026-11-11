/**
 * Public app origin and the Capacitor shell origins.
 * No secrets. A shell origin is not a website users can open in Safari.
 *
 * The current shell host is the production host already listed on the Amap
 * JS API domain whitelist. The scheme stays `capacitor`, so this is not the
 * HTTPS site. Older installs still use `capacitor://localhost`; keep
 * accepting that origin so those builds can call the API.
 */

export const workerOrigin = "https://lvxu-ai-travel.lvxu.workers.dev";

export const shellScheme = "capacitor";

export const shellHostname = "lvxu-ai-travel.lvxu.workers.dev";

export const shellOrigin = `${shellScheme}://${shellHostname}`;

export const legacyShellOrigin = `${shellScheme}://localhost`;

const allowed = new Set([shellOrigin, legacyShellOrigin]);

export function isShellOrigin(origin: string | null) {
  return origin !== null && allowed.has(origin);
}
