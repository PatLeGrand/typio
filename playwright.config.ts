import { defineConfig, devices } from "@playwright/test";
import { authFiles } from "./e2e/auth.helpers";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: "setup.spec.ts" },
    {
      name: "chromium",
      testIgnore: "setup.spec.ts",
      dependencies: ["setup"],
      use: { storageState: authFiles.memberA },
    },
  ],
  webServer: [
    {
      command: "bun run build && bun run start --hostname 127.0.0.1 --port 3100",
      env: {
        NODE_ENV: "production",
        NEXT_PUBLIC_REALTIME_URL: "http://localhost:3101",
      },
      url: "http://localhost:3100/fr",
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "bun src/realtime/main.ts",
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        APP_ORIGIN: "http://localhost:3100",
        REALTIME_PORT: "3101",
      },
      url: "http://localhost:3101/healthz",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
