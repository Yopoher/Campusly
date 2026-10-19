import { devices, expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";

/**
 * Parcours des événements (cahier des charges §7 à §10, critère 20.3), sur mobile et ordinateur.
 * Contre le faux Supabase : les règles d'accès réelles sont testées sur une vraie base (tests/db/events.test.ts).
 * Chaque test crée ses propres titres : les tests s'exécutent en parallèle sur le même faux serveur.
 */

const pad = (n: number) => String(n).padStart(2, "0");

async function signIn(page: Page, email: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail de l’école").fill(email);
  await page.getByRole("button", { name: "Recevoir un code" }).click();
  await page.getByLabel("Code reçu par e-mail").fill("123456");
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page).toHaveURL(/\/evenements$/);
}

/** Un contexte de navigateur séparé par personne, dans le format de l'appareil du projet (mobile ou ordinateur). */
function newPersonContext(browser: Browser, info: TestInfo) {
  const device = info.project.name === "mobile" ? devices["Pixel 7"] : devices["Desktop Chrome"];
  return browser.newContext({ ...device, locale: "fr-FR", timezoneId: "Europe/Paris" });
}

/** Date de début dans dix jours, au format d'un champ datetime-local. */
function startInTenDays() {
  const d = new Date(Date.now() + 10 * 86_400_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:30`;
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("un membre du BDE publie un événement, un étudiant le découvre et s'inscrit", async ({ browser }, info) => {
  const title = `Tournoi ${info.project.name} ${Date.now()}`;

  const bdeContext = await newPersonContext(browser, info);
  const bde = await bdeContext.newPage();
  await signIn(bde, "carla.test@ynov.com");
  await bde.goto("/gestion");
  await expect(bde.getByRole("heading", { name: "Gestion", level: 1 })).toBeVisible();
  await expect(bde.getByRole("heading", { name: "BDE Rouen" })).toBeVisible();
  await bde.getByRole("link", { name: "Nouvel événement" }).click();

  await bde.getByLabel("Titre").fill(title);
  await bde.getByLabel("Début").fill(startInTenDays());
  await bde.getByLabel("Lieu").fill("Salle B12");
  await bde.getByRole("button", { name: "Publier" }).click();
  await expect(bde.getByText("Événement publié")).toBeVisible();
  await expect(bde.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  expect(await noHorizontalScroll(bde)).toBe(true);

  const studentContext = await newPersonContext(browser, info);
  const student = await studentContext.newPage();
  await signIn(student, "alice.test@ynov.com");
  await student.getByRole("link", { name: new RegExp(title) }).click();
  await expect(student.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(student.locator("dd", { hasText: "Salle B12" })).toBeVisible();

  await student.getByRole("button", { name: "Je m’inscris" }).click();
  await expect(student.getByText("Tu es inscrit·e à cet événement")).toBeVisible();
  await expect(student.getByText("Alice Martin")).toBeVisible();
  expect(await noHorizontalScroll(student)).toBe(true);

  await student.goto("/evenements?vue=mine");
  await expect(student.getByRole("link", { name: new RegExp(title) })).toBeVisible();

  await bdeContext.close();
  await studentContext.close();
});

test("un étudiant sans rôle de gestion ne voit pas d'espace de gestion", async ({ browser }, info) => {
  const context = await newPersonContext(browser, info);
  const page = await context.newPage();
  await signIn(page, "bob.test@ynov.com");
  await page.goto("/gestion");
  await expect(page.getByText("Aucun espace de gestion")).toBeVisible();
  await context.close();
});

test("les brouillons ne sont jamais visibles du fil des étudiants", async ({ browser }, info) => {
  const context = await newPersonContext(browser, info);
  const page = await context.newPage();
  await signIn(page, "bob.test@ynov.com");
  await expect(page.getByRole("heading", { name: "Bonjour Bob" })).toBeVisible();
  await expect(page.getByText("Brouillon BDE")).toHaveCount(0);
  await page.getByRole("link", { name: "Passés" }).click();
  await expect(page).toHaveURL(/vue=past/);
  await expect(page.getByText("Aucun événement passé")).toBeVisible();
  await context.close();
});

test("un responsable annule un événement publié, la fiche le signale", async ({ browser }, info) => {
  const title = `Conférence ${info.project.name} ${Date.now()}`;
  const context = await newPersonContext(browser, info);
  const page = await context.newPage();
  await signIn(page, "carla.test@ynov.com");
  await page.goto("/gestion");
  await page.getByRole("link", { name: "Nouvel événement" }).click();
  await page.getByLabel("Titre").fill(title);
  await page.getByLabel("Début").fill(startInTenDays());
  await page.getByLabel("Lieu").fill("Amphi A");
  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByText("Événement publié")).toBeVisible();

  // Depuis la liste de gestion, le lien mène directement à la page de modification.
  await page.getByRole("link", { name: new RegExp(title) }).click();
  await expect(page.getByRole("heading", { name: "Annuler l’événement" })).toBeVisible();
  await page.getByLabel("Motif (facultatif)").fill("Intervenant indisponible");
  await page.getByRole("checkbox", { name: /Je confirme l’annulation/ }).check();
  await page.getByRole("button", { name: "Annuler l’événement" }).click();

  await expect(page.getByText("Événement annulé")).toBeVisible();
  await expect(page.getByText("Intervenant indisponible")).toBeVisible();
  await context.close();
});
