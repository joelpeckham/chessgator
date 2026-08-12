import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.MAIA_SMOKE_PORT || 4174);

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.smoke.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
  },
  webServer: {
    command: "node tests/maia/static-server.mjs",
    cwd: "../..",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
