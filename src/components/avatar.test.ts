import { describe, expect, it } from "vitest";
import { AVATAR_COLOR_COUNT, avatarColorIndex, avatarInitial, avatarUrl } from "./avatar";

describe("avatarColorIndex", () => {
  it("est déterministe et reste dans la palette", () => {
    expect(avatarColorIndex("bot-0")).toBe(avatarColorIndex("bot-0"));
    for (const seed of ["", "a", "Zoé", "11111111-1111-1111-1111-111111111111", "🙂"]) {
      const index = avatarColorIndex(seed);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(AVATAR_COLOR_COUNT);
    }
  });

  it("utilise plusieurs couleurs", () => {
    const indexes = new Set(Array.from({ length: 50 }, (_, i) => avatarColorIndex(`user-${i}`)));
    expect(indexes.size).toBeGreaterThan(3);
  });
});

describe("avatarInitial", () => {
  it("met la première lettre en majuscule, accent compris", () => {
    expect(avatarInitial("alice")).toBe("A");
    expect(avatarInitial("élodie")).toBe("É");
  });

  it("prend le premier graphème entier d'un emoji", () => {
    expect(avatarInitial("👩‍💻 dev")).toBe("👩‍💻");
  });

  it("renvoie ? pour un nom vide", () => {
    expect(avatarInitial("")).toBe("?");
    expect(avatarInitial("   ")).toBe("?");
  });
});

describe("avatarUrl", () => {
  it("construit l'URL versionnée", () => {
    expect(avatarUrl("abc", 3)).toBe("/api/avatars/abc?v=3");
  });

  it("renvoie null sans photo", () => {
    expect(avatarUrl("abc", null)).toBeNull();
    expect(avatarUrl("abc", undefined)).toBeNull();
    expect(avatarUrl(undefined, 3)).toBeNull();
  });
});
