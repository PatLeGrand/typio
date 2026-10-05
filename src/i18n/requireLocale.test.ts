import { describe, expect, it } from "vitest";
import { requireLocale } from "./requireLocale";

describe("requireLocale", () => {
  it("renvoie la locale quand elle est supportée", () => {
    expect(requireLocale("fr")).toBe("fr");
    expect(requireLocale("en")).toBe("en");
  });

  it("déclenche une 404 pour une locale inconnue", () => {
    expect(() => requireLocale("de")).toThrow(expect.objectContaining({ digest: expect.stringContaining("404") }));
  });
});
