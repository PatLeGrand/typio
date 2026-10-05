import { describe, expect, it } from "vitest";
import { getSessionCookieName, sessionCookieOptions } from "./cookie";

describe("getSessionCookieName", () => {
  it("is __Host-typio_session in production", () => {
    expect(getSessionCookieName("production")).toBe("__Host-typio_session");
  });

  it("is typio_session in development and test, where http would refuse the prefix", () => {
    expect(getSessionCookieName("development")).toBe("typio_session");
    expect(getSessionCookieName("test")).toBe("typio_session");
    expect(getSessionCookieName(undefined)).toBe("typio_session");
  });

  it("defaults to the current environment", () => {
    // Vitest tourne avec NODE_ENV=test.
    expect(getSessionCookieName()).toBe("typio_session");
  });
});

describe("sessionCookieOptions", () => {
  it("is HttpOnly, SameSite=Lax and scoped to the whole site", () => {
    expect(sessionCookieOptions(undefined, "development")).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("is Secure in production only", () => {
    expect(sessionCookieOptions(undefined, "production").secure).toBe(true);
    expect(sessionCookieOptions(undefined, "development").secure).toBe(false);
    expect(sessionCookieOptions(undefined, "test").secure).toBe(false);
  });

  it("satisfies the __Host- prefix rules in production: Secure, Path=/, no Domain", () => {
    const options = sessionCookieOptions(2592000, "production");
    expect(options).toMatchObject({ secure: true, path: "/" });
    expect(options).not.toHaveProperty("domain");
  });

  it("has no Max-Age for a session cookie", () => {
    expect(sessionCookieOptions(undefined, "production")).not.toHaveProperty("maxAge");
  });

  it("carries Max-Age when given", () => {
    expect(sessionCookieOptions(2592000, "production").maxAge).toBe(2592000);
  });
});
