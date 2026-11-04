import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mark = await readFile(path.join(root, "public/favicon.svg"));
const maskable = await readFile(path.join(root, "public/icon-maskable.svg"));

async function png(source, size, name) {
  await sharp(source)
    .resize(size, size)
    .png()
    .toFile(path.join(root, "public", name));
}

await png(mark, 180, "apple-touch-icon.png");
await png(mark, 192, "pwa-192.png");
await png(mark, 512, "pwa-512.png");
await png(maskable, 512, "pwa-512-maskable.png");
