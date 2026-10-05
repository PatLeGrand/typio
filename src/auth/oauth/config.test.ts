// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { getEnabledProviders, getOAuthProvider, getRedirectUri } from "./config";

const FULL_ENV = {
  APP_ORIGIN: "https://typio.aether-manager.ca",
  GITHUB_CLIENT_ID: "gh-id",
  GITHUB_CLIENT_SECRET: "gh-secret",
  DISCORD_CLIENT_ID: "dc-id",
  DISCORD_CLIENT_SECRET: "dc-secret",
};

describe("getRedirectUri", () => {
  it("builds the callback address from APP_ORIGIN, never from a request", () => {
    expect(getRedirectUri("github", FULL_ENV)).toBe("https://typio.aether-manager.ca/api/auth/github/callback");
    expect(getRedirectUri("discord", { APP_ORIGIN: "http://localhost:3000" })).toBe(
      "http://localhost:3000/api/auth/discord/callback",
    );
  });

  it("keeps only the origin: a path, query or trailing slash is dropped", () => {
    expect(getRedirectUri("github", { APP_ORIGIN: "https://typio.example/some/path/?x=1" })).toBe(
      "https://typio.example/api/auth/github/callback",
    );
  });

  it.each([undefined, "", "   ", "not a url", "javascript:alert(1)", "ftp://typio.example"])(
    "is null for an absent or invalid APP_ORIGIN (%j)",
    (origin) => {
      expect(getRedirectUri("github", { APP_ORIGIN: origin })).toBeNull();
    },
  );
});

describe("getOAuthProvider: GitHub", () => {
  it("is null when the id, the secret or APP_ORIGIN is missing", () => {
    expect(getOAuthProvider("github", { ...FULL_ENV, GITHUB_CLIENT_ID: "" })).toBeNull();
    expect(getOAuthProvider("github", { ...FULL_ENV, GITHUB_CLIENT_SECRET: undefined })).toBeNull();
    expect(getOAuthProvider("github", { ...FULL_ENV, APP_ORIGIN: undefined })).toBeNull();
    expect(getOAuthProvider("github", {})).toBeNull();
  });

  it("builds an authorization URL with no scope, the state and the exact redirect URI, without PKCE", () => {
    const client = getOAuthProvider("github", FULL_ENV);

    expect(client).not.toBeNull();
    expect(client?.usesPkce).toBe(false);
    const url = client?.createAuthorizationURL("the-state", null);
    expect(`${url?.origin}${url?.pathname}`).toBe("https://github.com/login/oauth/authorize");
    expect(url?.searchParams.get("client_id")).toBe("gh-id");
    expect(url?.searchParams.get("state")).toBe("the-state");
    expect(url?.searchParams.get("redirect_uri")).toBe("https://typio.aether-manager.ca/api/auth/github/callback");
    expect(url?.searchParams.has("scope")).toBe(false);
    expect(url?.searchParams.has("code_challenge")).toBe(false);
    expect(url?.toString()).not.toContain("gh-secret");
  });
});

describe("getOAuthProvider: Discord", () => {
  it("is null when the id, the secret or APP_ORIGIN is missing", () => {
    expect(getOAuthProvider("discord", { ...FULL_ENV, DISCORD_CLIENT_ID: undefined })).toBeNull();
    expect(getOAuthProvider("discord", { ...FULL_ENV, DISCORD_CLIENT_SECRET: " " })).toBeNull();
    expect(getOAuthProvider("discord", { ...FULL_ENV, APP_ORIGIN: "nope" })).toBeNull();
  });

  it("builds an authorization URL with the identify scope only and a PKCE S256 challenge", () => {
    const client = getOAuthProvider("discord", FULL_ENV);

    expect(client?.usesPkce).toBe(true);
    const url = client?.createAuthorizationURL("the-state", "a-code-verifier");
    expect(`${url?.origin}${url?.pathname}`).toBe("https://discord.com/oauth2/authorize");
    expect(url?.searchParams.get("client_id")).toBe("dc-id");
    expect(url?.searchParams.get("scope")).toBe("identify");
    expect(url?.searchParams.get("state")).toBe("the-state");
    expect(url?.searchParams.get("redirect_uri")).toBe("https://typio.aether-manager.ca/api/auth/discord/callback");
    expect(url?.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url?.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url?.toString()).not.toContain("a-code-verifier");
    expect(url?.toString()).not.toContain("dc-secret");
  });
});

describe("getEnabledProviders", () => {
  it("lists only complete providers, in the fixed order", () => {
    expect(getEnabledProviders(FULL_ENV)).toEqual(["github", "discord"]);
    expect(getEnabledProviders({ ...FULL_ENV, GITHUB_CLIENT_SECRET: "" })).toEqual(["discord"]);
    expect(getEnabledProviders({ ...FULL_ENV, DISCORD_CLIENT_ID: "" })).toEqual(["github"]);
    expect(getEnabledProviders({ ...FULL_ENV, APP_ORIGIN: "" })).toEqual([]);
    expect(getEnabledProviders({})).toEqual([]);
  });
});

describe("exchangeCode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubTokenEndpoint(body: unknown, status = 200) {
    const requests: Request[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request.clone());
        return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
      }),
    );
    return requests;
  }

  it("GitHub: posts the code to the token endpoint and returns the access token only", async () => {
    const requests = stubTokenEndpoint({ access_token: "gho_abc", token_type: "bearer", scope: "" });

    const token = await getOAuthProvider("github", FULL_ENV)?.exchangeCode("the-code", null);

    expect(token).toBe("gho_abc");
    expect(requests[0].url).toBe("https://github.com/login/oauth/access_token");
    const body = new URLSearchParams(await requests[0].text());
    expect(body.get("code")).toBe("the-code");
    expect(body.get("redirect_uri")).toBe("https://typio.aether-manager.ca/api/auth/github/callback");
    expect(body.has("code_verifier")).toBe(false);
  });

  it("Discord: sends the PKCE code verifier", async () => {
    const requests = stubTokenEndpoint({ access_token: "disc_abc", token_type: "Bearer", expires_in: 604800 });

    const token = await getOAuthProvider("discord", FULL_ENV)?.exchangeCode("the-code", "the-verifier");

    expect(token).toBe("disc_abc");
    expect(requests[0].url).toBe("https://discord.com/api/oauth2/token");
    const body = new URLSearchParams(await requests[0].text());
    expect(body.get("code")).toBe("the-code");
    expect(body.get("code_verifier")).toBe("the-verifier");
  });

  it("rejects when the provider refuses the code", async () => {
    stubTokenEndpoint({ error: "bad_verification_code" });

    await expect(getOAuthProvider("github", FULL_ENV)?.exchangeCode("stale", null)).rejects.toMatchObject({
      code: "bad_verification_code",
    });
  });

  it("rejects with a timeout when the token endpoint never answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort(new DOMException("deadline", "TimeoutError")));

    await expect(getOAuthProvider("discord", FULL_ENV)?.exchangeCode("c", "v")).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });
});
