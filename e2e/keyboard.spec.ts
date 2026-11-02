import { expect, test, type Locator, type Page } from "@playwright/test";
import en from "../src/i18n/dictionaries/en.json";
import fr from "../src/i18n/dictionaries/fr.json";
import { authFiles, createCredentials, registerMember } from "./auth.helpers";

async function tab(page: Page, key: "Tab" | "Shift+Tab" = "Tab") {
  await page.keyboard.press(key);
  await expectVisibleFocus(page);
}

async function expectVisibleFocus(page: Page) {
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
  const indicator = await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      visible: element.matches(":focus-visible"),
      outline: style.outlineStyle,
      width: style.outlineWidth,
      shadow: style.boxShadow,
      element: element.outerHTML,
    };
  });
  expect.soft(
    indicator.visible && (
      (indicator.outline !== "none" && Number.parseFloat(indicator.width) > 0)
      || indicator.shadow !== "none"
    ),
    `Indicateur :focus-visible absent : ${JSON.stringify(indicator)}`,
  ).toBe(true);
}

async function tabTo(page: Page, target: Locator, key: "Tab" | "Shift+Tab" = "Tab") {
  await expect(target).toBeVisible();
  for (let count = 0; count < 60; count++) {
    await tab(page, key);
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  await expect(target, `Élément inaccessible après 60 ${key}`).toBeFocused();
}

test.use({ storageState: { cookies: [], origins: [] }, colorScheme: "light" });

test("accueil : premier lien, langue, thème et action principale au clavier (A11Y-04)", async ({ page }) => {
  await page.goto("/fr");
  const header = page.getByRole("banner");
  await expect(header).toBeVisible();
  const links = page.getByRole("link");
  const skipIndex = await links.evaluateAll((elements) => elements.findIndex((element) => {
    if (!(element instanceof HTMLAnchorElement)) return false;
    const href = element.getAttribute("href");
    if (!href?.startsWith("#") || href.length < 2) return false;
    const target = document.getElementById(decodeURIComponent(href.slice(1)));
    return target?.matches("main, [role=main]") ?? false;
  }));
  await tab(page);
  await expect(skipIndex >= 0 ? links.nth(skipIndex) : header.getByRole("link").first()).toBeFocused();

  await tabTo(page, header.getByRole("link", { name: `EN — ${fr.language.names.en}`, exact: true }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await tabTo(page, header.getByRole("link", { name: `FR — ${en.language.names.fr}`, exact: true }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");

  const theme = header.getByRole("button", { name: `${fr.theme.label}: ${fr.theme.system}`, exact: true });
  await tabTo(page, theme);
  await page.keyboard.press("Enter");
  await expect(header.getByRole("button", { name: `${fr.theme.label}: ${fr.theme.light}`, exact: true }))
    .toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await tabTo(page, page.getByRole("main").getByRole("link", { name: fr.home.createRace, exact: true }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/fr/race/settings");
  await expect(page.getByRole("heading", { name: fr.raceSettings.title, exact: true })).toBeVisible();
});

test("connexion complète au clavier avec des identifiants générés (A11Y-04)", async ({ page }) => {
  const account = createCredentials();
  await registerMember(page, account);
  await page.getByRole("banner").getByRole("button", { name: fr.header.signOut, exact: true }).click();
  await expect(page.getByRole("banner").getByRole("link", { name: fr.header.signIn, exact: true }))
    .toBeVisible();
  await page.goto("/fr/login");

  await tabTo(page, page.getByLabel(fr.login.usernameLabel, { exact: true }));
  await page.keyboard.type(account.username);
  await tabTo(page, page.getByLabel(fr.auth.passwordLabel, { exact: true }));
  await page.keyboard.type(account.password);
  await tabTo(page, page.getByRole("button", { name: fr.login.submit, exact: true }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/fr");
  await expect(page.getByRole("banner").getByRole("button", { name: account.username, exact: true }))
    .toBeVisible();
});

test.describe("parcours clavier d’un membre", () => {
  test.use({ storageState: authFiles.memberA });

  test("profil, réglages et sortie de salle au clavier (A11Y-04)", async ({ page }) => {
    await page.goto("/fr");
    const profile = page.getByRole("banner").locator('button[aria-haspopup="dialog"]');
    await tabTo(page, profile);
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(":focus"), "Le focus doit entrer dans la fenêtre du profil").toHaveCount(1);
    await expectVisibleFocus(page);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(profile, "Après Escape, le focus doit revenir au bouton d’ouverture du profil (ProfileModal)")
      .toBeFocused();
    await expectVisibleFocus(page);

    await tabTo(page, page.getByRole("main").getByRole("link", { name: fr.home.createRace, exact: true }).first());
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/fr/race/settings");
    const settings = fr.raceSettings;
    const textMode = page.getByRole("radiogroup", { name: settings.textMode.label, exact: true });
    const sentences = textMode.getByRole("radio", { name: settings.textMode.sentences, exact: true });
    const words = textMode.getByRole("radio", { name: settings.textMode.words, exact: true });
    await tabTo(page, sentences);
    await expect(sentences).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(words).toBeFocused();
    await expect(words).toBeChecked();
    await expect(sentences).not.toBeChecked();
    await expectVisibleFocus(page);

    const punctuation = page.getByRole("switch", { name: settings.punctuation.label, exact: true });
    await tabTo(page, punctuation);
    const wasChecked = await punctuation.getAttribute("aria-checked");
    await page.keyboard.press("Space");
    await expect(punctuation).toHaveAttribute("aria-checked", wasChecked === "true" ? "false" : "true");
    await expect(punctuation).toBeFocused();
    await expectVisibleFocus(page);
    await tabTo(page, page.getByRole("button", { name: settings.invite.button, exact: true }));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/fr\/room\/[A-Z0-9]{6}$/);
    await expect(page.getByRole("heading", { name: fr.room.title, exact: true })).toBeVisible();

    const start = page.getByRole("button", { name: fr.room.race.start, exact: true });
    await expect(start).toBeEnabled();
    await tabTo(page, start);
    const leave = page.getByRole("button", { name: fr.room.leave, exact: true });
    await tabTo(page, leave, "Shift+Tab");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/fr/play");
    await expect(page.getByRole("heading", { name: fr.room.title, exact: true })).not.toBeVisible();
    await expect(page.getByRole("button", { name: fr.room.play.inRoom.leave, exact: true })).not.toBeVisible();
  });
});
