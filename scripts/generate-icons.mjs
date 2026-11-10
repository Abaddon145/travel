import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mark = path.join(root, "public/favicon.svg");
const maskable = path.join(root, "public/icon-maskable.svg");

async function png(source, size, name) {
  await sharp(source)
    .resize(size, size)
    .png()
    .toFile(path.join(root, "public", name));
}

await png(maskable, 180, "apple-touch-icon.png");
await png(maskable, 167, "apple-touch-icon-167.png");
await png(maskable, 152, "apple-touch-icon-152.png");
await png(mark, 192, "pwa-192.png");
await png(mark, 512, "pwa-512.png");
await png(maskable, 512, "pwa-512-maskable.png");

const splashDir = path.join(root, "public/splash");
await mkdir(splashDir, { recursive: true });

const devices = [
  [750, 1334],
  [1170, 2532],
  [1179, 2556],
  [1206, 2622],
  [1284, 2778],
  [1290, 2796],
  [1320, 2868],
];

const themes = [
  ["light", "#f6f3ec"],
  ["dark", "#1c1916"],
];

for (const [width, height] of devices) {
  const icon = await sharp(maskable)
    .resize(Math.round(Math.min(width, height) * 0.18))
    .png()
    .toBuffer();
  for (const [theme, background] of themes) {
    await sharp({
      create: { width, height, channels: 3, background },
    })
      .composite([{ input: icon, gravity: "center" }])
      .png({ compressionLevel: 9, palette: true })
      .toFile(path.join(splashDir, `apple-splash-${width}x${height}-${theme}.png`));
  }
}

const capacitorAssets = path.join(root, "assets");
await mkdir(capacitorAssets, { recursive: true });

await sharp(maskable)
  .resize(1024, 1024)
  .png()
  .toFile(path.join(capacitorAssets, "icon-only.png"));
await sharp(maskable)
  .resize(1024, 1024)
  .png()
  .toFile(path.join(capacitorAssets, "icon-foreground.png"));
await sharp({
  create: { width: 1024, height: 1024, channels: 3, background: "#f6f3ec" },
})
  .png()
  .toFile(path.join(capacitorAssets, "icon-background.png"));

const splashLogo = await sharp(maskable)
  .resize(Math.round(2732 * 0.18))
  .png()
  .toBuffer();
for (const [name, background] of [
  ["splash.png", "#f6f3ec"],
  ["splash-dark.png", "#1c1916"],
]) {
  await sharp({
    create: { width: 2732, height: 2732, channels: 3, background },
  })
    .composite([{ input: splashLogo, gravity: "center" }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(capacitorAssets, name));
}
