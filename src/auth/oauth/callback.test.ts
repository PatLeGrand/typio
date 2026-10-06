// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionCookieName } from "../cookie";
import { createSemaphore } from "../semaphore";
import { createTestDeps } from "../testSupport";
import { generateToken, hashToken } from "../token";
import { handleOAuthCallback, type OAuthCallbackDeps, type OAuthCallbackInput } from "./callback";
import { OAuthProfileError } from "./profile";
import type { OAuthProfile, OAuthProviderName } from "./providers";
import { createFakeProvider, profile } from "./testSupport";

const STATE = "the-state-value";
const VERIFIER = "the-code-verifier";

function setup(options: { provider?: OAuthProviderName; fetchedProfile?: OAuthProfile } = {}) {
  const test = createTestDeps();
  const provider = createFakeProvider(options.provider ?? "github");
  const fetchProfile = vi.fn<OAuthCallbackDeps["fetchProfile"]>(async () => options.fetchedProfile ?? profile());
  const deps: OAuthCallbackDeps = {
    auth: test.deps,
    getProvider: (name) => (name === provider.name ? provider : null),
    fetchProfile,
    exchanges: createSemaphore({ maxConcurrent: 4, maxQueue: 32 }),
  };
  return { ...test, provider, fetchProfile, deps };
}

function input(overrides: Partial<OAuthCallbackInput> = {}): OAuthCallbackInput {
  const provider = overrides.provider ?? "github";
  return {
    provider,
    ip: "203.0.113.7",
    ...overrides,
    query: { code: "auth-code", state: STATE, error: null, ...overrides.query },
    cookies: { state: STATE, locale: "fr", ...(provider === "discord" ? { verifier: VERIFIER } : {}), ...overrides.cookies },
  };
}

