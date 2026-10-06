// @vitest-environment node
import { describe, expect, it } from "vitest";
import { OAUTH_REQUEST_TIMEOUT_MS, withDeadline } from "./timeout";

describe("withDeadline", () => {
  it("is 10 seconds by default", () => {
    expect(OAUTH_REQUEST_TIMEOUT_MS).toBe(10_000);
  });

  it("resolves with the operation's value when it finishes in time", async () => {
    await expect(withDeadline(Promise.resolve("token"), 1000)).resolves.toBe("token");
  });

  it("propagates the operation's own rejection", async () => {
    await expect(withDeadline(Promise.reject(new Error("boom")), 1000)).rejects.toThrow("boom");
  });

  it("rejects with a timeout when the operation hangs", async () => {
    const hanging = new Promise<string>(() => {});
    await expect(withDeadline(hanging, 20)).rejects.toMatchObject({ name: "TimeoutError" });
  });
});
