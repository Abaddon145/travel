import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const includeDist = process.argv.includes("--dist");
const skipDirs = new Set([
  ".git",
  "node_modules",
  "dist",
  "dev-dist",
  "coverage",
  "playwright-report",
  "test-results",
  "docs/stage11/screenshots",
]);
const skipFiles = new Set([
  "package-lock.json",
  "scripts/scan-secrets.mjs",
]);

const rules = [
  { kind: "private-key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { kind: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: "token-sk", re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { kind: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  {
    kind: "assigned-secret",
    re: /(?:DEEPSEEK_API_KEY|AMAP_JS_KEY|AMAP_JS_SECURITY_CODE|AMAP_WEB_KEY|OWNER_KEY_SHA256|CLOUDFLARE_API_TOKEN|ACCESS_ALLOWED_EMAIL)\s*[:=]\s*["']([^"']+)["']/g,
  },
];

function ignoredValue(value) {
  if (!value || value.length < 20) return true;
  if (/^(your-|changeme|placeholder|example|xxx+|test-|server-only)/i.test(value)) return true;
  if (value.includes("secret-value") || value.startsWith("sk-test")) return true;
  if (/^(.)\1{15,}$/.test(value)) return true;
  return false;
}

function findingsIn(text) {
  const kinds = new Set();
  for (const rule of rules) {
    rule.re.lastIndex = 0;
    let match = rule.re.exec(text);
    while (match) {
      if (rule.kind !== "assigned-secret" || !ignoredValue(match[1] ?? "")) kinds.add(rule.kind);
      match = rule.re.exec(text);
    }
  }
  return [...kinds];
}

function walk(dir, found) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = path.relative(root, full);
    if (skipDirs.has(entry) && !(includeDist && entry === "dist" && dir === root)) continue;
    if (skipFiles.has(entry) || skipFiles.has(rel)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!includeDist && entry === "dist") continue;
      walk(full, found);
      continue;
    }
    if (stat.size > 2_000_000) continue;
    if (/\.(png|jpg|jpeg|webp|gif|ico|woff2?)$/i.test(entry)) continue;
    let text;
    try {
      text = readFileSync(full, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\u0000")) continue;
    for (const kind of findingsIn(text)) found.push({ kind, file: rel, commit: "" });
  }
}

function scanHistory(found) {
  const patch = execFileSync(
    "git",
    ["log", "--all", "-p", "--pretty=format:COMMIT %H", "--", ".", ":(exclude)package-lock.json"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  let commit = "";
  let file = "";
  for (const line of patch.split("\n")) {
    if (line.startsWith("COMMIT ")) {
      commit = line.slice(7).trim();
      file = "";
      continue;
    }
    if (line.startsWith("diff --git ")) {
      const match = line.match(/ b\/(.+)$/);
      file = match?.[1] ?? "";
      continue;
    }
    if (!file || file === "scripts/scan-secrets.mjs" || file === "package-lock.json") continue;
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    for (const kind of findingsIn(line.slice(1))) {
      found.push({ kind, file, commit });
    }
  }
}

const found = [];
walk(root, found);
try {
  scanHistory(found);
} catch (error) {
  console.error("secret scan could not read git history");
  console.error(error instanceof Error ? error.message : "git failed");
  process.exit(1);
}

const unique = [];
const seen = new Set();
for (const item of found) {
  const key = `${item.kind}\t${item.file}\t${item.commit}`;
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push(item);
}

if (unique.length === 0) {
  console.log("secret scan: no findings");
  process.exit(0);
}

for (const item of unique) {
  console.log(`${item.kind}\t${item.file}\t${item.commit || "worktree"}`);
}
process.exit(1);
