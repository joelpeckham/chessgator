import { defineConfig } from "@playwright/test";

export function createAppPlaywrightConfig(options: {
  port: number;
  timeout?: number;
}) {
  const port = Number(process.env.E2E_PORT || options.port);
  return defineConfig({
    testDir: ".",
    testMatch: "**/*.spec.ts",
    fullyParallel: false,
    workers: 1,
    timeout: options.timeout ?? 120_000,
    retries: 0,
    reporter: [["list"]],
    use: {
      baseURL: `http://127.0.0.1:${port}`,
      headless: true,
    },
    webServer: {
      command: `E2E_PORT=${port} node tests/shared/static-out-server.mjs`,
      cwd: "../..",
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  });
}
