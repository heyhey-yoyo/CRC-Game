import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "browser-smoke.spec.mjs",
  fullyParallel: false,
  use: {
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
});
