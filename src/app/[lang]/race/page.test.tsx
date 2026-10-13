import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RacePage from "./page";
import { DEFAULT_RACE_SETTINGS } from "@/race/config";
import { getDictionary } from "@/i18n/dictionaries";

vi.mock("@/auth/currentUser", () => ({ getCurrentUserForDisplay: async () => ({ displayName: "Aurel", kind: "member" }) }));
vi.mock("@/components/race/RaceVisualizer", () => ({ RaceVisualizer: () => <div data-testid="visualizer" /> }));

describe("race route boundary", () => {
  it("rejects repeated configuration parameters with a path back to settings", async () => {
    render(await RacePage({ params: Promise.resolve({ lang: "fr" }), searchParams: Promise.resolve({ config: ["{}", "{}"] }) }));
    expect(screen.getByRole("alert")).toHaveTextContent(getDictionary("fr").raceEntry.invalid);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/fr/race/settings");
  });
  it("renders the race screen for validated settings", async () => {
    const copy = getDictionary("en").raceScreen;
    render(await RacePage({ params: Promise.resolve({ lang: "en" }),
      searchParams: Promise.resolve({ config: JSON.stringify({ ...DEFAULT_RACE_SETTINGS, botCount: 3, timeLimitSeconds: 60 }) }) }));
    expect(screen.getByRole("heading", { name: new RegExp(copy.headline.countdown) })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: copy.leaderboard })).toBeInTheDocument();
    expect(screen.getByTestId("visualizer")).toBeInTheDocument();
    expect(screen.getByText("Aurel")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(copy.status.countdown);
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
