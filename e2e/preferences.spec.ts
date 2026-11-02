import { expect, test } from "@playwright/test";
import en from "../src/i18n/dictionaries/en.json";
import fr from "../src/i18n/dictionaries/fr.json";

test("le choix FR → EN survit au rechargement et à une URL sans langue (I18N-02)", async ({ page }) => {
  await page.goto("/fr");
  await page.getByRole("banner").getByRole("link", { name: `EN — ${fr.language.names.en}`, exact: true }).click();
  await expect(page).toHaveURL("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(page).toHaveURL("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("banner").getByRole("link", { name: `FR — ${en.language.names.fr}`, exact: true })).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL("/en");
});

test("le thème sombre puis clair survit au rechargement (DES-05)", async ({ page }) => {
  await page.goto("/fr");
  const header = page.getByRole("banner");
  await header.getByRole("button", { name: `${fr.theme.label}: ${fr.theme.system}`, exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await header.getByRole("button", { name: `${fr.theme.label}: ${fr.theme.light}`, exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await header.getByRole("button", { name: `${fr.theme.label}: ${fr.theme.dark}`, exact: true }).click();
  await header.getByRole("button", { name: `${fr.theme.label}: ${fr.theme.system}`, exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await expect(header.getByRole("button", { name: `${fr.theme.label}: ${fr.theme.light}`, exact: true })).toBeVisible();
});
