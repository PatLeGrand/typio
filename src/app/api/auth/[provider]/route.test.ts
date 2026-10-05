// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDeps } from "@/auth/testSupport";

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

function call(provider: string, query = "", ip = "203.0.113.7") {
  const request = new NextRequest(`http://localhost:3000/api/auth/${provider}${query}`, {
    headers: { "x-forwarded-for": ip },
  });
  return GET(request, { params: Promise.resolve({ provider }) });
}

function setCookies(response: Response): Record<string, string> {
  return Object.fromEntries(response.headers.getSetCookie().map((header) => [header.split("=")[0], header]));
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mocks.getAuthDeps.mockReturnValue(createTestDeps().deps);
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  consoleError.mockRestore();
});

describe("GET /api/auth/[provider]", () => {
  it("answers 404 for an unknown provider", async () => {
    expect((await call("twitter")).status).toBe(404);
    expect((await call("GitHub")).status).toBe(404);
    expect((await call("..%2Fgithub")).status).toBe(404);
  });

  it("redirects (302) GitHub's authorization URL with no scope, the state and the exact redirect URI", async () => {
    const response = await call("github", "?locale=en");

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(location.searchParams.get("client_id")).toBe("gh-id");
    expect(location.searchParams.get("redirect_uri")).toBe("https://typio.example/api/auth/github/callback");
    expect(location.searchParams.has("scope")).toBe(false);
    expect(location.searchParams.has("code_challenge")).toBe(false);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("sets state and locale cookies: HttpOnly, SameSite=Lax, Path=/api/auth, Max-Age=600; GitHub has no verifier", async () => {
    const response = await call("github", "?locale=en");

    const cookies = setCookies(response);
    expect(Object.keys(cookies).sort()).toEqual(["typio_oauth_locale_github", "typio_oauth_state_github"]);
    for (const header of Object.values(cookies)) {
      expect(header).toMatch(/HttpOnly/i);
      expect(header).toMatch(/SameSite=lax/i);
      expect(header).toMatch(/Path=\/api\/auth(;|$)/);
      expect(header).toMatch(/Max-Age=600/);
      expect(header).not.toMatch(/Secure/i);
      expect(header).not.toMatch(/Domain/i);
    }
    const state = cookies.typio_oauth_state_github.split(";")[0].split("=")[1];
    expect(new URL(response.headers.get("location") ?? "").searchParams.get("state")).toBe(state);
    expect(cookies.typio_oauth_locale_github).toMatch(/^typio_oauth_locale_github=en;/);
  });

  it("Discord: identify scope only and a PKCE S256 challenge, with the verifier in a cookie", async () => {
    const response = await call("discord");

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(location.searchParams.get("scope")).toBe("identify");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    const cookies = setCookies(response);
    expect(Object.keys(cookies).sort()).toEqual([
      "typio_oauth_locale_discord",
      "typio_oauth_state_discord",
      "typio_oauth_verifier_discord",
    ]);
    const verifier = cookies.typio_oauth_verifier_discord.split(";")[0].split("=")[1];
    expect(location.toString()).not.toContain(verifier);
  });

  it("marks the cookies Secure and prefixes them __Secure- in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const cookies = setCookies(await call("github"));

    expect(Object.keys(cookies).sort()).toEqual([
      "__Secure-typio_oauth_locale_github",
      "__Secure-typio_oauth_state_github",
    ]);
    for (const header of Object.values(cookies)) expect(header).toMatch(/Secure/);
  });

  it("filters the locale: an unknown value becomes French", async () => {
    const response = await call("github", "?locale=%3Cscript%3E");

    expect(setCookies(response).typio_oauth_locale_github).toMatch(/^typio_oauth_locale_github=fr;/);
  });

  it("redirects to the login page with oauth=unavailable when the provider is not configured", async () => {
    vi.stubEnv("GITHUB_CLIENT_SECRET", "");

    const response = await call("github", "?locale=en");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/en/login?oauth=unavailable");
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("is unavailable without APP_ORIGIN: the origin is never taken from the Host header", async () => {
    vi.stubEnv("APP_ORIGIN", "");
    const request = new NextRequest("http://evil.example/api/auth/github", { headers: { host: "evil.example" } });

    const response = await GET(request, { params: Promise.resolve({ provider: "github" }) });

    expect(response.headers.get("location")).toBe("/fr/login?oauth=unavailable");
  });

  it("limits starts per IP: the 61st within the window goes back to the login page with oauth=failed", async () => {
    for (let i = 0; i < 60; i += 1) expect((await call("github", "", "198.51.100.1")).headers.getSetCookie().length).toBe(2);

    const limited = await call("github", "", "198.51.100.1");

    expect(limited.headers.get("location")).toBe("/fr/login?oauth=failed");
    expect(limited.headers.getSetCookie()).toEqual([]);
    expect((await call("github", "", "198.51.100.2")).headers.getSetCookie().length).toBe(2);
  });

  it("redirects to oauth=failed, logging only the error name, when the dependencies cannot be built", async () => {
    mocks.getAuthDeps.mockImplementation(() => {
      throw new Error("DATABASE_URL is required to connect to PostgreSQL");
    });

    const response = await call("github", "?locale=en");

    expect(response.headers.get("location")).toBe("/en/login?oauth=failed");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("DATABASE_URL");
  });
});
