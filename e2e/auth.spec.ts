import { expect, test } from "@playwright/test";
import fr from "../src/i18n/dictionaries/fr.json";
import { authFiles, createCredentials, registerMember } from "./auth.helpers";

test.describe("sans session", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("inscription connectée, déconnexion et reconnexion par identifiant (TEST-03)", async ({ page }) => {
    const account = createCredentials();
    await registerMember(page, account);

    const header = page.getByRole("banner");
    await header.getByRole("button", { name: fr.header.signOut, exact: true }).click();
    await expect(header.getByRole("link", { name: fr.header.signIn, exact: true })).toBeVisible();
    await page.goto("/fr/profile");
    await expect(page).toHaveURL("/fr/login");

    await page.getByLabel(fr.login.usernameLabel, { exact: true }).fill(account.username);
    await page.getByLabel(fr.auth.passwordLabel, { exact: true }).fill(account.password);
    await page.getByRole("button", { name: fr.login.submit, exact: true }).click();
    await expect(page).toHaveURL("/fr");
    await expect(header.getByRole("button", { name: account.username, exact: true })).toBeVisible();
  });

  test("un invité entre avec un pseudo et ne peut pas créer de salle (AUTH-03)", async ({ page }) => {
    const pseudo = `gst${createCredentials().username.slice(3)}`;
    await page.goto("/fr/guest");
    await page.getByLabel(fr.guest.pseudoLabel, { exact: true }).fill(pseudo);
    await page.getByRole("button", { name: fr.guest.submit, exact: true }).click();
    await expect(page).toHaveURL("/fr");
    await expect(page.getByRole("banner").getByRole("button", {
      name: `${pseudo} (${fr.header.guest})`,
      exact: true,
    })).toBeVisible();

    await page.goto("/fr/play");
    const createRoom = page.getByRole("button", { name: fr.room.play.create.button, exact: true });
    await expect(createRoom).toBeVisible();
    await expect(createRoom).toBeDisabled();
    await expect(createRoom).toHaveAccessibleDescription(fr.room.play.create.guestNotice);
    await expect(page.getByRole("link", { name: fr.room.play.create.button, exact: true })).toHaveCount(0);
  });

  test("le profil sans session redirige vers la connexion", async ({ page }) => {
    await page.goto("/fr/profile");
    await expect(page).toHaveURL("/fr/login");
    await expect(page.getByRole("heading", { name: fr.login.title, exact: true })).toBeVisible();
  });
});

test("un mauvais mot de passe est refusé avec le message traduit (TEST-03)", async ({ page }) => {
  // Réutilise A sans invalider la session sauvegardée pour les autres specs.
  await page.goto("/fr/profile");
  const username = (await page.getByLabel(fr.profile.identity.username, { exact: true }).inputValue()).slice(1);
  await page.context().clearCookies();
  await page.goto("/fr/login");
  await page.getByLabel(fr.login.usernameLabel, { exact: true }).fill(username);
  await page.getByLabel(fr.auth.passwordLabel, { exact: true }).fill(createCredentials().password);
  await page.getByRole("button", { name: fr.login.submit, exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: fr.auth.errors.INVALID_CREDENTIALS })).toHaveText(fr.auth.errors.INVALID_CREDENTIALS);
  await expect(page).toHaveURL("/fr/login");
  await page.goto("/fr/profile");
  await expect(page).toHaveURL("/fr/login");
});

test.describe("membre B", () => {
  test.use({ storageState: authFiles.memberB });

  test("la session du second membre permet d'ouvrir le profil", async ({ page }) => {
    await page.goto("/fr/profile");
    await expect(page).toHaveURL("/fr/profile");
    await expect(page.getByRole("heading", { name: fr.profile.title, exact: true })).toBeVisible();
    await expect(page.getByLabel(fr.profile.identity.username, { exact: true })).toHaveValue(/^@e2e[0-9a-f]{16}$/);
  });
});