/** Les trois cookies temporaires sont effacés (mêmes attributs, Max-Age 0). */
function expectTemporaryCookiesCleared(
  cookies: { name: string; value: string; options: { maxAge?: number; path?: string } }[],
  provider: OAuthProviderName = "github",
) {
  for (const kind of ["state", "verifier", "locale"]) {
    const cleared = cookies.find((cookie) => cookie.name === `typio_oauth_${kind}_${provider}`);
    expect(cleared, `${kind} cookie`).toMatchObject({ value: "", options: { maxAge: 0, path: "/" } });
  }
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("handleOAuthCallback: state and user refusal", () => {
  it.each([
    ["missing in the query", { query: { code: "c", state: null, error: null } }],
    ["different from the cookie", { query: { code: "c", state: "forged", error: null } }],
    ["missing from the cookie", { cookies: { state: undefined } }],
    ["empty in the query", { query: { code: "c", state: "", error: null } }],
  ])("sends oauth=failed when the state is %s, without calling the provider", async (_label, overrides) => {
    const { deps, provider, fetchProfile, users } = setup();

    const result = await handleOAuthCallback(deps, input(overrides as Partial<OAuthCallbackInput>));

    expect(result.location).toBe("/fr/login?oauth=failed");
    expect(provider.exchangeCode).not.toHaveBeenCalled();
    expect(fetchProfile).not.toHaveBeenCalled();
    expect(users.users).toHaveLength(0);
    expectTemporaryCookiesCleared(result.cookies);
    expect(result.cookies.some((cookie) => cookie.name === getSessionCookieName())).toBe(false);
  });

  it("checks the state BEFORE honoring access_denied: a forged link cannot show « cancelled »", async () => {
    const { deps } = setup();

    const result = await handleOAuthCallback(
      deps,
      input({ query: { code: null, state: "forged", error: "access_denied" } }),
    );

    expect(result.location).toBe("/fr/login?oauth=failed");
  });

  it("sends oauth=cancelled when the user refused (access_denied), keeping the locale", async () => {
    const { deps, provider } = setup();

    const result = await handleOAuthCallback(
      deps,
      input({ query: { code: null, state: STATE, error: "access_denied" }, cookies: { state: STATE, locale: "en" } }),
    );

    expect(result.location).toBe("/en/login?oauth=cancelled");
    expect(provider.exchangeCode).not.toHaveBeenCalled();
    expectTemporaryCookiesCleared(result.cookies);
  });

  it("sends oauth=failed for any other provider error", async () => {
    const { deps } = setup();

    const result = await handleOAuthCallback(deps, input({ query: { code: null, state: STATE, error: "server_error" } }));

    expect(result.location).toBe("/fr/login?oauth=failed");
    expectTemporaryCookiesCleared(result.cookies);
  });

  it.each([null, ""])("sends oauth=failed when the code is %j", async (code) => {
    const { deps, provider } = setup();

    const result = await handleOAuthCallback(deps, input({ query: { code, state: STATE, error: null } }));

    expect(result.location).toBe("/fr/login?oauth=failed");
    expect(provider.exchangeCode).not.toHaveBeenCalled();
  });

  it("falls back to French when the locale cookie is missing or tampered with", async () => {
    const { deps } = setup();

    for (const locale of [undefined, "de", "<script>"]) {
      const result = await handleOAuthCallback(
        deps,
        input({ query: { code: null, state: STATE, error: "access_denied" }, cookies: { state: STATE, locale } }),
      );
      expect(result.location).toBe("/fr/login?oauth=cancelled");
    }
  });

  it("sends oauth=unavailable when the provider is no longer configured", async () => {
    const { deps } = setup();

    const result = await handleOAuthCallback({ ...deps, getProvider: () => null }, input());

    expect(result.location).toBe("/fr/login?oauth=unavailable");
    expectTemporaryCookiesCleared(result.cookies);
  });

  it("refuses a Discord return without the PKCE verifier cookie, without exchanging the code", async () => {
    const { deps, provider } = setup({ provider: "discord" });

    const result = await handleOAuthCallback(
      deps,
      input({ provider: "discord", cookies: { state: STATE, locale: "fr", verifier: undefined } }),
    );

    expect(result.location).toBe("/fr/login?oauth=failed");
    expect(provider.exchangeCode).not.toHaveBeenCalled();
  });
});

describe("handleOAuthCallback: abuse limits before any outgoing request", () => {
  it("limits returns to 300 per IP per window: the 301st gets oauth=failed with no outgoing request", async () => {
    const { deps, provider, fetchProfile } = setup();
    for (let i = 0; i < 300; i += 1) {
      // État forgé : consomme le budget sans rien lancer, comme un attaquant qui martèle la route.
      await handleOAuthCallback(deps, input({ query: { code: "c", state: "forged", error: null } }));
    }

    const result = await handleOAuthCallback(deps, input());

    expect(result.location).toBe("/fr/login?oauth=failed");
    expect(provider.exchangeCode).not.toHaveBeenCalled();
    expect(fetchProfile).not.toHaveBeenCalled();
    expectTemporaryCookiesCleared(result.cookies);
  });

  it("counts per IP: another address is not limited", async () => {
    const { deps, provider } = setup();
    for (let i = 0; i < 300; i += 1) {
      await handleOAuthCallback(deps, input({ query: { code: "c", state: "forged", error: null } }));
    }

    const result = await handleOAuthCallback(deps, input({ ip: "198.51.100.1" }));

    expect(result.location).toBe("/fr");
    expect(provider.exchangeCode).toHaveBeenCalledTimes(1);
  });

  it("allows at most 4 simultaneous exchanges and 32 waiting: the 37th is refused without any request", async () => {
    const { deps, provider, fetchProfile } = setup();
    const releases: (() => void)[] = [];
    provider.exchangeCode.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          releases.push(() => resolve("access-token-xyz"));
        }),
    );
    // Un compte distinct par retour, pour ne tester que le sémaphore.
    let accounts = 0;
    fetchProfile.mockImplementation(async () => {
      accounts += 1;
      return profile({ accountId: String(accounts), login: `player${accounts}` });
    });
    // Autant d'IP que de retours : seul le sémaphore est en cause, pas le limiteur par IP.
    const call = (index: number) => handleOAuthCallback(deps, input({ ip: `198.51.100.${index}`, query: { code: `c${index}`, state: STATE, error: null } }));

    const pending = Array.from({ length: 36 }, (_unused, index) => call(index));
    await vi.waitFor(() => expect(provider.exchangeCode).toHaveBeenCalledTimes(4));
    expect(deps.exchanges.active()).toBe(4);
    expect(deps.exchanges.queued()).toBe(32);

    const refused = await call(200);

    expect(refused.location).toBe("/fr/login?oauth=failed");
    expect(provider.exchangeCode).toHaveBeenCalledTimes(4);
    expect(fetchProfile).not.toHaveBeenCalled();
    expect(JSON.stringify(consoleError.mock.calls)).toContain("QueueFullError");

    // Les retours déjà acceptés finissent normalement.
    while (deps.exchanges.active() > 0) {
      releases.splice(0).forEach((release) => release());
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const results = await Promise.all(pending);
    expect(results.every((result) => result.location === "/fr")).toBe(true);
  });
});

