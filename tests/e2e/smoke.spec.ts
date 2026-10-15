import { expect, test } from "@playwright/test";

test("la page d'accueil s'affiche en français, sans erreur", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Les événements de ton campus");
  expect(errors).toEqual([]);
});

test("le manifeste rend l'application installable", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBeTruthy();
  const manifest = await res.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
});

test("les en-têtes de sécurité sont présents", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("s'inscrire pose le surligneur sur la date (démonstration du système visuel)", async ({ page }) => {
  await page.goto("/design");
  const demo = page.getByRole("region", { name: "S’inscrire" });
  await demo.getByRole("button", { name: "M’inscrire" }).click();
  await expect(demo.getByText("Tu es inscrit·e. Tu recevras un rappel la veille.")).toBeVisible();
  await expect(demo.getByText("143 inscrits")).toBeVisible();
  await expect(demo.getByRole("button", { name: "Me désinscrire" })).toBeVisible();
});

test("la page ne déborde pas horizontalement", async ({ page }) => {
  await page.goto("/design");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
