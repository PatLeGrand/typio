// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "./session";
import { createTestDeps } from "./testSupport";
import { generateToken } from "./token";

const mocks = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  getAuthDeps: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "typio_session" && mocks.cookieValue !== undefined
        ? { name, value: mocks.cookieValue }
        : undefined,
  }),
}));
vi.mock("./deps", () => ({ getAuthDeps: mocks.getAuthDeps }));

import { getCurrentUser } from "./currentUser";

let test: ReturnType<typeof createTestDeps>;

beforeEach(() => {
  mocks.cookieValue = undefined;
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
});
