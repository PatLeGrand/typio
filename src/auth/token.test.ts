// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateToken, hashToken, isWellFormedToken } from "./token";

describe("generateToken", () => {
  it("encodes 32 bytes as 43 base64url characters", () => {
    const token = generateToken();
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("returns a different token every time", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateToken()));
    expect(tokens.size).toBe(50);
  });
});

describe("hashToken", () => {
  it("is the SHA-256 hex digest of the token", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is stable for a token and differs between tokens", () => {
    const [a, b] = [generateToken(), generateToken()];
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toBe(hashToken(b));
  });

  it("never contains the raw token", () => {
    const token = generateToken();
    expect(hashToken(token)).not.toContain(token);
  });
});

describe("isWellFormedToken", () => {
  it("accepts a generated token", () => {
    expect(isWellFormedToken(generateToken())).toBe(true);
  });

  it.each([
    undefined,
    null,
    42,
    "",
    "short",
    "a".repeat(42),
    "a".repeat(44),
    `${"a".repeat(42)}=`,
    `${"a".repeat(42)}+`,
    `${"a".repeat(42)} `,
  ])("rejects %j", (value) => {
    expect(isWellFormedToken(value)).toBe(false);
  });
});
