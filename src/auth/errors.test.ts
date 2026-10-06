import { describe, expect, it } from "vitest";
import { describeError, postgresErrorCode, UNIQUE_VIOLATION } from "./errors";

describe("postgresErrorCode", () => {
  it("reads the code of a direct error", () => {
    expect(postgresErrorCode(Object.assign(new Error("x"), { code: UNIQUE_VIOLATION }))).toBe("23505");
  });

  it("reads the code through a Drizzle-style cause", () => {
    const wrapped = new Error("Failed query", { cause: Object.assign(new Error("dup"), { code: "23505" }) });
    expect(postgresErrorCode(wrapped)).toBe("23505");
  });

  it("returns undefined for errors without a code", () => {
    expect(postgresErrorCode(new Error("x"))).toBeUndefined();
    expect(postgresErrorCode(null)).toBeUndefined();
    expect(postgresErrorCode("string")).toBeUndefined();
  });
});

describe("describeError", () => {
  it("keeps the name and code but drops the message", () => {
    const error = Object.assign(new TypeError("params: secret"), { code: "XX000" });

    expect(describeError(error)).toEqual({ name: "TypeError", code: "XX000" });
  });

  it("names an anonymous error subclass and keeps its HTTP status, as Arctic errors need", () => {
    class UnexpectedResponseError extends Error {
      status = 429;
    }

    expect(describeError(new UnexpectedResponseError("Unexpected error response"))).toEqual({
      name: "Error",
      kind: "UnexpectedResponseError",
      message: "Unexpected error response",
      status: 429,
    });
  });

  it("keeps only Arctic's fixed messages, and the name of a network cause", () => {
    const fetchFailure = new Error("Failed to send request", { cause: new TypeError("connect ECONNRESET 1.2.3.4") });

    expect(describeError(fetchFailure)).toEqual({ name: "Error", message: "Failed to send request", cause: "TypeError" });
    expect(describeError(new Error("Failed query: insert ... params: hash"))).toEqual({ name: "Error" });
  });

  it("ignores a status that is not an HTTP status", () => {
    expect(describeError(Object.assign(new Error("x"), { status: "secret" }))).toEqual({ name: "Error" });
  });

  it("handles non-error values", () => {
    expect(describeError("boom")).toEqual({ name: "string" });
  });
});
