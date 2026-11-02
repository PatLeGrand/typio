import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import fr from "../src/i18n/dictionaries/fr.json";
import { THEME_STORAGE_KEY } from "../src/theme/theme";
import { authFiles } from "./auth.helpers";

async function audit(page: Page, lang = "fr") {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const structure = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    const errors: string[] = [];
    for (const tag of ["main", "h1"]) {
      const count = document.querySelectorAll(tag).length;
      if (count !== 1) errors.push(`<${tag}> : ${count} (attendu : 1)`);
    }
    for (const tag of ["nav", "footer"]) {
      if (!document.querySelector(tag)) errors.push(`<${tag}> absent`);
    }
    let previous = 0;
    for (const heading of headings) {
      const level = Number(heading.tagName.slice(1));
      if (level > previous + 1) {
        errors.push(`Saut de titre h${previous} → h${level} : ${heading.textContent?.trim()}`);
      }
      previous = level;
    }
    return errors;
  });
  const banners = await page.getByRole("banner").count();
  if (banners !== 1) structure.push(`banner : ${banners} (attendu : 1)`);
  const actualLang = await page.locator("html").getAttribute("lang");
  if (actualLang !== lang) structure.push(`html[lang] : ${actualLang} (attendu : ${lang})`);

  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const errors = [
    ...structure.map((error) => `Structure : ${error}`),
    ...violations.flatMap((violation) => violation.nodes.map((node) =>
      `${violation.id} | ${node.target.join(", ")} | ${node.failureSummary ?? violation.description}`,
    )),
  ];
  expect(errors, `${page.url()}\n${errors.join("\n\n")}`).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`accessibilité — ${colorScheme}`, () => {
    test.use({ colorScheme });
    test.beforeEach(async ({ page }) => {
      // Force « système » même si l'état d'authentification contient un choix mémorisé.
      await page.addInitScript((key) => localStorage.setItem(key, "system"), THEME_STORAGE_KEY);
    });

    async function visit(page: Page, path: string) {
      await page.goto(path);
      if (colorScheme === "dark") await expect(page.locator("html")).toHaveClass(/\bdark\b/);
      else await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    }

    test.describe("sans session", () => {
      test.use({ storageState: { cookies: [], origins: [] } });

      for (const path of ["/fr", "/fr/login", "/fr/register", "/fr/guest", "/fr/privacy", "/fr/nexiste-pas", "/en"]) {
        test(`axe et structure : ${path} (A11Y-01 à A11Y-03)`, async ({ page }) => {
          await visit(page, path);
          await audit(page, path === "/en" ? "en" : "fr");
        });
      }
    });

    test.describe("membre A", () => {
      test.use({ storageState: authFiles.memberA });

      for (const path of ["/fr", "/fr/play", "/fr/race/settings", "/fr/profile", "/fr/history"]) {
        test(`axe et structure : ${path} (A11Y-01 à A11Y-03)`, async ({ page }) => {
          await visit(page, path);
          await audit(page);
        });
      }

      test("axe et structure : salle avant le départ (A11Y-01 à A11Y-03)", async ({ page }) => {
        await visit(page, "/fr/race/settings");
        await page.getByRole("combobox", { name: fr.raceSettings.visibility.label, exact: true })
          .selectOption({ label: fr.raceSettings.visibility.code });
        await page.getByRole("button", { name: fr.raceSettings.invite.button, exact: true }).click();
        try {
          await expect(page.getByRole("heading", { name: fr.room.title, exact: true })).toBeVisible();
          await expect(page.getByRole("list", { name: fr.room.participants.title, exact: true }))
            .toBeVisible();
          await audit(page);
        } finally {
          const leave = page.getByRole("button", { name: fr.room.leave, exact: true });
          if (await leave.isVisible()) {
            await leave.click();
            await expect(page).toHaveURL("/fr/play");
          }
        }
      });
    });
  });
}