describe("handleOAuthCallback: failures while talking to the provider", () => {
  it("sends oauth=failed when the code exchange fails, and logs the error without token or code", async () => {
    const { deps, provider } = setup();
    provider.exchangeCode.mockRejectedValue(
      Object.assign(new Error("OAuth request error: bad_verification_code auth-code access-token-xyz"), {
        name: "OAuth2RequestError",
        code: "bad_verification_code",
      }),
    );

    const result = await handleOAuthCallback(deps, input());

    expect(result.location).toBe("/fr/login?oauth=failed");
    expectTemporaryCookiesCleared(result.cookies);
    expect(result.cookies.some((cookie) => cookie.name === getSessionCookieName())).toBe(false);
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).toContain("OAuth2RequestError");
    expect(logged).not.toContain("auth-code");
    expect(logged).not.toContain("access-token-xyz");
    expect(logged).not.toContain(STATE);
  });

  it("gives the exchange slot back when the exchange fails", async () => {
    const { deps, provider } = setup();
    provider.exchangeCode.mockRejectedValue(new Error("boom"));

    await handleOAuthCallback(deps, input());

    expect(deps.exchanges.active()).toBe(0);
  });

  it("sends oauth=failed when the profile cannot be read", async () => {
    const { deps, fetchProfile, users } = setup();
    fetchProfile.mockRejectedValue(new OAuthProfileError("invalid GitHub id"));

    const result = await handleOAuthCallback(deps, input());

    expect(result.location).toBe("/fr/login?oauth=failed");
    expect(users.users).toHaveLength(0);
  });

  it("sends oauth=failed when the database fails, never leaking the error to the browser", async () => {
    const { deps, oauthAccounts } = setup();
    oauthAccounts.findUserIdByAccount = async () => {
      throw new Error("connection refused: postgres://user:secret@host");
    };

    const result = await handleOAuthCallback(deps, input());

    expect(result.location).toBe("/fr/login?oauth=failed");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret@host");
  });

  it("passes the code and the verifier to the exchange, then the token to the profile call", async () => {
    const { deps, provider, fetchProfile } = setup({ provider: "discord" });

    await handleOAuthCallback(deps, input({ provider: "discord" }));

    expect(provider.exchangeCode).toHaveBeenCalledWith("auth-code", VERIFIER);
    expect(fetchProfile).toHaveBeenCalledWith("discord", "access-token-xyz");
  });

  it("never passes a verifier for GitHub, even if a stray cookie carries one", async () => {
    const { deps, provider } = setup();

    await handleOAuthCallback(deps, input({ cookies: { state: STATE, locale: "fr", verifier: "stray" } }));

    expect(provider.exchangeCode).toHaveBeenCalledWith("auth-code", null);
  });
});

