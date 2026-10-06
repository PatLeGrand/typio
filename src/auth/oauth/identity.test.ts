import { describe, expect, it } from "vitest";
import { validateUsername } from "../validation";
import { deriveUsernameBase, usernameForAttempt } from "./identity";

describe("deriveUsernameBase", () => {
  it.each([
    ["octocat", "octocat"],
    ["Octo-Cat", "octo_cat"],
    ["jean.luc", "jean_luc"],
    ["Élodie", "elodie"],
    ["__x__yz__", "x__yz"],
    ["a-very-long-login-name-indeed", "a_very_long_logi"],
    ["trailing-cut-here-ok", "trailing_cut_her"],
  ])("%s -> %s", (login, expected) => {
    expect(deriveUsernameBase(login)).toBe(expected);
  });

  it.each(["ab", "a", "", "--", "日本語", "😀😀😀"])("falls back to « joueur » when %j leaves fewer than 3 characters", (login) => {
    expect(deriveUsernameBase(login)).toBe("joueur");
  });

  it("never exceeds 16 characters and never ends with an underscore", () => {
    const base = deriveUsernameBase("abcdefghijklmno-pqrstu");
    expect(base.length).toBeLessThanOrEqual(16);
    expect(base.endsWith("_")).toBe(false);
  });

  it.each(["octocat", "Octo-Cat", "日本語", "x".repeat(100), "a.b.c.d.e.f.g.h.i.j.k.l"])(
    "always passes the username validation, with a suffix too (%s)",
    (login) => {
      const base = deriveUsernameBase(login);
      expect(validateUsername(base).ok).toBe(true);
      expect(validateUsername(usernameForAttempt(base, 1, () => "999")).ok).toBe(true);
    },
  );
});

describe("usernameForAttempt", () => {
  it("uses the base for the first attempt, then the base with _ and 3 digits", () => {
    expect(usernameForAttempt("octocat", 0, () => "123")).toBe("octocat");
    expect(usernameForAttempt("octocat", 1, () => "042")).toBe("octocat_042");
    expect(usernameForAttempt("octocat", 4, () => "007")).toBe("octocat_007");
  });

  it("draws random three-digit suffixes by default", () => {
    for (let i = 0; i < 50; i += 1) expect(usernameForAttempt("abc", 1)).toMatch(/^abc_\d{3}$/);
  });
});
