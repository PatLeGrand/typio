import { expect, test, type Locator, type Page } from "@playwright/test";
import en from "../src/i18n/dictionaries/en.json";
import fr from "../src/i18n/dictionaries/fr.json";
import { createCredentials, registerMember } from "./auth.helpers";

async function tab(page: Page) {
  await page.keyboard.press("Tab");
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

async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  for (let count = 0; count < 60; count++) {
    await tab(page);
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  await expect(target, "Élément inaccessible après 60 Tab").toBeFocused();
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
