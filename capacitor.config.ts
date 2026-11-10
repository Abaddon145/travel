import type { CapacitorConfig } from "@capacitor/cli";

// The shell loads the production origin. Relative /api calls, the
// SameSite=Strict lvxu_map cookie, the 'self' CSP, and the service
// worker all require that origin. See docs/ios/SIDELOAD.md.
const config: CapacitorConfig = {
  appId: "app.lvxu.travel",
  appName: "旅序",
  webDir: "dist",
  server: {
    url: "https://lvxu-ai-travel.lvxu.workers.dev",
  },
};

export default config;
