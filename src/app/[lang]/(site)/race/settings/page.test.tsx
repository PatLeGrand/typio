import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RaceSettingsPage from "./page";
import { DEFAULT_RACE_SETTINGS } from "@/race/config";
import fr from "@/i18n/dictionaries/fr.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const copy = fr.raceSettings;

async function renderPage(config: string | string[] | undefined) {
  render(await RaceSettingsPage({ params: Promise.resolve({ lang: "fr" }), searchParams: Promise.resolve({ config }) }));
}

describe("race settings page", () => {
  it("starts from the defaults without a config", async () => {
    await renderPage(undefined);
    expect(screen.getByRole("radio", { name: copy.timeLimit.none })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Phrases" })).toHaveAttribute("aria-checked", "true");
  });

  it("pre-fills the choices from a valid ?config= (back from a race)", async () => {
    await renderPage(JSON.stringify({ ...DEFAULT_RACE_SETTINGS, textMode: "words", timeLimitSeconds: 120 }));
    expect(screen.getByRole("radio", { name: "Mots" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "2 min" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: copy.timeLimit.none })).toHaveAttribute("aria-checked", "false");
  });

  it("falls back to the defaults for an invalid config", async () => {
    await renderPage("{not json");
    expect(screen.getByRole("radio", { name: copy.timeLimit.none })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Phrases" })).toHaveAttribute("aria-checked", "true");
  });
});
