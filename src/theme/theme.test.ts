import { describe, expect, it } from "vitest";
import { isThemePreference, resolveEffectiveTheme } from "./theme";

describe("resolveEffectiveTheme", () => {
  it("suit le système en mode « system »", () => {
    expect(resolveEffectiveTheme("system", true)).toBe("dark");
    expect(resolveEffectiveTheme("system", false)).toBe("light");
  });

  it("un choix manuel l'emporte sur le système", () => {
    expect(resolveEffectiveTheme("light", true)).toBe("light");
    expect(resolveEffectiveTheme("dark", false)).toBe("dark");
  });
});

describe("isThemePreference", () => {
  it("accepte les trois préférences et rejette le reste", () => {
    for (const value of ["light", "dark", "system"]) expect(isThemePreference(value)).toBe(true);
    for (const value of ["auto", "", "Dark", null, undefined, 1]) expect(isThemePreference(value)).toBe(false);
  });
});
