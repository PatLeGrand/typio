// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionCookieName } from "@/auth/cookie";
import { createTestDeps } from "@/auth/testSupport";
import { hashToken } from "@/auth/token";

const mocks = vi.hoisted(() => ({ getAuthDeps: vi.fn() }));
vi.mock("@/auth/deps", () => ({ getAuthDeps: mocks.getAuthDeps }));

import { GET } from "./route";

const ENV = {
  APP_ORIGIN: "https://typio.example",
  GITHUB_CLIENT_ID: "gh-id",
  GITHUB_CLIENT_SECRET: "gh-secret",
  DISCORD_CLIENT_ID: "dc-id",
  DISCORD_CLIENT_SECRET: "dc-secret",
};

type Handler = (url: string) => Response | Promise<Response>;

/** Faux fournisseurs : le point de jeton et l'API de profil, sans réseau. */
function stubProviderNetwork(handlers: Record<string, Handler>) {
  const calls: { url: string; init?: RequestInit; body?: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | Request, init?: RequestInit) => {
      const request = typeof input === "string" ? undefined : input;
      const url = typeof input === "string" ? input : input.url;
      calls.push({ url, init, body: request ? await request.clone().text() : undefined });
      const handler = handlers[url];
      if (!handler) throw new Error(`unexpected request to ${url}`);
      return handler(url);
    }),
  );
  return calls;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const githubNetwork = () =>
  stubProviderNetwork({
    "https://github.com/login/oauth/access_token": () => json({ access_token: "gho_secret_token", token_type: "bearer" }),
    "https://api.github.com/user": () => json({ id: 583231, login: "octocat", name: "The Octocat", email: "x@y.z" }),
  });

function callback(provider: string, query: string, cookies: Record<string, string>) {
  const request = new NextRequest(`http://localhost:3000/api/auth/${provider}/callback${query}`, {
    headers: { cookie: Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join("; ") },
  });
  return GET(request, { params: Promise.resolve({ provider }) });
}

function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

let test: ReturnType<typeof createTestDeps>;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  test = createTestDeps();
  mocks.getAuthDeps.mockReturnValue(test.deps);
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  consoleError.mockRestore();
});

