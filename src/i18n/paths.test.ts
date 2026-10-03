import { describe, expect, it } from "vitest";
import { getPathInLocale, getPathLocale, hasLocalePrefix, needsLocaleRedirect, prefixWithLocale } from "./paths";

describe("getPathLocale", () => {
  it("renvoie la locale du premier segment, sinon null", () => {
    expect(getPathLocale("/fr")).toBe("fr");
    expect(getPathLocale("/en/room/abc")).toBe("en");
    expect(getPathLocale("/")).toBeNull();
    expect(getPathLocale("/de/x")).toBeNull();
    expect(getPathLocale("/room/en")).toBeNull();
  });
});

describe("hasLocalePrefix", () => {
  it("reconnaît une locale en premier segment", () => {
    expect(hasLocalePrefix("/fr")).toBe(true);
    expect(hasLocalePrefix("/en/room/abc")).toBe(true);
  });

  it("refuse les locales inconnues et les faux amis", () => {
    expect(hasLocalePrefix("/")).toBe(false);
    expect(hasLocalePrefix("/de")).toBe(false);
    expect(hasLocalePrefix("/french")).toBe(false);
    expect(hasLocalePrefix("/room/en")).toBe(false);
  });
});

describe("needsLocaleRedirect", () => {
  it("redirige un chemin sans locale", () => {
    expect(needsLocaleRedirect("/")).toBe(true);
    expect(needsLocaleRedirect("/room/abc")).toBe(true);
    expect(needsLocaleRedirect("/de")).toBe(true);
    expect(needsLocaleRedirect("/apiary")).toBe(true);
  });

  it("ne redirige pas un chemin déjà préfixé, /api ni /_next", () => {
    expect(needsLocaleRedirect("/fr")).toBe(false);
    expect(needsLocaleRedirect("/en/x")).toBe(false);
    expect(needsLocaleRedirect("/api")).toBe(false);
    expect(needsLocaleRedirect("/api/health")).toBe(false);
    expect(needsLocaleRedirect("/_next/data/x.json")).toBe(false);
  });
});

describe("prefixWithLocale", () => {
  it("préfixe la racine et les chemins", () => {
    expect(prefixWithLocale("/", "en")).toBe("/en");
    expect(prefixWithLocale("/room/abc", "fr")).toBe("/fr/room/abc");
  });
});

describe("getPathInLocale", () => {
  it("remplace le segment de locale en conservant le reste", () => {
    expect(getPathInLocale("/fr", "en")).toBe("/en");
    expect(getPathInLocale("/fr/", "en")).toBe("/en/");
    expect(getPathInLocale("/en/room/abc", "fr")).toBe("/fr/room/abc");
  });

  it("préfixe un chemin sans locale", () => {
    expect(getPathInLocale("/", "en")).toBe("/en");
    expect(getPathInLocale("/room/abc", "en")).toBe("/en/room/abc");
  });

  it("ne touche pas à un segment qui ressemble à une locale plus loin dans le chemin", () => {
    expect(getPathInLocale("/fr/en/x", "en")).toBe("/en/en/x");
  });

  it("est idempotent quand la cible est la langue courante", () => {
    expect(getPathInLocale("/en/room", "en")).toBe("/en/room");
  });
});
