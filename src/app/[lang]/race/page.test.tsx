import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RacePage, { generateMetadata } from "./page";
import { DEFAULT_RACE_SETTINGS } from "@/race/config";
import { getDictionary } from "@/i18n/dictionaries";

vi.mock("@/race/drizzleTextCorpusRepository", async () => {
  const { TEST_CORPUS } = await import("@/test/corpus");
  return { textCorpusRepository: { load: async () => TEST_CORPUS } };
});
vi.mock("next/navigation", () => ({ usePathname: () => "/fr/race" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.8" }) }));
vi.mock("@/auth/currentUser", () => ({ getCurrentUserForDisplay: async () => ({ displayName: "Aurel", kind: "member" }) }));
vi.mock("@/components/race/RaceVisualizer", () => ({ RaceVisualizer: () => <div data-testid="visualizer" /> }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => vi.unstubAllGlobals());

describe("race route boundary", () => {
  it.each(["fr", "en"] as const)("rejects repeated configuration parameters with a path back to settings (%s)", async (lang) => {
    const props = { params: Promise.resolve({ lang }), searchParams: Promise.resolve({ config: ["{}", "{}"] }) };
    const { raceEntry, site } = getDictionary(lang);
    render(await RacePage(props));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(raceEntry.invalidTitle);
    expect(await generateMetadata(props)).toEqual({ title: `${raceEntry.invalidTitle} | ${site.name}` });
    expect(screen.getByRole("alert")).toHaveTextContent(raceEntry.invalid);
    expect(screen.getByRole("link", { name: raceEntry.back })).toHaveAttribute("href", `/${lang}/race/settings`);
  });
  it("uses the race title for valid settings metadata", async () => {
    const { raceEntry, site } = getDictionary("en");
    const props = { params: Promise.resolve({ lang: "en" }),
      searchParams: Promise.resolve({ config: JSON.stringify(DEFAULT_RACE_SETTINGS) }) };
    expect(await generateMetadata(props)).toEqual({ title: `${raceEntry.title} | ${site.name}` });
  });
  it("renders the race screen for validated settings", async () => {
    const copy = getDictionary("en").raceScreen;
    render(await RacePage({ params: Promise.resolve({ lang: "en" }),
      searchParams: Promise.resolve({ config: JSON.stringify({ ...DEFAULT_RACE_SETTINGS, bots: ["intermediate", "intermediate", "intermediate"], timeLimitSeconds: 60 }) }) }));
    expect(screen.getByRole("heading", { name: new RegExp(copy.headline.countdown) })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: copy.leaderboard })).toBeInTheDocument();
    expect(screen.getByTestId("visualizer")).toBeInTheDocument();
    expect(screen.getByText("Aurel")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "FR — Français" })).toHaveAttribute("href", "/fr/race");
    expect(screen.getByRole("button", { name: new RegExp(getDictionary("en").theme.label) })).toBeInTheDocument();
    expect(screen.getAllByRole("status")[0]).toHaveTextContent(copy.status.countdown);
    // Ready to type, but the keystrokes only count once the countdown ends.
    const input = screen.getByLabelText(copy.typing.inputLabel) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "x" } });
    expect(input.value).toBe("");
    // The local runner plus three bots appear in the leaderboard.
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    // The server draws the text, so the client hydrates the very same one.
    expect(document.getElementById("race-text")?.textContent?.length).toBeGreaterThan(50);
  });
  it("explains when the filters leave no text instead of starting an empty race", async () => {
    const copy = getDictionary("fr").raceScreen;
    render(await RacePage({ params: Promise.resolve({ lang: "fr" }),
      searchParams: Promise.resolve({ config: JSON.stringify({ ...DEFAULT_RACE_SETTINGS, excludedCharacters: "a e i o u y" }) }) }));
    expect(screen.getByRole("alert")).toHaveTextContent(copy.noText.message);
    expect(screen.queryByTestId("visualizer")).not.toBeInTheDocument();
  });
});
