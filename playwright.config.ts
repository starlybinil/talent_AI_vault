import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests run against a real Supabase project (demo accounts from scripts/create-demo-users.sql).
 *   E2E_BASE_URL=http://localhost:3000 E2E_DEMO_PASSWORD=... npm run test:e2e
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
