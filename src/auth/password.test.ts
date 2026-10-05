// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ARGON2_CONCURRENCY, DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "./password";
import { QueueFullError } from "./semaphore";

const ARGON2ID_PREFIX = "$argon2id$v=19$m=19456,t=2,p=1$";

describe("hashPassword", () => {
  it("produces an argon2id hash with the OWASP parameters", async () => {
    const hashed = await hashPassword("correct horse battery staple");
    expect(hashed.startsWith(ARGON2ID_PREFIX)).toBe(true);
  });

  it("never contains the plain password and is salted", async () => {
    const [first, second] = await Promise.all([hashPassword("same-password"), hashPassword("same-password")]);
    expect(first).not.toContain("same-password");
    expect(first).not.toBe(second);
  });
});

describe("verifyPassword", () => {
  it("accepts the right password", async () => {
    const hashed = await hashPassword("right-password");
    expect(await verifyPassword(hashed, "right-password")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hashed = await hashPassword("right-password");
    expect(await verifyPassword(hashed, "wrong-password")).toBe(false);
  });

  it("rejects instead of throwing on a malformed hash", async () => {
    expect(await verifyPassword("not-a-hash", "whatever-password")).toBe(false);
  });
});

describe("DUMMY_PASSWORD_HASH", () => {
  it("has the same argon2id parameters as real hashes, so verifying it costs the same", () => {
    expect(DUMMY_PASSWORD_HASH.startsWith(ARGON2ID_PREFIX)).toBe(true);
  });

  it("is a well-formed hash that matches no plausible password", async () => {
    expect(await verifyPassword(DUMMY_PASSWORD_HASH, "password")).toBe(false);
    expect(await verifyPassword(DUMMY_PASSWORD_HASH, "")).toBe(false);
  });
});

describe("argon2 concurrency cap", () => {
  it("allows 4 concurrent computations and a queue of 64 (19 MiB each, 512 MiB container)", () => {
    expect(ARGON2_CONCURRENCY).toEqual({ maxConcurrent: 4, maxQueue: 64 });
  });

  it("refuses with QueueFullError, without computing, once 4 are running and 64 are queued", async () => {
    const password = "some-password";
    const burst = Array.from({ length: 4 + 64 }, () => hashPassword(password));

    await expect(hashPassword(password)).rejects.toBeInstanceOf(QueueFullError);
    await expect(verifyPassword(DUMMY_PASSWORD_HASH, password)).rejects.toBeInstanceOf(QueueFullError);

    const results = await Promise.all(burst);
    expect(results.every((hashed) => hashed.startsWith(ARGON2ID_PREFIX))).toBe(true);
    // La file est vidée : le calcul redevient possible.
    expect(await verifyPassword(DUMMY_PASSWORD_HASH, password)).toBe(false);
  }, 60_000);
});
