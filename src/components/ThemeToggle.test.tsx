import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { THEME_STORAGE_KEY } from "@/theme/theme";
import { setThemePreference } from "@/theme/themeStore";
import { ThemeToggle } from "./ThemeToggle";

beforeEach(() => {
  window.localStorage.clear();
  setThemePreference("system");
  window.localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove("dark");
});

describe("ThemeToggle", () => {
  it.each(["fr", "en"] as const)("expose un groupe de trois choix traduits (%s)", (locale) => {
    const labels = getDictionary(locale).theme;
    render(<ThemeToggle labels={labels} />);

    expect(screen.getByRole("group", { name: labels.label })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    for (const name of [labels.light, labels.dark, labels.system]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
  });

  it("sélectionne « système » par défaut", () => {
    const labels = getDictionary("fr").theme;
    render(<ThemeToggle labels={labels} />);
    expect(screen.getByRole("radio", { name: labels.system })).toBeChecked();
  });

  it("applique et mémorise un choix manuel", () => {
    const labels = getDictionary("en").theme;
    render(<ThemeToggle labels={labels} />);

    fireEvent.click(screen.getByRole("radio", { name: labels.dark }));
    expect(screen.getByRole("radio", { name: labels.dark })).toBeChecked();
    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    fireEvent.click(screen.getByRole("radio", { name: labels.light }));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("repasser à « système » mémorise ce choix", () => {
    const labels = getDictionary("fr").theme;
    render(<ThemeToggle labels={labels} />);

    fireEvent.click(screen.getByRole("radio", { name: labels.dark }));
    fireEvent.click(screen.getByRole("radio", { name: labels.system }));
    expect(screen.getByRole("radio", { name: labels.system })).toBeChecked();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("reflète une préférence déjà stockée", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const labels = getDictionary("fr").theme;
    render(<ThemeToggle labels={labels} />);
    expect(screen.getByRole("radio", { name: labels.dark })).toBeChecked();
  });

  it("le mode compact fait défiler les trois préférences", () => {
    const labels = getDictionary("fr").theme;
    render(<ThemeToggle labels={labels} compact />);

    fireEvent.click(screen.getByRole("button", { name: `${labels.label}: ${labels.system}` }));
    expect(screen.getByRole("button", { name: `${labels.label}: ${labels.light}` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `${labels.label}: ${labels.light}` }));
    expect(screen.getByRole("button", { name: `${labels.label}: ${labels.dark}` })).toBeInTheDocument();
  });
});
