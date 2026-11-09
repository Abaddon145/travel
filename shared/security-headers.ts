/**
 * Headers for static assets (`public/_headers`) and Worker responses.
 * Values are names and policy text only. No secrets.
 */

export const securityHeaders: Record<string, string> = {
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self' https://webapi.amap.com https://*.amap.com 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://webapi.amap.com https://*.amap.com https://*.is.autonavi.com https://*.autonavi.com",
    "connect-src 'self' https://webapi.amap.com https://restapi.amap.com https://*.amap.com https://*.is.autonavi.com https://*.autonavi.com blob:",
    "worker-src 'self' blob:",
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
  lines.push("");
  return lines.join("\n");
}

export function applySecurityHeaders(response: Response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
