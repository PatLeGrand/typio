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

  it("carries the __Secure- prefix in production only", () => {
    expect(oauthCookieNames("github", "production").state).toBe("__Secure-typio_oauth_state_github");
    expect(oauthCookieNames("github", "test").state).toBe("typio_oauth_state_github");
  });
});

describe("oauthCookieOptions", () => {
  it("is HttpOnly, SameSite=Lax, scoped to /api/auth, 10 minutes", () => {
    expect(oauthCookieOptions("development")).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/api/auth",
      secure: false,
      maxAge: 600,
    });
  });

  it("is Secure in production only", () => {
    expect(oauthCookieOptions("production").secure).toBe(true);
    expect(oauthCookieOptions("development").secure).toBe(false);
  });
});

describe("expiredOAuthCookie", () => {
  it("clears the cookie with the same Path and a zero Max-Age", () => {
    expect(expiredOAuthCookie("typio_oauth_state_github", "production")).toEqual({
      name: "typio_oauth_state_github",
      value: "",
      options: { httpOnly: true, sameSite: "lax", path: "/api/auth", secure: true, maxAge: 0 },
    });
  });
});
