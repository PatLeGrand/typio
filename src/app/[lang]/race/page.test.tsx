import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RacePage from "./page";
import { DEFAULT_RACE_SETTINGS } from "@/race/config";
import { getDictionary } from "@/i18n/dictionaries";

describe("race route boundary", () => {
  it("rejects repeated configuration parameters with a path back to settings", async () => {
    render(await RacePage({ params: Promise.resolve({ lang: "fr" }), searchParams: Promise.resolve({ config: ["{}", "{}"] }) }));
    expect(screen.getByRole("alert")).toHaveTextContent(getDictionary("fr").raceEntry.invalid);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/fr/race/settings");
  });
  it("accepts validated settings without claiming the game has started", async () => {
    render(await RacePage({ params: Promise.resolve({ lang: "en" }),
      searchParams: Promise.resolve({ config: JSON.stringify({ ...DEFAULT_RACE_SETTINGS, timeLimitSeconds: 60 }) }) }));
    expect(screen.getByRole("status")).toHaveTextContent(getDictionary("en").raceEntry.pending);
    expect(screen.getByText("60 seconds")).toBeInTheDocument();
  });
});
