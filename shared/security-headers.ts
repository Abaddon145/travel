/**
 * Headers for static assets (`public/_headers`) and Worker responses.
 * Values are names and policy text only. No secrets.
 */

import { legacyShellOrigin, shellOrigin, workerOrigin } from "./shell-origin.ts";

const frameSrc = `frame-src 'self' ${workerOrigin}`;
const childSrc = `child-src 'self' blob: ${workerOrigin}`;

export const securityHeaders: Record<string, string> = {
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self' https://webapi.amap.com https://*.amap.com 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: https://webapi.amap.com https://*.amap.com https://*.is.autonavi.com https://*.autonavi.com ${workerOrigin}`,
    `connect-src 'self' https://webapi.amap.com https://restapi.amap.com https://*.amap.com https://*.is.autonavi.com https://*.autonavi.com https://geocoding-api.open-meteo.com https://api.open-meteo.com blob: ${workerOrigin}`,
    "worker-src 'self' blob:",
    frameSrc,
    childSrc,
    "font-src 'self' data: https://*.amap.com",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "strict-transport-security": "max-age=15552000; includeSubDomains",
  "x-xss-protection": "0",
  "x-robots-tag": "noindex",
};

const canonicalNames: Record<string, string> = {
  "content-security-policy": "Content-Security-Policy",
  "x-content-type-options": "X-Content-Type-Options",
  "x-frame-options": "X-Frame-Options",
  "referrer-policy": "Referrer-Policy",
  "permissions-policy": "Permissions-Policy",
  "strict-transport-security": "Strict-Transport-Security",
  "x-xss-protection": "X-XSS-Protection",
  "x-robots-tag": "X-Robots-Tag",
};

export function renderHeadersFile() {
  const lines = [
    "# Same policy as shared/security-headers.ts. Applied to static assets only.",
    "/*",
  ];
  for (const [name, value] of Object.entries(securityHeaders)) {
    lines.push(`  ${canonicalNames[name]}: ${value}`);
  }
  lines.push(
    "",
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
    "/index.html",
    "  Cache-Control: public, max-age=0, must-revalidate",
    "",
    "/",
    "  Cache-Control: public, max-age=0, must-revalidate",
    "",
    "/sw.js",
    "  Cache-Control: public, max-age=0, must-revalidate",
    "",
    "/manifest.webmanifest",
    "  Cache-Control: public, max-age=0, must-revalidate",
    "",
  );
  return lines.join("\n");
}

export function metaContentSecurityPolicy() {
  const policy = securityHeaders["content-security-policy"] ?? "";
  return policy
    .split("; ")
    .filter((part) => !part.startsWith("frame-ancestors "))
    .join("; ");
}

export function injectContentSecurityPolicy(html: string) {
  if (html.includes('http-equiv="Content-Security-Policy"')) return html;
  const meta = `    <meta http-equiv="Content-Security-Policy" content="${metaContentSecurityPolicy()}" />`;
  return html.replace("<head>", `<head>\n${meta}`);
}

export function shellFrameAncestors() {
  return `frame-ancestors ${shellOrigin} ${legacyShellOrigin}`;
}

export function shellFrameContentSecurityPolicy() {
  const policy = securityHeaders["content-security-policy"] ?? "";
  return policy.replace("frame-ancestors 'none'", shellFrameAncestors());
}

export function applySecurityHeaders(
  response: Response,
  options?: { framing?: "deny" | "shell" },
) {
  const framing = options?.framing ?? "deny";
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders)) {
    if (framing === "shell" && name === "x-frame-options") continue;
    if (framing === "shell" && name === "content-security-policy") {
      headers.set(name, shellFrameContentSecurityPolicy());
      continue;
    }
    headers.set(name, value);
  }
  if (framing === "shell") headers.delete("x-frame-options");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
