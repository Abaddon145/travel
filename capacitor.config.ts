import type { CapacitorConfig } from "@capacitor/cli";
import { shellHostname, shellScheme } from "./shared/shell-origin.ts";

// The installed app loads webDir. server.url is unset so the shell does not
// open the live site. hostname is the Amap JS API whitelist host; the scheme
// stays capacitor, so the origin is not the HTTPS site. See docs/ios/PLAN.md.
const config: CapacitorConfig = {
  appId: "app.lvxu.travel",
  appName: "旅序",
  webDir: "dist",
  server: {
    iosScheme: shellScheme,
    hostname: shellHostname,
  },
};

export default config;
