const base = (process.env.SMOKE_BASE_URL || "https://lvxu-ai-travel.lvxu.workers.dev").replace(
  /\/$/,
  "",
);
const required = [
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
  "strict-transport-security",
  "x-robots-tag",
];

function log(status, path) {
  console.log(`${status}\t${path}`);
}

async function get(path, init) {
  const response = await fetch(`${base}${path}`, init);
  log(response.status, path);
  return response;
}

if (!base.startsWith("https://")) {
  console.error("smoke base URL must be https");
  process.exit(1);
}

let home;
for (let attempt = 1; attempt <= 3; attempt += 1) {
  home = await get("/");
  if (home.ok) break;
  if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2000));
}
if (!home?.ok) process.exit(1);

const headerNames = [...home.headers.keys()];
console.log(`headers\t${headerNames.join(",")}`);
for (const name of required) {
  if (!home.headers.get(name)) {
    console.error(`missing header\t${name}`);
    process.exit(1);
  }
}
const policy = home.headers.get("content-security-policy") ?? "";
if (!policy.includes("frame-ancestors 'none'") || policy.includes("require-corp")) {
  console.error("unexpected content-security-policy");
  process.exit(1);
}

for (let i = 0; i < 4; i += 1) {
  const again = await get("/");
  if (!again.ok) process.exit(1);
}

const html = await home.text();
const manifest = html.match(/rel="manifest" href="([^"]+)"/)?.[1] ?? "/manifest.webmanifest";
const manifestUrl = manifest.startsWith("http") ? manifest : manifest;
const manifestResponse = await get(manifestUrl.startsWith("/") ? manifestUrl : `/${manifestUrl}`);
if (!manifestResponse.ok) process.exit(1);
const sw = await get("/sw.js");
if (!sw.ok) process.exit(1);
const swText = await sw.text();
if (!swText.includes("NetworkOnly") || !swText.includes("api") || !swText.includes("_AMapService")) {
  console.error("service worker does not keep auth paths network-only");
  process.exit(1);
}

const denied = [
  ["/api/ai/itinerary", { method: "POST" }],
  ["/api/map/config", { method: "GET" }],
  ["/_AMapService/", { method: "GET" }],
];
for (const [path, init] of denied) {
  const response = await get(path, init);
  if (response.status !== 401) process.exit(1);
}

const status = await get("/api/status");
if (status.status !== 200) process.exit(1);
const body = await status.text();
if (/sk-[A-Za-z0-9]{20,}|BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}/.test(body)) {
  console.error("status body matched a secret pattern");
  process.exit(1);
}
console.log("smoke: ok");
