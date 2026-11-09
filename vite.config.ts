import { writeFileSync } from "node:fs";
import path from "node:path";
import basicSsl from "@vitejs/plugin-basic-ssl";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";
import { renderHeadersFile, securityHeaders } from "./shared/security-headers.ts";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
    {
      name: "lvxu-security-headers",
      apply: "build",
      closeBundle() {
        writeFileSync(path.resolve("dist/_headers"), renderHeadersFile());
      },
    },
    VitePWA({
      // Prompt keeps the new worker waiting until the user refreshes.
      registerType: "prompt",
      injectRegister: false,
      includeAssets: [
        "favicon.svg",
        "apple-touch-icon.png",
        "apple-touch-icon-167.png",
        "apple-touch-icon-152.png",
      ],
      manifest: {
        id: "/",
        name: "旅序 AI Travel",
        short_name: "旅序",
        description: "个人行程本。离线仍可查看已保存的行程。",
        lang: "zh-CN",
        dir: "ltr",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        background_color: "#f6f3ec",
        theme_color: "#f6f3ec",
        categories: ["travel"],
        icons: [
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/_AMapService\//],
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        globIgnores: ["**/node_modules/**/*", "sw.js", "workbox-*.js", "**/splash/**"],
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: (
          ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const
        ).flatMap((method) => [
          {
            urlPattern: /\/api\//,
            handler: "NetworkOnly" as const,
            method,
          },
          {
            urlPattern: /\/_AMapService\//,
            handler: "NetworkOnly" as const,
            method,
          },
        ]),
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      "@shared": path.resolve(process.cwd(), "shared"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 43127,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/_AMapService": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 43128,
    strictPort: true,
    headers: securityHeaders,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
