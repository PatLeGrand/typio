// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "./session";
import { createTestDeps } from "./testSupport";
import { generateToken } from "./token";

const mocks = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  cookiesError: undefined as Error | undefined,
  getAuthDeps: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => {
    if (mocks.cookiesError) throw mocks.cookiesError;
    return {
      get: (name: string) =>
        name === "typio_session" && mocks.cookieValue !== undefined
          ? { name, value: mocks.cookieValue }
          : undefined,
    };
  },
}));
vi.mock("./deps", () => ({ getAuthDeps: mocks.getAuthDeps }));

import { getCurrentUser, getCurrentUserForDisplay } from "./currentUser";

let test: ReturnType<typeof createTestDeps>;

beforeEach(() => {
  mocks.cookieValue = undefined;
  mocks.cookiesError = undefined;
  mocks.getAuthDeps.mockReset();
  test = createTestDeps(new Date());
  mocks.getAuthDeps.mockReturnValue(test.deps);
});

describe("getCurrentUser", () => {
  it("returns null without a cookie", async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns the user of a valid session", async () => {
    const { id } = await test.users.createMember({
      username: "alice",
      displayName: "Alice",
      passwordHash: "x",
      locale: "fr",
    });
    const grant = await createSession(test.sessions, { userId: id, kind: "member", remember: false }, new Date());
    mocks.cookieValue = grant.token;

    expect(await getCurrentUser()).toEqual({
      id,
      kind: "member",
      displayName: "Alice",
      username: "alice",
      locale: "fr",
    });
  });

  it("returns null for an unknown token", async () => {
    mocks.cookieValue = generateToken();
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns null for a forged or malformed cookie", async () => {
    mocks.cookieValue = "forged";
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns null and removes an expired session", async () => {
    const { id } = await test.users.createMember({
      username: "alice",
      displayName: "Alice",
      passwordHash: "x",
      locale: "fr",
    });
    const grant = await createSession(
      test.sessions,
      { userId: id, kind: "member", remember: false },
      new Date(Date.now() - 25 * 60 * 60 * 1000),
    );
    mocks.cookieValue = grant.token;

    expect(await getCurrentUser()).toBeNull();
    expect(test.sessions.sessions.size).toBe(0);
  });

  it("is STRICT: it throws when the database is unreachable", async () => {
    mocks.cookieValue = generateToken();
    test.sessions.findWithUser = async () => {
      throw new Error("database down");
    };

    await expect(getCurrentUser()).rejects.toThrow("database down");
  });

  it("is STRICT: it throws when the dependencies cannot be created", async () => {
    mocks.cookieValue = generateToken();
    mocks.getAuthDeps.mockImplementation(() => {
      throw new Error("DATABASE_URL is required");
    });

    await expect(getCurrentUser()).rejects.toThrow("DATABASE_URL is required");
  });
});

describe("getCurrentUserForDisplay", () => {
  it("returns the same user as the strict accessor when all is well", async () => {
    const { id } = await test.users.createMember({
      username: "alice",
      displayName: "Alice",
      passwordHash: "x",
      locale: "fr",
    });
    const grant = await createSession(test.sessions, { userId: id, kind: "member", remember: false }, new Date());
    mocks.cookieValue = grant.token;

    expect(await getCurrentUserForDisplay()).toEqual(await getCurrentUser());
    expect(await getCurrentUserForDisplay()).toMatchObject({ id, kind: "member" });
  });

  it("returns null without a cookie, without touching the database", async () => {
    expect(await getCurrentUserForDisplay()).toBeNull();
    expect(mocks.getAuthDeps).not.toHaveBeenCalled();
  });

  it("returns null and logs only the error name and code when the database rejects", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.cookieValue = generateToken();
    test.sessions.findWithUser = async () => {
      throw Object.assign(new Error("Failed query: select ... params: secret-token"), { code: "ECONNREFUSED" });
    };

    expect(await getCurrentUserForDisplay()).toBeNull();

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][1]).toEqual({ name: "Error", code: "ECONNREFUSED" });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret-token");
    consoleError.mockRestore();
  });

  it("returns null when the dependencies cannot be created (DATABASE_URL missing)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.cookieValue = generateToken();
    mocks.getAuthDeps.mockImplementation(() => {
      throw new Error("DATABASE_URL is required");
    });

    expect(await getCurrentUserForDisplay()).toBeNull();
    consoleError.mockRestore();
  });

  it("lets a failure to read cookies propagate: Next relies on it to render the page dynamically", async () => {
    mocks.cookiesError = new Error("Dynamic server usage");

    await expect(getCurrentUserForDisplay()).rejects.toThrow("Dynamic server usage");
  });
});
