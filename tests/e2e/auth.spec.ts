import { expect, test, type Page } from "@playwright/test";

/** Parcours de connexion (cahier des charges §5, tests 20.1), contre le faux Supabase local. */

async function requestCode(page: Page, email: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail de l’école").fill(email);
  await page.getByRole("button", { name: "Recevoir un code" }).click();
}

test("un étudiant se connecte avec son code et arrive sur le fil", async ({ page }) => {
  await requestCode(page, "  Alice.Test@YNOV.com ");
  await expect(page.getByText("Si alice.test@ynov.com est autorisée, tu vas recevoir un code")).toBeVisible();
  await page.getByLabel("Code reçu par e-mail").fill("123 456");
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page).toHaveURL(/\/evenements$/);
  await expect(page.getByRole("heading", { name: "Bonjour Alice" })).toBeVisible();
});

test("une adresse non autorisée reçoit exactement la même réponse", async ({ page }) => {
  await requestCode(page, "intrus@gmail.com");
  await expect(page.getByText("Si intrus@gmail.com est autorisée, tu vas recevoir un code")).toBeVisible();
});

test("un code expiré ou faux affiche quoi faire", async ({ page }) => {
  await requestCode(page, "alice.test@ynov.com");
  await page.getByLabel("Code reçu par e-mail").fill("000000");
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page.getByText("Ce code n’est plus valable ou a déjà servi. Demande un nouveau code.")).toBeVisible();
  await expect(page).toHaveURL(/\/connexion/);
});

test("une adresse mal saisie est signalée sans envoi", async ({ page }) => {
  await requestCode(page, "alice.martin");
  await expect(page.getByText(/Saisis une adresse e-mail valide/)).toBeVisible();
});

test("on peut corriger son adresse après la demande de code", async ({ page }) => {
  await requestCode(page, "alice.test@ynov.com");
  await page.getByRole("button", { name: "Changer d’adresse" }).click();
  await expect(page.getByLabel("Adresse e-mail de l’école")).toHaveValue("alice.test@ynov.com");
});

test("à la première connexion, l'étudiant complète son profil puis arrive sur le fil", async ({ page }, info) => {
  const email = `nouveau.${info.project.name}.test@ynov.com`;
  await requestCode(page, email);
  await page.getByLabel("Code reçu par e-mail").fill("123456");
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page).toHaveURL(/\/bienvenue$/);

  // Champs vides : le navigateur bloque l'envoi (champs obligatoires).
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/\/bienvenue$/);
  // Prénom fait seulement d'espaces : refusé par la base, message affiché.
  await page.getByLabel("Prénom").fill("   ");
  await page.getByLabel("Nom", { exact: true }).fill("Leroy");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Le prénom doit contenir entre 1 et 60 caractères")).toBeVisible();

  await page.getByLabel("Prénom").fill("Nina");
  await page.getByLabel("Nom", { exact: true }).fill("Leroy");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/\/evenements$/);
  await expect(page.getByRole("heading", { name: "Bonjour Nina" })).toBeVisible();
});

test("une page protégée renvoie vers la connexion, puis y ramène", async ({ page }) => {
  await page.goto("/profil");
  await expect(page).toHaveURL(/\/connexion\?suite=%2Fprofil$/);
  await page.getByLabel("Adresse e-mail de l’école").fill("alice.test@ynov.com");
  await page.getByRole("button", { name: "Recevoir un code" }).click();
  await page.getByLabel("Code reçu par e-mail").fill("123456");
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page).toHaveURL(/\/profil$/);
  await expect(page.getByText("alice.test@ynov.com", { exact: true })).toBeVisible();
});

test("la déconnexion ramène à la page de connexion et protège à nouveau les pages", async ({ page }) => {
  await requestCode(page, "alice.test@ynov.com");
  await page.getByLabel("Code reçu par e-mail").fill("123456");
  await page.getByRole("button", { name: "Me connecter" }).click();
  await page.getByRole("link", { name: "Profil" }).click();
  await page.getByRole("button", { name: "Me déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await page.goto("/evenements");
  await expect(page).toHaveURL(/\/connexion/);
});

test("une redirection vers un site externe est ignorée", async ({ page }) => {
  await page.goto("/connexion?suite=https://pirate.example");
  await page.getByLabel("Adresse e-mail de l’école").fill("alice.test@ynov.com");
  await page.getByRole("button", { name: "Recevoir un code" }).click();
  await page.getByLabel("Code reçu par e-mail").fill("123456");
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page).toHaveURL(/localhost:\d+\/evenements$/);
});
