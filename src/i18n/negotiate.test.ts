import { describe, expect, it } from "vitest";
import { negotiateLocale, resolveLocale } from "./negotiate";

describe("negotiateLocale", () => {
  it("retient la langue primaire d'une variante régionale", () => {
    expect(negotiateLocale("en-US,en;q=0.9")).toBe("en");
    expect(negotiateLocale("fr-CA")).toBe("fr");
  });

  it("respecte les q-values plutôt que l'ordre", () => {
    expect(negotiateLocale("fr;q=0.5,en;q=0.9")).toBe("en");
    expect(negotiateLocale("fr;q=0.8,en;q=0.8")).toBe("fr");
    expect(negotiateLocale("en;q=0.8,fr;q=0.8")).toBe("en");
  });

  it("ignore les langues non supportées et prend la première qui l'est", () => {
    expect(negotiateLocale("de-DE,de;q=0.9,en;q=0.5")).toBe("en");
    expect(negotiateLocale("es,fr;q=0.2")).toBe("fr");
  });

  it("est insensible à la casse et aux espaces", () => {
    expect(negotiateLocale(" EN-gb ; q=0.7 , FR ; q=0.3 ")).toBe("en");
  });

  it("écarte q=0 (non acceptable)", () => {
    expect(negotiateLocale("en;q=0,fr;q=0.1")).toBe("fr");
    expect(negotiateLocale("en;q=0")).toBeNull();
  });

  it("renvoie null sans langue supportée", () => {
    expect(negotiateLocale("de,ja;q=0.8")).toBeNull();
    expect(negotiateLocale("*")).toBeNull();
  });

  it("renvoie null pour un en-tête absent, vide ou invalide", () => {
    expect(negotiateLocale(null)).toBeNull();
    expect(negotiateLocale(undefined)).toBeNull();
    expect(negotiateLocale("")).toBeNull();
    expect(negotiateLocale(";;;,,,")).toBeNull();
    expect(negotiateLocale("<script>alert(1)</script>")).toBeNull();
  });

  it("ignore un q invalide sans planter", () => {
    expect(negotiateLocale("en;q=abc")).toBe("en");
    expect(negotiateLocale("en;q=5,fr;q=0.5")).toBe("en");
  });

  it("ne confond pas un préfixe avec une langue (« english » n'est pas « en »)", () => {
    expect(negotiateLocale("english")).toBeNull();
  });

  it("borne la longueur analysée", () => {
    expect(negotiateLocale(`${"de,".repeat(1000)}en`)).toBeNull();
  });
});

describe("resolveLocale", () => {
  it("donne la priorité au cookie, quel que soit l'en-tête", () => {
    expect(resolveLocale({ cookie: "en", acceptLanguage: "fr-FR,fr;q=0.9" })).toBe("en");
    expect(resolveLocale({ cookie: "fr", acceptLanguage: "en-US" })).toBe("fr");
  });

  it("ignore un cookie invalide et retombe sur Accept-Language", () => {
    expect(resolveLocale({ cookie: "de", acceptLanguage: "en-US" })).toBe("en");
    expect(resolveLocale({ cookie: "", acceptLanguage: "en-US" })).toBe("en");
  });

  it("utilise Accept-Language sans cookie", () => {
    expect(resolveLocale({ acceptLanguage: "en-US,en;q=0.9" })).toBe("en");
    expect(resolveLocale({ cookie: null, acceptLanguage: "fr-CA" })).toBe("fr");
  });

  it("retombe sur le français sans cookie ni langue reconnue", () => {
    expect(resolveLocale({})).toBe("fr");
    expect(resolveLocale({ acceptLanguage: "de" })).toBe("fr");
    expect(resolveLocale({ cookie: "xx", acceptLanguage: "???" })).toBe("fr");
  });
});