describe("GET /api/auth/[provider]/callback", () => {
  it("answers 404 for an unknown provider", async () => {
    expect((await callback("twitter", "?code=c&state=s", {})).status).toBe(404);
  });

  it("completes a GitHub sign-in end to end: member created, session cookie set, temporary cookies cleared", async () => {
    const calls = githubNetwork();

    const response = await callback("github", "?code=the-code&state=S1", {
      typio_oauth_state_github: "S1",
      typio_oauth_locale_github: "en",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/en");
    expect(test.users.users).toHaveLength(1);
    expect(test.users.users[0]).toMatchObject({ username: "octocat", passwordHash: null });
    expect(test.oauthAccounts.accounts).toEqual([
      { provider: "github", providerAccountId: "583231", userId: test.users.users[0].id },
    ]);

    const cookies = setCookies(response);
    const session = cookies.find((cookie) => cookie.startsWith(`${getSessionCookieName()}=`));
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/Max-Age=2592000/);
    expect(session).toMatch(/Path=\//);
    const token = (session ?? "").split(";")[0].split("=")[1];
    expect(test.sessions.sessions.has(hashToken(token))).toBe(true);
    for (const name of ["state", "verifier", "locale"]) {
      expect(cookies.some((cookie) => cookie.startsWith(`typio_oauth_${name}_github=;`) && /Max-Age=0/.test(cookie))).toBe(true);
    }

    // Les deux seules requêtes sortantes : l'échange du code, puis le profil avec le jeton.
    expect(calls.map((call) => call.url)).toEqual([
      "https://github.com/login/oauth/access_token",
      "https://api.github.com/user",
    ]);
    expect(calls[1].init?.headers).toMatchObject({ Authorization: "Bearer gho_secret_token", "User-Agent": "Typio" });
    expect(calls[1].init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("never stores or logs the access token", async () => {
    githubNetwork();

    await callback("github", "?code=the-code&state=S1", { typio_oauth_state_github: "S1" });

    expect(JSON.stringify([test.users.users, test.oauthAccounts.accounts, [...test.sessions.sessions.values()]])).not.toContain(
      "gho_secret_token",
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("gho_secret_token");
  });

  it("Discord: sends the PKCE verifier from the cookie to the token endpoint", async () => {
    const calls = stubProviderNetwork({
      "https://discord.com/api/oauth2/token": () => json({ access_token: "disc_token", token_type: "Bearer", expires_in: 1 }),
      "https://discord.com/api/users/@me": () => json({ id: "80351110224678912", username: "nelly", global_name: "Nelly" }),
    });

    const response = await callback("discord", "?code=dc&state=S2", {
      typio_oauth_state_discord: "S2",
      typio_oauth_verifier_discord: "the-verifier",
    });

    expect(response.headers.get("location")).toBe("/fr");
    expect(new URLSearchParams(calls[0].body).get("code_verifier")).toBe("the-verifier");
    expect(test.oauthAccounts.accounts[0]).toMatchObject({ provider: "discord", providerAccountId: "80351110224678912" });
    expect(test.users.users[0]).toMatchObject({ username: "nelly", displayName: "Nelly" });
  });

  it("rejects a forged state without any outgoing request, and still clears the cookies", async () => {
    const calls = githubNetwork();

    const response = await callback("github", "?code=the-code&state=FORGED", { typio_oauth_state_github: "S1" });

    expect(response.headers.get("location")).toBe("/fr/login?oauth=failed");
    expect(calls).toHaveLength(0);
    expect(setCookies(response).filter((cookie) => /Max-Age=0/.test(cookie))).toHaveLength(3);
    expect(test.users.users).toHaveLength(0);
  });

  it("maps access_denied to oauth=cancelled", async () => {
    const response = await callback("github", "?error=access_denied&state=S1", {
      typio_oauth_state_github: "S1",
      typio_oauth_locale_github: "en",
    });

    expect(response.headers.get("location")).toBe("/en/login?oauth=cancelled");
  });

  it("maps a token endpoint error to oauth=failed", async () => {
    stubProviderNetwork({
      "https://github.com/login/oauth/access_token": () => json({ error: "bad_verification_code" }),
    });

    const response = await callback("github", "?code=stale&state=S1", { typio_oauth_state_github: "S1" });

    expect(response.headers.get("location")).toBe("/fr/login?oauth=failed");
    expect(setCookies(response).some((cookie) => cookie.startsWith(`${getSessionCookieName()}=`))).toBe(false);
    expect(JSON.stringify(consoleError.mock.calls)).toContain("bad_verification_code");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("stale");
  });

  it("maps a profile endpoint failure to oauth=failed", async () => {
    stubProviderNetwork({
      "https://github.com/login/oauth/access_token": () => json({ access_token: "t", token_type: "bearer" }),
      "https://api.github.com/user": () => json({ message: "Bad credentials" }, 401),
    });

    const response = await callback("github", "?code=c&state=S1", { typio_oauth_state_github: "S1" });

    expect(response.headers.get("location")).toBe("/fr/login?oauth=failed");
  });

  it("maps a network failure to oauth=failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));

    const response = await callback("github", "?code=c&state=S1", { typio_oauth_state_github: "S1" });

    expect(response.headers.get("location")).toBe("/fr/login?oauth=failed");
  });

  it("a state cookie set for GitHub does not authorise a Discord callback", async () => {
    const calls = githubNetwork();

    const response = await callback("discord", "?code=c&state=S1", { typio_oauth_state_github: "S1" });

    expect(response.headers.get("location")).toBe("/fr/login?oauth=failed");
    expect(calls).toHaveLength(0);
  });

  it("goes back to oauth=failed, still clearing the cookies, when the dependencies cannot be built", async () => {
    mocks.getAuthDeps.mockImplementation(() => {
      throw new Error("DATABASE_URL is required to connect to PostgreSQL");
    });

    const response = await callback("github", "?code=c&state=S1", {
      typio_oauth_state_github: "S1",
      typio_oauth_locale_github: "en",
    });

    expect(response.headers.get("location")).toBe("/en/login?oauth=failed");
    expect(setCookies(response).filter((cookie) => /Max-Age=0/.test(cookie))).toHaveLength(3);
  });
});
