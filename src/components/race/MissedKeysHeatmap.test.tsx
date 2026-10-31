import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { MissedKeysHeatmap } from "./MissedKeysHeatmap";

it.each([
  ["fr", "a : 1 faute", "b : 2 fautes"],
  ["en", "a: 1 error", "b: 2 errors"],
] as const)("accorde les fautes au singulier et au pluriel en %s", (locale, singular, plural) => {
  render(<MissedKeysHeatmap missedKeys={{ a: 1, b: 2 }} locale={locale}
    labels={getDictionary(locale).raceScreen.results} />);
  expect(screen.getByText(singular)).toBeInTheDocument();
  expect(screen.getByText(plural)).toBeInTheDocument();
  expect(screen.getByLabelText(singular)).toBeInTheDocument();
});
