// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createSession } from "../session";
import { createTestDeps } from "../testSupport";
import { loginNoticeLocation, parseOAuthLocale } from "./locale";
import type { OAuthProviderClient, OAuthProviderName } from "./providers";
import { startOAuth } from "./start";
import { createFakeProvider } from "./testSupport";

function setup(clients: Partial<Record<OAuthProviderName, OAuthProviderClient>>) {
  const test = createTestDeps();
  const deps = {
    limiters: test.deps.limiters,
    sessions: test.deps.sessions,
    now: test.deps.now,
    getProvider: (name: OAuthProviderName) => clients[name] ?? null,
  };
  return { ...test, startDeps: deps };
}

const github = () => createFakeProvider("github");
const discord = () => createFakeProvider("discord");

describe("startOAuth", () => {
  it("redirects to the provider's authorization URL, carrying the generated state", async () => {
    const { startDeps } = setup({ github: github() });

    const result = await startOAuth(startDeps, { provider: "github", rawLocale: "fr", ip: "203.0.113.7" });

    const url = new URL(result.location);
    expect(url.origin).toBe("https://github.example");
    const stateCookie = result.cookies.find((cookie) => cookie.name === "typio_oauth_state_github");
    expect(url.searchParams.get("state")).toBe(stateCookie?.value);
    expect(stateCookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("sets state and locale cookies: HttpOnly, SameSite=Lax, Path=/, 10 minutes (development: no Secure)", async () => {
    const { startDeps } = setup({ github: github() });

    const result = await startOAuth(startDeps, { provider: "github", rawLocale: "en", ip: "203.0.113.7" });

    expect(result.cookies.map((cookie) => cookie.name).sort()).toEqual([
      "typio_oauth_locale_github",
      "typio_oauth_state_github",
    ]);
    for (const cookie of result.cookies) {
      expect(cookie.options).toEqual({ httpOnly: true, sameSite: "lax", path: "/", secure: false, maxAge: 600 });
    }
    expect(result.cookies.find((cookie) => cookie.name === "typio_oauth_locale_github")?.value).toBe("en");
  });

  it("generates a fresh state each time", async () => {
    const { startDeps } = setup({ github: github() });
    const first = await startOAuth(startDeps, { provider: "github", rawLocale: "fr", ip: "1.1.1.1" });
    const second = await startOAuth(startDeps, { provider: "github", rawLocale: "fr", ip: "1.1.1.1" });

    expect(first.cookies[0].value).not.toBe(second.cookies[0].value);
  });

  it("uses PKCE for Discord only: a verifier cookie, and the same verifier given to the URL", async () => {
    const { startDeps } = setup({ github: github(), discord: discord() });

    const discordResult = await startOAuth(startDeps, { provider: "discord", rawLocale: "fr", ip: "1.1.1.1" });
    const githubResult = await startOAuth(startDeps, { provider: "github", rawLocale: "fr", ip: "1.1.1.1" });

    const verifier = discordResult.cookies.find((cookie) => cookie.name === "typio_oauth_verifier_discord");
    expect(verifier?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new URL(discordResult.location).searchParams.get("code_verifier_seen")).toBe(verifier?.value);
    expect(githubResult.cookies.some((cookie) => cookie.name.includes("verifier"))).toBe(false);
    expect(new URL(githubResult.location).searchParams.has("code_verifier_seen")).toBe(false);
  });

  it("redirects to the login page with oauth=unavailable when the provider is not configured", async () => {
    const { startDeps } = setup({});

    expect(await startOAuth(startDeps, { provider: "github", rawLocale: "en", ip: "1.1.1.1" })).toEqual({
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
  ])("filters the locale %j to %s", async (rawLocale, expected) => {
    const { startDeps } = setup({});

    const result = await startOAuth(startDeps, { provider: "github", rawLocale, ip: "1.1.1.1" });

    expect(result.location).toBe(`/${expected}/login?oauth=unavailable`);
  });

  it("stores the validated locale, never the raw value", async () => {
    const { startDeps } = setup({ github: github() });

    const result = await startOAuth(startDeps, { provider: "github", rawLocale: "<script>", ip: "1.1.1.1" });

    expect(result.cookies.find((cookie) => cookie.name === "typio_oauth_locale_github")?.value).toBe("fr");
  });

  it("limits starts to 300 per IP per window, then redirects with oauth=failed and sets nothing", async () => {
    const { startDeps } = setup({ github: github() });
    for (let i = 0; i < 300; i += 1) {
      const result = await startOAuth(startDeps, { provider: "github", rawLocale: "fr", ip: "198.51.100.9" });
      expect(result.cookies.length).toBeGreaterThan(0);
    }

    expect(await startOAuth(startDeps, { provider: "github", rawLocale: "fr", ip: "198.51.100.9" })).toEqual({
      location: "/fr/login?oauth=failed",
      cookies: [],
    });
    const other = await startOAuth(startDeps, { provider: "github", rawLocale: "fr", ip: "198.51.100.10" });
    expect(other.cookies.length).toBeGreaterThan(0);
  });

  it("groups an IPv6 client by its /64 prefix, as the other limiters do", async () => {
    const { startDeps } = setup({ github: github() });
    for (let i = 0; i < 300; i += 1) {
      await startOAuth(startDeps, { provider: "github", rawLocale: "fr", ip: `2001:db8:0:1::${i + 1}` });
    }

    const result = await startOAuth(startDeps, { provider: "github", rawLocale: "fr", ip: "2001:db8:0:1:ffff::1" });
    expect(result.cookies).toEqual([]);
  });
});

describe("startOAuth: signed-in browsers", () => {
  async function sessionTokenFor(test: ReturnType<typeof setup>, kind: "member" | "guest") {
    const user =
      kind === "member"
        ? await test.users.createMember({ username: "alice", displayName: "Alice", passwordHash: "h", locale: "fr" })
        : await test.users.createGuest({ displayName: "G", locale: "fr", expiresAt: new Date("2030-01-01") });
    const grant = await createSession(test.sessions, { userId: user.id, kind, remember: false }, test.deps.now());
    return grant.token;
  }

  it("does not start the flow for a signed-in MEMBER: back to the home page, no cookie, no provider call", async () => {
    const test = setup({ github: github() });
    const sessionToken = await sessionTokenFor(test, "member");

    const result = await startOAuth(test.startDeps, { provider: "github", rawLocale: "en", ip: "1.1.1.1", sessionToken });

    expect(result).toEqual({ location: "/en", cookies: [] });
  });

  it("lets a GUEST start the flow", async () => {
    const test = setup({ github: github() });
    const sessionToken = await sessionTokenFor(test, "guest");

    const result = await startOAuth(test.startDeps, { provider: "github", rawLocale: "fr", ip: "1.1.1.1", sessionToken });

    expect(result.location).toContain("github.example");
    expect(result.cookies.length).toBe(2);
  });

  it.each([undefined, "garbage", "A".repeat(43)])("lets a visitor with an absent or unknown session (%j) start the flow", async (sessionToken) => {
    const test = setup({ github: github() });

    const result = await startOAuth(test.startDeps, { provider: "github", rawLocale: "fr", ip: "1.1.1.1", sessionToken });

    expect(result.cookies.length).toBe(2);
  });

  it("lets a visitor whose member session has expired start the flow", async () => {
    const test = setup({ github: github() });
    const sessionToken = await sessionTokenFor(test, "member");
    test.advance(25 * 60 * 60 * 1000);

    const result = await startOAuth(test.startDeps, { provider: "github", rawLocale: "fr", ip: "1.1.1.1", sessionToken });

    expect(result.cookies.length).toBe(2);
  });
});

describe("locale helpers", () => {
  it("parseOAuthLocale accepts fr and en only", () => {
    expect(parseOAuthLocale("en")).toBe("en");
    expect(parseOAuthLocale("fr")).toBe("fr");
    expect(parseOAuthLocale("es")).toBe("fr");
    expect(parseOAuthLocale(undefined)).toBe("fr");
  });

  it("loginNoticeLocation builds the login URL with the notice", () => {
    expect(loginNoticeLocation("en", "failed")).toBe("/en/login?oauth=failed");
  });
});
