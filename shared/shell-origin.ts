/**
 * Public app origin and the Capacitor shell origin.
 * No secrets. The shell origin is not a website users can open in Safari.
 */

export const workerOrigin = "https://lvxu-ai-travel.lvxu.workers.dev";

export const shellScheme = "capacitor";

export const shellHostname = "localhost";

export const shellOrigin = `${shellScheme}://${shellHostname}`;

const allowed = new Set([shellOrigin]);

export function isShellOrigin(origin: string | null) {
  return origin !== null && allowed.has(origin);
}
