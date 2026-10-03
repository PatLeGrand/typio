import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import Home from "./page";

function props(lang: string) {
  return { params: Promise.resolve({ lang }), searchParams: Promise.resolve({}) };
}

describe("Home", () => {
  it.each(["fr", "en"] as const)("affiche titre, accroche et deux boutons désactivés traduits (%s)", async (lang) => {
    const { home, site } = getDictionary(lang);
    render(await Home(props(lang)));

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: site.name })).toBeVisible();
    expect(screen.getByText(home.tagline)).toBeVisible();
    expect(screen.getByRole("button", { name: home.createRace })).toBeDisabled();
    expect(screen.getByRole("button", { name: home.joinWithCode })).toBeDisabled();
  });

  it("répond par une 404 pour une locale inconnue", async () => {
    await expect(Home(props("de"))).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});
