import { randomBytes, randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import fr from "../src/i18n/dictionaries/fr.json";

export const authFiles = {
  memberA: "e2e/.auth/member-a.json",
  memberB: "e2e/.auth/member-b.json",
};

export function createCredentials() {
  return {
    username: `e2e${randomBytes(8).toString("hex")}`,
    password: `Typio9-${randomUUID()}`,
  };
}

export async function registerMember(page: Page, account: ReturnType<typeof createCredentials>) {
  await page.goto("/fr/register");
  await page.getByLabel(fr.register.pseudoLabel, { exact: true }).fill(account.username);
  await page.getByLabel(fr.register.passwordLabel, { exact: true }).fill(account.password);
  await page.getByLabel(fr.register.confirmLabel, { exact: true }).fill(account.password);
  await page.getByRole("checkbox", {
    name: fr.register.termsBefore + fr.register.privacyLink,
  }).check();
  await page.getByRole("button", { name: fr.register.submit, exact: true }).click();
  await expect(page).toHaveURL("/fr");
  await expect(page.getByRole("banner").getByRole("button", {
    name: account.username,
    exact: true,
  })).toBeVisible();
}
