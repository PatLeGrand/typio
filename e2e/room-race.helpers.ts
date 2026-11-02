import { expect, type Browser, type Page } from "@playwright/test";
import fr from "../src/i18n/dictionaries/fr.json";
import { createCredentials } from "./auth.helpers";

type RoomRaceHooks = {
  configureGuest?: (guest: Page) => Promise<void>;
  onRoomReady?: (page: Page) => Promise<void>;
  onResults?: (page: Page, guest: Page) => Promise<void>;
  onHistory?: (page: Page) => Promise<void>;
};

export async function runRoomRace(
  { page, browser, baseURL }: { page: Page; browser: Browser; baseURL: string | undefined },
  hooks: RoomRaceHooks = {},
) {
  await page.goto("/fr/profile");
  const memberName = await page.getByLabel(fr.profile.identity.displayName, { exact: true }).inputValue();
  await page.goto("/fr/history");
  const previousDetails = page.getByRole("link", { name: fr.history.view, exact: true }).first();
  const previousRaceHref = await previousDetails.count() ? await previousDetails.getAttribute("href") : null;

  const guestContext = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    const guest = await guestContext.newPage();
    await hooks.configureGuest?.(guest);
    const guestName = `gst${createCredentials().username.slice(3)}`;
    await guest.goto("/fr/guest");
    await guest.getByLabel(fr.guest.pseudoLabel, { exact: true }).fill(guestName);
    await guest.getByRole("button", { name: fr.guest.submit, exact: true }).click();
    await expect(guest).toHaveURL("/fr");

    await page.goto("/fr/race/settings");
    const settings = fr.raceSettings;
    const removeBot = page.getByRole("button", { name: settings.bots.remove.replace("{number}", "1"), exact: true });
    while (await removeBot.count()) await removeBot.click();
    await page.getByRole("radiogroup", { name: settings.textMode.label, exact: true })
      .getByRole("radio", { name: settings.textMode.words, exact: true }).click();
    await page.getByRole("radiogroup", { name: settings.complexity.label, exact: true })
      .getByRole("radio", { name: settings.complexity.easy }).click();
    await page.getByRole("radiogroup", { name: settings.accents.label, exact: true })
      .getByRole("radio", { name: settings.accents.exclude, exact: true }).click();
    await page.getByRole("radiogroup", { name: settings.length.label, exact: true })
      .getByRole("radio", { name: settings.length.short, exact: true }).click();
    for (const option of ["punctuation", "numbers", "uppercase"] as const) {
      const toggle = page.getByRole("switch", { name: settings[option].label, exact: true });
      if (await toggle.getAttribute("aria-checked") === "true") await toggle.click();
    }
    await page.getByRole("combobox", { name: settings.visibility.label, exact: true })
      .selectOption({ label: settings.visibility.code });
    await page.getByRole("button", { name: settings.invite.button, exact: true }).click();
    await expect(page.getByRole("heading", { name: fr.room.title, exact: true })).toBeVisible();

    await hooks.onRoomReady?.(page);

    const codeHeading = page.getByRole("heading", { name: fr.room.code.label, exact: true });
    const code = (await codeHeading.locator("..").getByRole("paragraph").first().innerText()).trim();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    const participants = page.getByRole("list", { name: fr.room.participants.title, exact: true });
    await expect(participants.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("button", { name: fr.room.race.start, exact: true })).toBeDisabled();

    await guest.getByLabel(fr.home.joinByCode.label, { exact: true }).fill(code);
    await guest.getByRole("button", { name: fr.home.joinByCode.button, exact: true }).click();
    await expect(guest).toHaveURL(page.url());
    for (const client of [page, guest]) {
      const list = client.getByRole("list", { name: fr.room.participants.title, exact: true });
      await expect(list.getByRole("listitem")).toHaveCount(2);
      await expect(list.getByRole("listitem").filter({ hasText: memberName })).toBeVisible();
      await expect(list.getByRole("listitem").filter({ hasText: guestName })).toBeVisible();
    }

    await page.getByRole("button", { name: fr.room.race.start, exact: true }).click();
    for (const client of [page, guest]) {
      await expect(client.getByRole("heading", { name: fr.raceScreen.headline.countdown, exact: true })).toBeVisible();
    }
    const texts: string[] = [];
    for (const client of [page, guest]) {
      const input = client.getByRole("textbox", { name: fr.raceScreen.typing.inputLabel, exact: true });
      await expect(input).toBeVisible({ timeout: 10_000 });
      // Le texte visible est celui associé au champ par aria-describedby.
      const textId = await input.getAttribute("aria-describedby");
      const text = await client.locator(`[id="${textId}"]`).innerText();
      expect(text).toMatch(/^[a-z]+(?: [a-z]+)*$/);
      texts.push(text);
    }
    expect(texts[1]).toBe(texts[0]);
    for (const [index, client] of [page, guest].entries()) {
      // applyInput : <= 25 opérations/s + 15 de marge, lots <= 64.
      // raceInput : un lot/100 ms. 100 ms/caractère reste à ~10 opérations/s.
      await client.getByRole("textbox", { name: fr.raceScreen.typing.inputLabel, exact: true })
        .pressSequentially(texts[index], { delay: 100 });
    }

    for (const client of [page, guest]) {
      await expect(client.getByRole("heading", { name: fr.raceScreen.results.podium, exact: true })).toBeVisible();
      const table = client.getByRole("table", { name: fr.raceScreen.results.tableTitle, exact: true });
      for (const column of ["rank", "wpm", "accuracy"] as const) {
        await expect(table.getByRole("columnheader", { name: fr.raceScreen.results.columns[column], exact: true })).toBeVisible();
      }
      await expect(table.getByRole("row")).toHaveCount(3);
      for (const [index, name] of [memberName, guestName].entries()) {
        const row = table.getByRole("row").filter({ has: client.getByRole("rowheader", { name, exact: false }) });
        const cells = row.getByRole("cell");
        await expect(cells.nth(0)).toHaveText(String(index + 1));
        await expect(cells.nth(1)).toHaveText(/^\d+(?:,\d+)?$/);
        expect(Number((await cells.nth(1).innerText()).replace(",", "."))).toBeGreaterThan(0);
        await expect(cells.nth(3)).toHaveText(/^100\s*%$/);
        await expect(cells.nth(4)).toHaveText("0");
        await expect(cells.nth(7)).toHaveText(fr.raceScreen.results.statuses.finished);
      }
    }
    await hooks.onResults?.(page, guest);

    const memberRow = page.getByRole("table", { name: fr.raceScreen.results.tableTitle, exact: true })
      .getByRole("row").filter({ hasText: memberName });
    const memberWpm = await memberRow.getByRole("cell").nth(1).innerText();
    await page.getByRole("button", { name: fr.room.leave, exact: true }).click();
    await expect(page).toHaveURL("/fr/play");

    // L'enregistrement PostgreSQL est asynchrone après la diffusion des résultats.
    await expect(async () => {
      await page.goto("/fr/history");
      const details = page.getByRole("link", { name: fr.history.view, exact: true }).first();
      await expect(details).toBeVisible();
      expect(await details.getAttribute("href")).not.toBe(previousRaceHref);
    }).toPass({ timeout: 10_000 });
    const historyRow = page.getByRole("table", { name: fr.history.title, exact: true }).getByRole("row").nth(1);
    await expect(historyRow.getByRole("cell").nth(0)).toHaveText("1 / 2");
    await expect(historyRow.getByRole("cell").nth(1)).toContainText(memberWpm);
    await expect(historyRow.getByRole("cell").nth(2)).toHaveText(/^100\s*%$/);
    await historyRow.getByRole("link", { name: fr.history.view, exact: true }).click();
    await expect(page).toHaveURL(/\/fr\/history\/[^/]+$/);
    await expect(page.getByRole("heading", { name: fr.history.detailTitle, exact: true })).toBeVisible();
    await expect(page.getByText(fr.history.participants.replace("{count}", "2"), { exact: true })).toBeVisible();
    const detailTable = page.getByRole("table", { name: fr.raceScreen.results.tableTitle, exact: true });
    await expect(detailTable.getByRole("row")).toHaveCount(2);
    const detailRow = detailTable.getByRole("row").filter({ hasText: memberName });
    await expect(detailRow.getByRole("cell").nth(0)).toHaveText("1");
    await expect(detailRow.getByRole("cell").nth(1)).toHaveText(memberWpm);
    await expect(detailRow.getByRole("cell").nth(3)).toHaveText(/^100\s*%$/);
    await hooks.onHistory?.(page);
  } finally {
    try {
      const leave = page.getByRole("button", { name: fr.room.leave, exact: true });
      if (await leave.isVisible()) await leave.click();
    } finally {
      await guestContext.close();
    }
  }
}
