import { describe, expect, it } from "vitest";
import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS, getOtherLocale, isLocale, locales } from "./config";

describe("isLocale", () => {
  it("accepte uniquement les locales supportées", () => {
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale("FR")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

describe("getOtherLocale", () => {
  it("renvoie l'autre langue, toujours différente de la courante", () => {
    expect(getOtherLocale("fr")).toBe("en");
    expect(getOtherLocale("en")).toBe("fr");
    for (const locale of locales) expect(getOtherLocale(locale)).not.toBe(locale);
  });
});

describe("LOCALE_COOKIE_OPTIONS", () => {
  it("vaut pour tout le site, dure un an, SameSite=Lax", () => {
    expect(LOCALE_COOKIE).toBe("NEXT_LOCALE");
    expect(LOCALE_COOKIE_OPTIONS).toEqual({ path: "/", maxAge: 31536000, sameSite: "lax" });
  });
});
