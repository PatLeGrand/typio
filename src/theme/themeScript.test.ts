import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY } from "./theme";
import { themeInitScript } from "./themeScript";

function mockSystemDark(matches: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches }));
}

function runScript() {
  new Function(themeInitScript)();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("themeInitScript", () => {
  it("suit le système sans préférence stockée", () => {
    mockSystemDark(true);
    runScript();
    expect(document.documentElement).toHaveClass("dark");

    mockSystemDark(false);
    runScript();
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("un choix stocké l'emporte sur le système", () => {
    mockSystemDark(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    runScript();
    expect(document.documentElement).not.toHaveClass("dark");

    mockSystemDark(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    runScript();
    expect(document.documentElement).toHaveClass("dark");
  });

  it("traite « system » et une valeur inconnue comme le système", () => {
    mockSystemDark(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    runScript();
    expect(document.documentElement).toHaveClass("dark");

    document.documentElement.classList.remove("dark");
    window.localStorage.setItem(THEME_STORAGE_KEY, "garbage");
    runScript();
    expect(document.documentElement).toHaveClass("dark");
  });

  it("ne plante pas si localStorage lève une exception et suit alors le système", () => {
    mockSystemDark(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => runScript()).not.toThrow();
    expect(document.documentElement).toHaveClass("dark");
  });

  it("ne plante pas si matchMedia est indisponible", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(() => runScript()).not.toThrow();
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