describe("handleOAuthCallback: signing in", () => {
  it("creates the member and sets a SESSION cookie (no Max-Age), HttpOnly and Lax, then goes home", async () => {
    const { deps, users, sessions } = setup();

    const result = await handleOAuthCallback(deps, input());

    expect(result.location).toBe("/fr");
    expect(users.users).toHaveLength(1);
    const session = result.cookies.find((cookie) => cookie.name === getSessionCookieName());
    expect(session?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(session?.options.maxAge).toBeUndefined();
    expect(sessions.sessions.has(hashToken(session?.value ?? ""))).toBe(true);
    expectTemporaryCookiesCleared(result.cookies);
  });

  it("goes to the English home page for an English flow", async () => {
    const { deps } = setup();

    const result = await handleOAuthCallback(deps, input({ cookies: { state: STATE, locale: "en" } }));

    expect(result.location).toBe("/en");
  });

  it("signs in to the existing account and creates no second member", async () => {
    const { deps, users, oauthAccounts } = setup();
    await oauthAccounts.createMemberWithAccount({
      provider: "github",
      providerAccountId: "583231",
      username: "octocat",
      displayName: "Octo",
      locale: "fr",
    });

    const result = await handleOAuthCallback(deps, input());

    expect(result.location).toBe("/fr");
    expect(users.users).toHaveLength(1);
    expect(result.cookies.some((cookie) => cookie.name === getSessionCookieName())).toBe(true);
  });

  it("replaces the browser's previous member session: the old one is revoked, a new one set", async () => {
    const { deps, users, oauthAccounts, sessions } = setup();
    const { id } = await oauthAccounts.createMemberWithAccount({
      provider: "github",
      providerAccountId: "583231",
      username: "octocat",
      displayName: "Octo",
      locale: "fr",
    });
    const oldToken = generateToken();
    sessions.sessions.set(hashToken(oldToken), { id: hashToken(oldToken), userId: id, expiresAt: new Date("2030-01-01") });

    const result = await handleOAuthCallback(deps, input({ cookies: { state: STATE, locale: "fr", session: oldToken } }));

    expect(sessions.sessions.has(hashToken(oldToken))).toBe(false);
    expect(sessions.sessions.size).toBe(1);
    expect(users.users).toHaveLength(1);
    expect(result.cookies.find((cookie) => cookie.name === getSessionCookieName())?.value).not.toBe(oldToken);
  });

  it("revokes a guest's session when the guest signs in with a provider", async () => {
    const { deps, users, sessions } = setup();
    const guest = await deps.auth.users.createGuest({ displayName: "G", locale: "fr", expiresAt: new Date("2030-01-01") });
    const guestToken = generateToken();
    sessions.sessions.set(hashToken(guestToken), { id: hashToken(guestToken), userId: guest.id, expiresAt: new Date("2030-01-01") });

    const result = await handleOAuthCallback(deps, input({ cookies: { state: STATE, locale: "fr", session: guestToken } }));

    expect(result.location).toBe("/fr");
    expect(sessions.sessions.has(hashToken(guestToken))).toBe(false);
    expect(users.users.filter((user) => user.kind === "member")).toHaveLength(1);
  });

  it("ignores a forged or expired session cookie", async () => {
    const { deps, users } = setup();

    const result = await handleOAuthCallback(deps, input({ cookies: { state: STATE, locale: "fr", session: "garbage" } }));

    expect(result.location).toBe("/fr");
    expect(users.users).toHaveLength(1);
  });
});

describe("handleOAuthCallback: no implicit linking", () => {
  it("a signed-in member who returns with a free provider account is NOT linked: a new member is created and signed in, the old session revoked", async () => {
    const { deps, users, oauthAccounts, sessions } = setup();
    const alice = await users.createMember({ username: "alice", displayName: "Alice", passwordHash: "h", locale: "fr" });
    const aliceToken = generateToken();
    sessions.sessions.set(hashToken(aliceToken), { id: hashToken(aliceToken), userId: alice.id, expiresAt: new Date("2030-01-01") });

    const result = await handleOAuthCallback(deps, input({ cookies: { state: STATE, locale: "fr", session: aliceToken } }));

    expect(result.location).toBe("/fr");
    expect(oauthAccounts.accounts.some((account) => account.userId === alice.id)).toBe(false);
    expect(users.users).toHaveLength(2);
    expect(sessions.sessions.has(hashToken(aliceToken))).toBe(false);
    const newSession = result.cookies.find((cookie) => cookie.name === getSessionCookieName());
    expect(sessions.sessions.get(hashToken(newSession?.value ?? ""))?.userId).not.toBe(alice.id);
  });

  it("a signed-in member who returns with an account linked to ANOTHER member is signed in as that other member, never linked", async () => {
    const { deps, users, oauthAccounts, sessions } = setup();
    const alice = await users.createMember({ username: "alice", displayName: "Alice", passwordHash: "h", locale: "fr" });
    const aliceToken = generateToken();
    sessions.sessions.set(hashToken(aliceToken), { id: hashToken(aliceToken), userId: alice.id, expiresAt: new Date("2030-01-01") });
    const { id: bobId } = await oauthAccounts.createMemberWithAccount({
      provider: "github",
      providerAccountId: "583231",
      username: "bob",
      displayName: "Bob",
      locale: "fr",
    });

    const result = await handleOAuthCallback(deps, input({ cookies: { state: STATE, locale: "fr", session: aliceToken } }));

    expect(result.location).toBe("/fr");
    expect(oauthAccounts.accounts).toEqual([{ provider: "github", providerAccountId: "583231", userId: bobId }]);
    const newSession = result.cookies.find((cookie) => cookie.name === getSessionCookieName());
    expect(sessions.sessions.get(hashToken(newSession?.value ?? ""))?.userId).toBe(bobId);
    expect(sessions.sessions.has(hashToken(aliceToken))).toBe(false);
  });
});
