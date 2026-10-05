// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDeps } from "./testSupport";
import { hashToken } from "./token";
import type { AuthFormState } from "./types";

const REDIRECT = "NEXT_REDIRECT";

const mocks = vi.hoisted(() => {
  const cookieJar = new Map<string, string>();
  return {
    cookieJar,
    cookieStore: {
      get: vi.fn((name: string) => {
        const value = cookieJar.get(name);
        return value === undefined ? undefined : { name, value };
      }),
      set: vi.fn<(name: string, value: string, options?: Record<string, unknown>) => void>((name, value) => {
        cookieJar.set(name, value);
      }),
      delete: vi.fn((name: string) => {
        cookieJar.delete(name);
      }),
    },
    requestHeaders: new Map<string, string>(),
    redirect: vi.fn(),
    getAuthDeps: vi.fn(),
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => mocks.cookieStore,
  headers: async () => ({ get: (name: string) => mocks.requestHeaders.get(name) ?? null }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./deps", () => ({ getAuthDeps: mocks.getAuthDeps }));

import { continueAsGuest, login, logout, register } from "./actions";

const IDLE: AuthFormState = { status: "idle" };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

/**
 * Formulaire d'inscription valide par défaut : confirmation identique au mot de passe et
 * conditions acceptées. Chaque test surcharge ce qu'il veut casser (`undefined` retire le champ).
 */
function signupForm(fields: Record<string, string | undefined>): FormData {
  const merged = { passwordConfirm: fields.password, terms: "on", ...fields };
  const data = new FormData();
  for (const [name, value] of Object.entries(merged)) {
    if (value !== undefined) data.set(name, value);
  }
  return data;
}

/** Comme le vrai `redirect`, lève une exception pour interrompre l'action. */
async function run(action: Promise<AuthFormState | void>): Promise<AuthFormState | "redirected"> {
  try {
    return (await action) ?? "redirected";
  } catch (error) {
    if (error instanceof Error && error.message === REDIRECT) return "redirected";
    throw error;
  }
}

let test: ReturnType<typeof createTestDeps>;

beforeEach(() => {
  mocks.cookieJar.clear();
  mocks.requestHeaders.clear();
  mocks.requestHeaders.set("x-forwarded-for", "203.0.113.7");
  vi.clearAllMocks();
  mocks.redirect.mockImplementation(() => {
    throw new Error(REDIRECT);
  });
  test = createTestDeps();
  mocks.getAuthDeps.mockReturnValue(test.deps);
});

describe("register", () => {
  it("creates the account, sets the cookie, and redirects to the locale home", async () => {
    const result = await run(
      register(IDLE, signupForm({ username: "Alice", password: "correct-password1", locale: "en" })),
    );

    expect(result).toBe("redirected");
    expect(mocks.redirect).toHaveBeenCalledWith("/en");
    expect(test.users.users).toHaveLength(1);
    expect(mocks.cookieStore.set).toHaveBeenCalledTimes(1);
  });

  it("sets a cookie with the right attributes and no Max-Age without remember", async () => {
    await run(register(IDLE, signupForm({ username: "Alice", password: "correct-password1" })));

    const [name, value, options] = mocks.cookieStore.set.mock.calls[0] as unknown as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe("typio_session");
    expect(test.sessions.sessions.has(hashToken(value))).toBe(true);
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", secure: false });
    expect(options).not.toHaveProperty("maxAge");
  });

  it("sets Max-Age of 30 days when remember is on", async () => {
    await run(register(IDLE, signupForm({ username: "Alice", password: "correct-password1", remember: "on" })));

    expect(mocks.cookieStore.set.mock.calls[0][2]).toMatchObject({ maxAge: 2_592_000 });
  });

  it.each([
    [{ username: "a!", password: "correct-password1" }, { code: "INVALID_USERNAME", field: "username" }],
    [{ username: "alice", password: "short" }, { code: "INVALID_PASSWORD", field: "password" }],
    [{ password: "correct-password1" }, { code: "INVALID_USERNAME", field: "username" }],
  ])("returns the validation error for %j", async (fields, expected) => {
    const result = await run(register(IDLE, signupForm(fields)));

    expect(result).toEqual({ status: "error", ...expected });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.cookieStore.set).not.toHaveBeenCalled();
  });

  it.each([
    ["no letter", "12345678"],
    ["no digit", "password-only"],
    ["fewer than 8 characters", "abc123"],
  ])("rejects a password with %s", async (_label, password) => {
    const result = await run(register(IDLE, signupForm({ username: "alice", password })));

    expect(result).toEqual({ status: "error", code: "INVALID_PASSWORD", field: "password" });
    expect(test.users.users).toHaveLength(0);
  });

  it("rejects a confirmation that differs from the password", async () => {
    const result = await run(
      register(IDLE, signupForm({ username: "alice", password: "correct-password1", passwordConfirm: "correct-password2" })),
    );

    expect(result).toEqual({ status: "error", code: "PASSWORD_MISMATCH", field: "passwordConfirm" });
    expect(mocks.cookieStore.set).not.toHaveBeenCalled();
    expect(test.users.users).toHaveLength(0);
  });

  it("rejects a missing confirmation field", async () => {
    const result = await run(
      register(IDLE, signupForm({ username: "alice", password: "correct-password1", passwordConfirm: undefined })),
    );

    expect(result).toEqual({ status: "error", code: "PASSWORD_MISMATCH", field: "passwordConfirm" });
  });

  it.each([[undefined], ["off"], ["true"], [""]])("rejects the terms value %j", async (terms) => {
    const result = await run(
      register(IDLE, signupForm({ username: "alice", password: "correct-password1", terms })),
    );

    expect(result).toEqual({ status: "error", code: "TERMS_REQUIRED", field: "terms" });
    expect(test.users.users).toHaveLength(0);
  });

  it("does not spend the registration budget on invalid forms, and hashes nothing", async () => {
    const hash = vi.spyOn(test.deps.passwords, "hash");
    for (let i = 0; i < 70; i += 1) {
      await run(register(IDLE, signupForm({ username: `user_${i}`, password: "correct-password1", terms: undefined })));
    }

    expect(hash).not.toHaveBeenCalled();
    expect(await run(register(IDLE, signupForm({ username: "valid_one", password: "correct-password1" })))).toBe(
      "redirected",
    );
  });

  it("returns USERNAME_TAKEN when the username exists", async () => {
    await run(register(IDLE, signupForm({ username: "Alice", password: "correct-password1" })));
    mocks.redirect.mockClear();
    mocks.cookieStore.set.mockClear();

    const result = await run(register(IDLE, signupForm({ username: "alice", password: "other-password2" })));

    expect(result).toEqual({ status: "error", code: "USERNAME_TAKEN", field: "username" });
    expect(mocks.cookieStore.set).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMITED after 60 registrations from the same IP", async () => {
    for (let i = 0; i < 60; i += 1) {
      await run(register(IDLE, signupForm({ username: `user_${i}`, password: "correct-password1" })));
    }

    expect(await run(register(IDLE, signupForm({ username: "user_60", password: "correct-password1" })))).toEqual({
      status: "error",
      code: "RATE_LIMITED",
    });
  });

  it("reads the IP from x-forwarded-for, so another IP has its own budget", async () => {
    for (let i = 0; i < 60; i += 1) {
      await run(register(IDLE, signupForm({ username: `user_${i}`, password: "correct-password1" })));
    }
    mocks.requestHeaders.set("x-forwarded-for", "198.51.100.9, 10.0.0.1");

    expect(await run(register(IDLE, signupForm({ username: "user_60", password: "correct-password1" })))).toBe(
      "redirected",
    );
  });

  it("falls back to French for a missing or unknown locale", async () => {
    await run(register(IDLE, signupForm({ username: "alice", password: "correct-password1" })));
    expect(mocks.redirect).toHaveBeenLastCalledWith("/fr");

    await run(register(IDLE, signupForm({ username: "bob", password: "correct-password1", locale: "de" })));
    expect(mocks.redirect).toHaveBeenLastCalledWith("/fr");
  });

  it("never redirects to an attacker-controlled path through the locale field", async () => {
    await run(
      register(IDLE, signupForm({ username: "alice", password: "correct-password1", locale: "//evil.example" })),
    );

    expect(mocks.redirect).toHaveBeenCalledWith("/fr");
  });
});

describe("login", () => {
  beforeEach(async () => {
    await run(register(IDLE, signupForm({ username: "Alice", password: "correct-password1" })));
    mocks.cookieJar.clear();
    vi.clearAllMocks();
    mocks.redirect.mockImplementation(() => {
      throw new Error(REDIRECT);
    });
    mocks.requestHeaders.set("x-forwarded-for", "198.51.100.20");
  });

  it("sets the cookie and redirects to the locale home on success", async () => {
    const result = await run(
      login(IDLE, form({ username: "alice", password: "correct-password1", locale: "en" })),
    );

    expect(result).toBe("redirected");
    expect(mocks.redirect).toHaveBeenCalledWith("/en");
    expect(mocks.cookieStore.set).toHaveBeenCalledTimes(1);
    expect(mocks.cookieStore.set.mock.calls[0][2]).not.toHaveProperty("maxAge");
  });

  it("uses Max-Age of 30 days with remember on", async () => {
    await run(login(IDLE, form({ username: "alice", password: "correct-password1", remember: "on" })));

    expect(mocks.cookieStore.set.mock.calls[0][2]).toMatchObject({ maxAge: 2_592_000, httpOnly: true });
  });

  it("uses the __Host- prefixed name and Secure in production, without Domain", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      await run(login(IDLE, form({ username: "alice", password: "correct-password1" })));
      const [name, , options] = mocks.cookieStore.set.mock.calls[0];
      expect(name).toBe("__Host-typio_session");
      expect(options).toMatchObject({ secure: true, path: "/", httpOnly: true, sameSite: "lax" });
      expect(options).not.toHaveProperty("domain");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("reads and deletes the __Host- prefixed cookie on logout in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      await run(login(IDLE, form({ username: "alice", password: "correct-password1" })));
      expect(mocks.cookieJar.has("__Host-typio_session")).toBe(true);

      await run(logout(form({})));

      expect(mocks.cookieStore.delete).toHaveBeenCalledWith("__Host-typio_session");
      expect(mocks.cookieJar.has("__Host-typio_session")).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("returns INVALID_CREDENTIALS for a wrong password and for an unknown username alike", async () => {
    const wrong = await run(login(IDLE, form({ username: "alice", password: "wrong-password" })));
    const unknown = await run(login(IDLE, form({ username: "nobody", password: "wrong-password" })));

    expect(wrong).toEqual({ status: "error", code: "INVALID_CREDENTIALS" });
    expect(unknown).toEqual(wrong);
    expect(mocks.cookieStore.set).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMITED on the 6th failure within 15 minutes", async () => {
    for (let i = 0; i < 5; i += 1) {
      expect(await run(login(IDLE, form({ username: "alice", password: "wrong-password" })))).toEqual({
        status: "error",
        code: "INVALID_CREDENTIALS",
      });
    }

    expect(await run(login(IDLE, form({ username: "alice", password: "wrong-password" })))).toEqual({
      status: "error",
      code: "RATE_LIMITED",
    });
  });
});

describe("session replacement", () => {
  async function signUpAsAlice(): Promise<string> {
    await run(register(IDLE, signupForm({ username: "alice", password: "correct-password1" })));
    const token = mocks.cookieJar.get("typio_session");
    if (token === undefined) throw new Error("no cookie was set");
    return token;
  }

  it("login revokes the previous session of the browser before setting the new cookie", async () => {
    const oldToken = await signUpAsAlice();
    mocks.requestHeaders.set("x-forwarded-for", "198.51.100.20");

    await run(login(IDLE, form({ username: "alice", password: "correct-password1" })));

    const newToken = mocks.cookieJar.get("typio_session");
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(oldToken);
    expect(test.sessions.sessions.has(hashToken(oldToken))).toBe(false);
    expect(test.sessions.sessions.has(hashToken(newToken ?? ""))).toBe(true);
    expect(test.sessions.sessions.size).toBe(1);
  });

  it("registration revokes the previous session too", async () => {
    const oldToken = await signUpAsAlice();

    await run(register(IDLE, signupForm({ username: "bob", password: "correct-password1" })));

    expect(test.sessions.sessions.has(hashToken(oldToken))).toBe(false);
    expect(test.sessions.sessions.size).toBe(1);
  });

  it("guest creation revokes the previous session too", async () => {
    const oldToken = await signUpAsAlice();

    await run(continueAsGuest(IDLE, form({ pseudo: "Zoé" })));

    expect(test.sessions.sessions.has(hashToken(oldToken))).toBe(false);
    expect(test.sessions.sessions.size).toBe(1);
  });

  it("revokes only after success: a failed login keeps the current session", async () => {
    const oldToken = await signUpAsAlice();
    mocks.requestHeaders.set("x-forwarded-for", "198.51.100.20");

    await run(login(IDLE, form({ username: "alice", password: "wrong-password" })));

    expect(test.sessions.sessions.has(hashToken(oldToken))).toBe(true);
    expect(mocks.cookieJar.get("typio_session")).toBe(oldToken);
  });

  it("tolerates a missing, forged or unknown cookie", async () => {
    mocks.cookieJar.set("typio_session", "forged");
    expect(await run(continueAsGuest(IDLE, form({ pseudo: "Zoé" })))).toBe("redirected");

    mocks.cookieJar.set("typio_session", "u".repeat(43));
    expect(await run(continueAsGuest(IDLE, form({ pseudo: "Léa" })))).toBe("redirected");
    expect(test.sessions.sessions.size).toBe(2);
  });

  it("does not touch the sessions of other browsers", async () => {
    await signUpAsAlice();
    const bobBrowser = new Map(mocks.cookieJar);
    mocks.cookieJar.clear();
    await run(register(IDLE, signupForm({ username: "bob", password: "correct-password1" })));
    const bobToken = mocks.cookieJar.get("typio_session") ?? "";
    mocks.cookieJar.clear();

    for (const [name, value] of bobBrowser) mocks.cookieJar.set(name, value);
    await run(register(IDLE, signupForm({ username: "carol", password: "correct-password1" })));

    expect(test.sessions.sessions.has(hashToken(bobToken))).toBe(true);
  });
});

describe("client IP", () => {
  it("ignores x-real-ip: an attacker cannot pick the rate limit bucket with it", async () => {
    mocks.requestHeaders.delete("x-forwarded-for");
    for (let i = 0; i < 120; i += 1) {
      mocks.requestHeaders.set("x-real-ip", `198.51.100.${i % 200}`);
      await run(continueAsGuest(IDLE, form({ pseudo: `Guest ${i}` })));
    }
    mocks.requestHeaders.set("x-real-ip", "203.0.113.250");

    expect(await run(continueAsGuest(IDLE, form({ pseudo: "Late" })))).toEqual({
      status: "error",
      code: "RATE_LIMITED",
    });
  });
});

describe("continueAsGuest", () => {
  it("creates a guest, sets a session cookie, and redirects", async () => {
    const result = await run(continueAsGuest(IDLE, form({ pseudo: "Zoé", locale: "en" })));

    expect(result).toBe("redirected");
    expect(mocks.redirect).toHaveBeenCalledWith("/en");
    expect(test.users.users[0]).toMatchObject({ kind: "guest", displayName: "Zoé", username: null });
    expect(mocks.cookieStore.set.mock.calls[0][2]).not.toHaveProperty("maxAge");
  });

  it("returns INVALID_PSEUDO for a bad pseudo", async () => {
    expect(await run(continueAsGuest(IDLE, form({ pseudo: "<script>" })))).toEqual({
      status: "error",
      code: "INVALID_PSEUDO",
      field: "pseudo",
    });
  });

  it("returns PSEUDO_TAKEN for a pseudo equal to a member's username", async () => {
    await run(register(IDLE, signupForm({ username: "Alice", password: "correct-password1" })));
    mocks.cookieJar.clear();
    mocks.requestHeaders.set("x-forwarded-for", "198.51.100.30");

    expect(await run(continueAsGuest(IDLE, form({ pseudo: "alice" })))).toEqual({
      status: "error",
      code: "PSEUDO_TAKEN",
      field: "pseudo",
    });
    expect(test.users.users.filter((user) => user.kind === "guest")).toHaveLength(0);
  });

  it("returns RATE_LIMITED after 120 guests from the same IP", async () => {
    for (let i = 0; i < 120; i += 1) await run(continueAsGuest(IDLE, form({ pseudo: `Guest ${i}` })));

    expect(await run(continueAsGuest(IDLE, form({ pseudo: "Guest 120" })))).toEqual({
      status: "error",
      code: "RATE_LIMITED",
    });
  });
});

describe("unexpected errors", () => {
  it("returns UNKNOWN and logs only the error name and code, never its message", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    test.users.createMember = async () => {
      throw Object.assign(new Error("Failed query: insert ... params: $argon2id$secret-hash"), {
        code: "XX000",
      });
    };

    const result = await run(register(IDLE, signupForm({ username: "alice", password: "correct-password1" })));

    expect(result).toEqual({ status: "error", code: "UNKNOWN" });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret-hash");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("correct-password1");
    expect(consoleError.mock.calls[0][1]).toEqual({ name: "Error", code: "XX000" });
    consoleError.mockRestore();
  });

  it("returns UNKNOWN when the dependencies cannot be created", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getAuthDeps.mockImplementation(() => {
      throw new Error("DATABASE_URL is required");
    });

    expect(await run(login(IDLE, form({ username: "alice", password: "correct-password1" })))).toEqual({
      status: "error",
      code: "UNKNOWN",
    });
    consoleError.mockRestore();
  });
});

describe("logout", () => {
  it("deletes the session in the database and the cookie, then redirects", async () => {
    await run(register(IDLE, signupForm({ username: "alice", password: "correct-password1" })));
    const token = mocks.cookieJar.get("typio_session");
    expect(token).toBeDefined();
    expect(test.sessions.sessions.has(hashToken(token ?? ""))).toBe(true);

    const result = await run(logout(form({ locale: "en" })));

    expect(result).toBe("redirected");
    expect(mocks.redirect).toHaveBeenLastCalledWith("/en");
    expect(mocks.cookieStore.delete).toHaveBeenCalledWith("typio_session");
    expect(test.sessions.sessions.size).toBe(0);
    expect(mocks.cookieJar.has("typio_session")).toBe(false);
  });

  it("deletes a guest's account along with the session (H-2)", async () => {
    await run(continueAsGuest(IDLE, form({ pseudo: "Zoé" })));
    expect(test.users.users).toHaveLength(1);

    await run(logout(form({ locale: "fr" })));

    expect(test.users.users).toHaveLength(0);
    expect(test.sessions.sessions.size).toBe(0);
    expect(mocks.cookieJar.has("typio_session")).toBe(false);
  });

  it("keeps a member's account on logout", async () => {
    await run(register(IDLE, signupForm({ username: "alice", password: "correct-password1" })));

    await run(logout(form({ locale: "fr" })));

    expect(test.users.users).toHaveLength(1);
    expect(test.users.users[0]).toMatchObject({ kind: "member", username: "alice" });
    expect(test.sessions.sessions.size).toBe(0);
  });

  it("still clears the cookie and redirects without a session", async () => {
    const result = await run(logout(form({})));

    expect(result).toBe("redirected");
    expect(mocks.cookieStore.delete).toHaveBeenCalledWith("typio_session");
    expect(mocks.redirect).toHaveBeenCalledWith("/fr");
  });

  it("still clears the cookie and redirects when the database fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await run(register(IDLE, signupForm({ username: "alice", password: "correct-password1" })));
    test.sessions.delete = async () => {
      throw new Error("database down");
    };

    const result = await run(logout(form({ locale: "fr" })));

    expect(result).toBe("redirected");
    expect(mocks.cookieStore.delete).toHaveBeenCalledWith("typio_session");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
