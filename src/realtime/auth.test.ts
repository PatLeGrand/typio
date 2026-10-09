import { describe, expect, it } from "vitest";
import { authenticateHandshake, isAllowedOrigin, readCookie } from "./auth";
import { createFakeSessions } from "./testSupport";

describe("readCookie", () => {
  it("finds the named cookie among others", () => {
    expect(readCookie("a=1; typio_session=abc; b=2", "typio_session")).toBe("abc");
  });

  it("does not match a cookie whose name only ends with the target", () => {
    expect(readCookie("xtypio_session=abc", "typio_session")).toBeNull();
  });

  it("returns null without header or on a malformed value", () => {
    expect(readCookie(undefined, "typio_session")).toBeNull();
    expect(readCookie("typio_session=%E0%A4%A", "typio_session")).toBeNull();
  });
});

describe("isAllowedOrigin", () => {
  it("accepts a listed origin or no origin, refuses any other", () => {
    expect(isAllowedOrigin("https://typio.example", ["https://typio.example"])).toBe(true);
    expect(isAllowedOrigin(undefined, ["https://typio.example"])).toBe(true);
    expect(isAllowedOrigin("https://evil.example", ["https://typio.example"])).toBe(false);
  });
});

describe("authenticateHandshake", () => {
  const now = new Date();

  it("returns the user of a valid development cookie", async () => {
    const sessions = createFakeSessions();
    const { token, userId } = sessions.signIn("guest", "Zoé");
    const user = await authenticateHandshake(sessions.repository, `typio_session=${token}`, now, "development");
    expect(user?.user).toEqual({ id: userId, kind: "guest", displayName: "Zoé" });
  });

  it("reads the __Host- cookie in production and ignores the development name", async () => {
    const sessions = createFakeSessions();
    const { token } = sessions.signIn("member");
    expect(
      await authenticateHandshake(sessions.repository, `__Host-typio_session=${token}`, now, "production"),
    ).not.toBeNull();
    expect(
      await authenticateHandshake(sessions.repository, `typio_session=${token}`, now, "production"),
    ).toBeNull();
  });

  it("returns the session expiry", async () => {
    const sessions = createFakeSessions();
    const { token } = sessions.signIn("member", "Zoé", { ttlMs: 5_000 });
    const identity = await authenticateHandshake(sessions.repository, `typio_session=${token}`, now, "development");
    expect(identity?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(identity?.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 5_000);
  });

  it("uses the guest account expiry when it comes before the session's", async () => {
    const sessions = createFakeSessions();
    const { token } = sessions.signIn("guest", "Zoé", { ttlMs: 60_000, accountTtlMs: 2_000 });
    const identity = await authenticateHandshake(sessions.repository, `typio_session=${token}`, now, "development");
    expect(identity?.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 2_000);
  });

  it("refuses an expired session", async () => {
    const sessions = createFakeSessions();
    const { token } = sessions.signIn("member", "Zoé", { ttlMs: -1_000 });
    expect(await authenticateHandshake(sessions.repository, `typio_session=${token}`, now, "development")).toBeNull();
  });
});
