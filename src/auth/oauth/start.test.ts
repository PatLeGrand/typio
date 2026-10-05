// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createAuthLimiters } from "../rateLimit";
import { startOAuth, loginNoticeLocation, parseOAuthLocale } from "./start";
import { createFakeProvider } from "./testSupport";
import type { OAuthProviderClient, OAuthProviderName } from "./providers";

function deps(clients: Partial<Record<OAuthProviderName, OAuthProviderClient>>) {
  const now = 0;
  return { limiters: createAuthLimiters(() => now), getProvider: (name: OAuthProviderName) => clients[name] ?? null };
}

const github = () => createFakeProvider("github");
const discord = () => createFakeProvider("discord");

describe("startOAuth", () => {
  it("redirects to the provider's authorization URL, carrying the generated state", () => {
    const result = startOAuth(deps({ github: github() }), { provider: "github", rawLocale: "fr", ip: "203.0.113.7" });

    const url = new URL(result.location);
    expect(url.origin).toBe("https://github.example");
    const stateCookie = result.cookies.find((cookie) => cookie.name === "typio_oauth_state_github");
    expect(url.searchParams.get("state")).toBe(stateCookie?.value);
    expect(stateCookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("sets state and locale cookies with the right attributes", () => {
    const result = startOAuth(deps({ github: github() }), { provider: "github", rawLocale: "en", ip: "203.0.113.7" });

    expect(result.cookies.map((cookie) => cookie.name).sort()).toEqual([
      "typio_oauth_locale_github",
      "typio_oauth_state_github",
    ]);
    for (const cookie of result.cookies) {
      expect(cookie.options).toEqual({
        httpOnly: true,
        sameSite: "lax",
        path: "/api/auth",
        secure: false,
        maxAge: 600,
      });
    }
    expect(result.cookies.find((cookie) => cookie.name === "typio_oauth_locale_github")?.value).toBe("en");
  });

  it("generates a fresh state each time", () => {
    const d = deps({ github: github() });
    const first = startOAuth(d, { provider: "github", rawLocale: "fr", ip: "1.1.1.1" });
    const second = startOAuth(d, { provider: "github", rawLocale: "fr", ip: "1.1.1.1" });

    expect(first.cookies[0].value).not.toBe(second.cookies[0].value);
  });

  it("uses PKCE for Discord only: a verifier cookie, and the same verifier given to the URL", () => {
    const d = deps({ github: github(), discord: discord() });

    const discordResult = startOAuth(d, { provider: "discord", rawLocale: "fr", ip: "1.1.1.1" });
    const githubResult = startOAuth(d, { provider: "github", rawLocale: "fr", ip: "1.1.1.1" });

    const verifier = discordResult.cookies.find((cookie) => cookie.name === "typio_oauth_verifier_discord");
    expect(verifier?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new URL(discordResult.location).searchParams.get("code_verifier_seen")).toBe(verifier?.value);
    expect(githubResult.cookies.some((cookie) => cookie.name.includes("verifier"))).toBe(false);
    expect(new URL(githubResult.location).searchParams.has("code_verifier_seen")).toBe(false);
  });

  it("redirects to the login page with oauth=unavailable when the provider is not configured", () => {
    expect(startOAuth(deps({}), { provider: "github", rawLocale: "en", ip: "1.1.1.1" })).toEqual({
      location: "/en/login?oauth=unavailable",
      cookies: [],
    });
  });

  it.each([
    ["de", "fr"],
    ["", "fr"],
    [null, "fr"],
    ["EN", "fr"],
    ["en/../../evil", "fr"],
    ["en", "en"],
    ["fr", "fr"],
  ])("filters the locale %j to %s", (rawLocale, expected) => {
    const result = startOAuth(deps({}), { provider: "github", rawLocale, ip: "1.1.1.1" });
    expect(result.location).toBe(`/${expected}/login?oauth=unavailable`);
  });

  it("stores the validated locale, never the raw value", () => {
    const result = startOAuth(deps({ github: github() }), {
      provider: "github",
      rawLocale: "<script>",
      ip: "1.1.1.1",
    });
    expect(result.cookies.find((cookie) => cookie.name === "typio_oauth_locale_github")?.value).toBe("fr");
  });

  it("limits starts to 60 per IP per window, then redirects with oauth=failed and sets nothing", () => {
    const d = deps({ github: github() });
    for (let i = 0; i < 60; i += 1) {
      const result = startOAuth(d, { provider: "github", rawLocale: "fr", ip: "198.51.100.9" });
      expect(result.cookies.length).toBeGreaterThan(0);
    }

    expect(startOAuth(d, { provider: "github", rawLocale: "fr", ip: "198.51.100.9" })).toEqual({
      location: "/fr/login?oauth=failed",
      cookies: [],
    });
    // Une autre IP n'est pas touchée.
    expect(startOAuth(d, { provider: "github", rawLocale: "fr", ip: "198.51.100.10" }).cookies.length).toBeGreaterThan(0);
  });

  it("groups an IPv6 client by its /64 prefix, as the other limiters do", () => {
    const d = deps({ github: github() });
    for (let i = 0; i < 60; i += 1) {
      startOAuth(d, { provider: "github", rawLocale: "fr", ip: `2001:db8:0:1::${i + 1}` });
    }
    expect(startOAuth(d, { provider: "github", rawLocale: "fr", ip: "2001:db8:0:1:ffff::1" }).cookies).toEqual([]);
  });
});

describe("helpers", () => {
  it("parseOAuthLocale accepts fr and en only", () => {
    expect(parseOAuthLocale("en")).toBe("en");
    expect(parseOAuthLocale("fr")).toBe("fr");
    expect(parseOAuthLocale("es")).toBe("fr");
    expect(parseOAuthLocale(undefined)).toBe("fr");
  });

  it("loginNoticeLocation builds the login URL with the notice", () => {
    expect(loginNoticeLocation("en", "already_linked")).toBe("/en/login?oauth=already_linked");
  });
});
