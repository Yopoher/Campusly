import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3200);
const FAKE_SUPABASE_PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54400);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    // Navigateur fourni par l'environnement si l'installation Playwright standard n'est pas possible.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ["--no-sandbox"] }
      : undefined,
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  // L'application est construite contre un faux Supabase local (tests/e2e/support/fake-supabase.mjs) :
  // les parcours d'interface se testent sans réseau ni secret. La sécurité réelle est testée dans tests/db/.
  webServer: [
    {
      command: `node tests/e2e/support/fake-supabase.mjs`,
      url: `http://127.0.0.1:${FAKE_SUPABASE_PORT}/auth/v1/health`,
      env: { FAKE_SUPABASE_PORT: String(FAKE_SUPABASE_PORT) },
      reuseExistingServer: false,
      timeout: 20_000,
    },
    {
      command: `npm run build && npm run start -- -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${FAKE_SUPABASE_PORT}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "cle-publique-factice-pour-les-tests-e2e",
        SUPABASE_SERVICE_ROLE_KEY: "cle-service-factice-pour-les-tests-e2e",
        NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
      },
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
