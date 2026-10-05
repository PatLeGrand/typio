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

  it("handles non-error values", () => {
    expect(describeError("boom")).toEqual({ name: "string" });
  });
});
