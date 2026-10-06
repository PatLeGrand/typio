import { describe, expect, it } from "vitest";
import { expiredOAuthCookie, oauthCookieNames, oauthCookieOptions } from "./cookies";

describe("oauthCookieNames", () => {
  it("is specific to each provider, so a state set for GitHub never serves Discord", () => {
    const github = oauthCookieNames("github", "development");
    const discord = oauthCookieNames("discord", "development");
    expect(github.state).toBe("typio_oauth_state_github");
    expect(discord.state).toBe("typio_oauth_state_discord");
    expect(new Set([...Object.values(github), ...Object.values(discord)]).size).toBe(6);
  });

  it("carries the __Host- prefix in production, for all three cookies", () => {
    expect(oauthCookieNames("github", "production")).toEqual({
      state: "__Host-typio_oauth_state_github",
      verifier: "__Host-typio_oauth_verifier_github",
      locale: "__Host-typio_oauth_locale_github",
    });
  });

  it("has plain names in development and test (the prefix is refused over http)", () => {
    for (const env of ["development", "test", undefined]) {
      for (const name of Object.values(oauthCookieNames("discord", env))) expect(name.startsWith("__")).toBe(false);
    }
  });
});

describe("oauthCookieOptions", () => {
  it("production: __Host- compatible, so Secure, Path=/, no Domain, HttpOnly, SameSite=Lax, 10 minutes", () => {
    const options = oauthCookieOptions("production");

    expect(options).toEqual({ httpOnly: true, sameSite: "lax", path: "/", secure: true, maxAge: 600 });
    expect(options).not.toHaveProperty("domain");
  });

  it("development: same attributes except Secure", () => {
    expect(oauthCookieOptions("development")).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
      maxAge: 600,
    });
  });
});

describe("expiredOAuthCookie", () => {
  it("clears the cookie with the same attributes and a zero Max-Age (production)", () => {
    expect(expiredOAuthCookie("__Host-typio_oauth_state_github", "production")).toEqual({
      name: "__Host-typio_oauth_state_github",
      value: "",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: true, maxAge: 0 },
    });
  });

  it("clears the cookie in development without Secure", () => {
    expect(expiredOAuthCookie("typio_oauth_state_github", "development").options).toMatchObject({
      path: "/",
      secure: false,
      maxAge: 0,
    });
  });
});
