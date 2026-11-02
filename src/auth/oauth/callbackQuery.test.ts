import { describe, expect, it } from "vitest";
import { parseOAuthCallbackQuery } from "./callbackQuery";
import { oauthProviderSchema } from "./providers";

describe("parseOAuthCallbackQuery", () => {
  it("lit code, state et error, absents donnant null", () => {
    expect(parseOAuthCallbackQuery(new URLSearchParams("code=abc&state=xyz"))).toEqual({
      code: "abc",
      state: "xyz",
      error: null,
    });
    expect(parseOAuthCallbackQuery(new URLSearchParams("error=access_denied"))).toEqual({
      code: null,
      state: null,
      error: "access_denied",
    });
  });

  it("refuse un paramètre démesuré", () => {
    expect(parseOAuthCallbackQuery(new URLSearchParams({ code: "a".repeat(2048), state: "s" }))).not.toBeNull();
    for (const name of ["code", "state", "error"]) {
      expect(parseOAuthCallbackQuery(new URLSearchParams({ [name]: "a".repeat(2049) }))).toBeNull();
    }
  });
});

describe("oauthProviderSchema", () => {
  it.each(["github", "discord"])("accepte %s", (provider) => {
    expect(oauthProviderSchema.safeParse(provider).success).toBe(true);
  });

  it.each(["GitHub", "google", "", "github ", undefined, null, 1])("refuse %j", (provider) => {
    expect(oauthProviderSchema.safeParse(provider).success).toBe(false);
  });
});
