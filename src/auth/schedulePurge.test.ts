// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDeps } from "./testSupport";

const mocks = vi.hoisted(() => ({
  after: vi.fn<(callback: () => Promise<void>) => void>(),
  getAuthDeps: vi.fn(),
}));

vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("./deps", () => ({ getAuthDeps: mocks.getAuthDeps }));

import { schedulePurge } from "./schedulePurge";

let test: ReturnType<typeof createTestDeps>;

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.after.mockReset();
  mocks.getAuthDeps.mockReset();
  test = createTestDeps();
  mocks.getAuthDeps.mockReturnValue(test.deps);
});

describe("schedulePurge", () => {
  it("does nothing during the render: the purge is deferred with `after`", () => {
    const deleteExpired = vi.spyOn(test.sessions, "deleteExpired");

    schedulePurge();

    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(deleteExpired).not.toHaveBeenCalled();
    expect(mocks.getAuthDeps).not.toHaveBeenCalled();
  });

  it("purges expired sessions and guests once the response is sent, for any visitor", async () => {
    await test.users.createGuest({ displayName: "Old", locale: "fr", expiresAt: new Date(test.deps.now().getTime() - 1000) });
    await test.users.createGuest({ displayName: "Fresh", locale: "fr", expiresAt: new Date(test.deps.now().getTime() + 60_000) });

    schedulePurge();
    await mocks.after.mock.calls[0][0]();

    expect(test.users.users.map((user) => user.displayName)).toEqual(["Fresh"]);
  });

  it("is throttled by purgeExpired: a second call within a minute purges nothing", async () => {
    const deleteExpired = vi.spyOn(test.sessions, "deleteExpired");

    schedulePurge();
    schedulePurge();
    await mocks.after.mock.calls[0][0]();
    await mocks.after.mock.calls[1][0]();

    expect(deleteExpired).toHaveBeenCalledTimes(1);
  });

  it("swallows and logs (name and code only) when the dependencies cannot be created", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getAuthDeps.mockImplementation(() => {
      throw Object.assign(new Error("DATABASE_URL is required, postgres://u:secret@h/db"), { code: "NO_URL" });
    });

    schedulePurge();
    await expect(mocks.after.mock.calls[0][0]()).resolves.toBeUndefined();

    expect(consoleError.mock.calls[0][1]).toEqual({ name: "Error", code: "NO_URL" });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret");
  });

  it("never throws into the render when `after` refuses to be called", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.after.mockImplementation(() => {
      throw new Error("`after` was called outside a request scope");
    });

    expect(() => schedulePurge()).not.toThrow();
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
