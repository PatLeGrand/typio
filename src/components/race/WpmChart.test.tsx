import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { WpmChart } from "./WpmChart";

describe("WpmChart", () => {
  it.each([15400, 15000, 400, 0])("termine la courbe au MPM final à %i ms sans modifier la série", (timeMs) => {
    const wpmSeries = Array.from({ length: Math.floor(timeMs / 1000) + 1 }, () => 20);
    const original = [...wpmSeries];
    const { container } = render(
      <WpmChart rows={[{ id: "player", name: "Player", wpm: 80, timeMs, wpmSeries }]}
        locale="fr" labels={getDictionary("fr").raceScreen.results} />,
    );
    const points = container.querySelector("polyline")!.getAttribute("points")!.split(" ");
    expect(points.at(-1)).toBe(`${64 + timeMs / 1000 / Math.max(1, timeMs / 1000) * 392},40`);
    expect(points).toHaveLength(Math.ceil(timeMs / 1000) + 1);
    const row = screen.getByRole("row", { name: "Player 80 80" });
    expect(row).toBeInTheDocument();
    expect(wpmSeries).toEqual(original);
  });
});
