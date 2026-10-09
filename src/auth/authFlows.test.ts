// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createGuest, loginMember, registerMember, type RegistrationInput } from "./authFlows";
import { DUMMY_PASSWORD_HASH } from "./password";
import { QueueFullError } from "./semaphore";
import { hashToken } from "./token";
import { createTestDeps } from "./testSupport";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

/** Entrée d'inscription valide ; `loginMember` n'en lit que les champs de `Credentials`. */
function credentials(overrides: Partial<RegistrationInput> = {}): RegistrationInput {
  const password = overrides.password ?? "correct-password1";
  return {
    ip: "203.0.113.7",
    username: "Alice",
    password,
    passwordConfirm: password,
    termsAccepted: true,
    remember: false,
    locale: "fr",
    ...overrides,
  };
}

/** Des membres créés directement dans le faux dépôt : seul `createGuest` est sous test. */
async function withMembers(usernames: readonly string[]) {
  const test = createTestDeps();
  for (const username of usernames) {
    await test.users.createMember({ username, displayName: username, passwordHash: "hash", locale: "fr" });
  }
  return test;
}

async function withAlice() {
  const test = createTestDeps();
  const registered = await registerMember(test.deps, credentials({ ip: "10.0.0.1" }));
  expect(registered.ok).toBe(true);
  return test;
}

describe("registerMember", () => {
  it("creates a member with a hashed password and display name in the typed case", async () => {
    const { deps, users } = createTestDeps();
    const result = await registerMember(deps, credentials({ username: "  Alice_B ", locale: "en" }));

    expect(result.ok).toBe(true);
    expect(users.users).toHaveLength(1);
    expect(users.users[0]).toMatchObject({
      kind: "member",
      username: "alice_b",
      displayName: "Alice_B",
      locale: "en",
      expiresAt: null,
    });
    expect(users.users[0].passwordHash).toBe("fake-hash:correct-password1");
    expect(users.users[0].passwordHash).not.toBe("correct-password1");
  });

  it("logs the new member in: session stored by token hash", async () => {
    const { deps, sessions } = createTestDeps();
    const result = await registerMember(deps, credentials());

    if (!result.ok) throw new Error("expected success");
    expect(sessions.sessions.has(hashToken(result.grant.token))).toBe(true);
  });

  it("honors remember: 30 days with Max-Age, otherwise 24 hours without", async () => {
    const remembered = createTestDeps();
    const a = await registerMember(remembered.deps, credentials({ remember: true }));
    const plain = createTestDeps();
    const b = await registerMember(plain.deps, credentials({ remember: false }));

    if (!a.ok || !b.ok) throw new Error("expected success");
    expect(a.grant.maxAgeSeconds).toBe(30 * 24 * 60 * 60);
    expect(b.grant.maxAgeSeconds).toBeUndefined();
    expect(b.grant.expiresAt.getTime() - plain.deps.now().getTime()).toBe(24 * HOUR);
  });

  it("answers INVALID_USERNAME and INVALID_PASSWORD with their field", async () => {
    const { deps, users } = createTestDeps();

    expect(await registerMember(deps, credentials({ username: "a!" }))).toEqual({
      ok: false,
      error: { code: "INVALID_USERNAME", field: "username" },
    });
    expect(await registerMember(deps, credentials({ password: "short" }))).toEqual({
      ok: false,
      error: { code: "INVALID_PASSWORD", field: "password" },
    });
    expect(users.users).toHaveLength(0);
  });

  it.each([
    ["no letter", "12345678"],
    ["no digit", "password-only"],
    ["7 characters", "abcde12"],
    ["129 characters", `a1${"b".repeat(127)}`],
  ])("answers INVALID_PASSWORD for a password with %s", async (_label, password) => {
    const { deps, users } = createTestDeps();

    expect(await registerMember(deps, credentials({ password }))).toEqual({
      ok: false,
      error: { code: "INVALID_PASSWORD", field: "password" },
    });
    expect(users.users).toHaveLength(0);
  });

  it("accepts the 8 and 128 character bounds, and non-ASCII letters and digits", async () => {
    for (const password of ["abcdefg1", `a1${"b".repeat(126)}`, "éclair٣٤٥", "пароль12"]) {
      const { deps } = createTestDeps();
      expect(await registerMember(deps, credentials({ password }))).toMatchObject({ ok: true });
    }
  });

  it("answers PASSWORD_MISMATCH on the confirmation field when it differs, is missing, or is not text", async () => {
    const { deps, users } = createTestDeps();

    for (const passwordConfirm of ["correct-password2", "", undefined, 12345678, ["correct-password1"]]) {
      expect(await registerMember(deps, credentials({ passwordConfirm }))).toEqual({
        ok: false,
        error: { code: "PASSWORD_MISMATCH", field: "passwordConfirm" },
      });
    }
    expect(users.users).toHaveLength(0);
  });

  it("answers TERMS_REQUIRED on the terms field when the box is not ticked", async () => {
    const { deps, users } = createTestDeps();

    expect(await registerMember(deps, credentials({ termsAccepted: false }))).toEqual({
      ok: false,
      error: { code: "TERMS_REQUIRED", field: "terms" },
    });
    expect(users.users).toHaveLength(0);
  });

  it("reports the first failing control: username, then password rule, then confirmation, then terms", async () => {
    const { deps } = createTestDeps();
    const bad = { passwordConfirm: "different", termsAccepted: false };

    expect(await registerMember(deps, credentials({ ...bad, username: "a!", password: "x" }))).toMatchObject({
      error: { code: "INVALID_USERNAME" },
    });
    expect(await registerMember(deps, credentials({ ...bad, password: "x" }))).toMatchObject({
      error: { code: "INVALID_PASSWORD" },
    });
    expect(await registerMember(deps, credentials({ ...bad }))).toMatchObject({
      error: { code: "PASSWORD_MISMATCH" },
    });
    expect(await registerMember(deps, credentials({ termsAccepted: false }))).toMatchObject({
      error: { code: "TERMS_REQUIRED" },
    });
  });

  it("checks the form before the limiter and before hashing: invalid forms cost no budget", async () => {
    const { deps } = createTestDeps();
    let hashCalls = 0;
    const hash = deps.passwords.hash;
    deps.passwords.hash = async (password) => {
      hashCalls += 1;
      return hash(password);
    };

    for (let i = 0; i < 100; i += 1) await registerMember(deps, credentials({ termsAccepted: false }));

    expect(hashCalls).toBe(0);
    expect(await registerMember(deps, credentials({ username: "valid_one" }))).toMatchObject({ ok: true });
  });

  it("answers USERNAME_TAKEN regardless of case", async () => {
    const { deps, users } = await withAlice();

    expect(await registerMember(deps, credentials({ username: "ALICE", ip: "10.0.0.2" }))).toEqual({
      ok: false,
      error: { code: "USERNAME_TAKEN", field: "username" },
    });
    expect(users.users).toHaveLength(1);
  });

  it("rethrows unexpected repository errors", async () => {
    const { deps, users } = createTestDeps();
    users.createMember = async () => {
      throw new Error("database down");
    };

    await expect(registerMember(deps, credentials())).rejects.toThrow("database down");
  });

  it("allows 60 registrations per hour per IP", async () => {
    const { deps, advance } = createTestDeps();

    for (let i = 0; i < 60; i += 1) {
      const result = await registerMember(deps, credentials({ username: `user_${i}` }));
      expect(result.ok).toBe(true);
    }
    expect(await registerMember(deps, credentials({ username: "user_60" }))).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
    expect(await registerMember(deps, credentials({ ip: "198.51.100.9", username: "other" }))).toMatchObject({
      ok: true,
    });

    advance(HOUR);
    expect(await registerMember(deps, credentials({ username: "user_61" }))).toMatchObject({ ok: true });
  });

  it("rate limits before hashing anything", async () => {
    const { deps } = createTestDeps();
    let hashCalls = 0;
    const hash = deps.passwords.hash;
    deps.passwords.hash = async (password) => {
      hashCalls += 1;
      return hash(password);
    };

    for (let i = 0; i < 60; i += 1) await registerMember(deps, credentials({ username: `user_${i}` }));
    hashCalls = 0;
    await registerMember(deps, credentials({ username: "blocked" }));

    expect(hashCalls).toBe(0);
  });
});

describe("saturated argon2 queue", () => {
  it("register answers RATE_LIMITED and creates nothing", async () => {
    const { deps, users, sessions } = createTestDeps();
    deps.passwords.hash = async () => {
      throw new QueueFullError();
    };

    expect(await registerMember(deps, credentials())).toEqual({ ok: false, error: { code: "RATE_LIMITED" } });
    expect(users.users).toHaveLength(0);
    expect(sessions.sessions.size).toBe(0);
  });

  it("login answers RATE_LIMITED, opens no session, and does not count a failure", async () => {
    const { deps, sessions } = await withAlice();
    const real = deps.passwords.verify;
    deps.passwords.verify = async () => {
      throw new QueueFullError();
    };
    const sessionsBefore = sessions.sessions.size;

    for (let i = 0; i < 10; i += 1) {
      expect(await loginMember(deps, credentials())).toEqual({ ok: false, error: { code: "RATE_LIMITED" } });
    }
    expect(sessions.sessions.size).toBe(sessionsBefore);

    // Une fois la file vidée, le bon mot de passe passe : aucun échec n'a été comptabilisé.
    deps.passwords.verify = real;
    expect(await loginMember(deps, credentials())).toMatchObject({ ok: true });
  });

  it("also covers the dummy hash check for an unknown username", async () => {
    const { deps } = createTestDeps();
    deps.passwords.verify = async () => {
      throw new QueueFullError();
    };

    expect(await loginMember(deps, credentials({ username: "ghost" }))).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
  });

  it("still rethrows other hasher errors", async () => {
    const { deps } = createTestDeps();
    deps.passwords.hash = async () => {
      throw new Error("native crash");
    };

    await expect(registerMember(deps, credentials())).rejects.toThrow("native crash");
  });
});

describe("loginMember", () => {
  it("logs in with the right password, case-insensitively on the username", async () => {
    const { deps, sessions } = await withAlice();
    const before = sessions.sessions.size;

    const result = await loginMember(deps, credentials({ username: "ALICE" }));

    expect(result.ok).toBe(true);
    expect(sessions.sessions.size).toBe(before + 1);
  });

  it("remember: 30 days and Max-Age; without: 24 hours and a session cookie", async () => {
    const { deps } = await withAlice();
    const remembered = await loginMember(deps, credentials({ remember: true }));
    const plain = await loginMember(deps, credentials({ remember: false }));

    if (!remembered.ok || !plain.ok) throw new Error("expected success");
    expect(remembered.grant.maxAgeSeconds).toBe(2_592_000);
    expect(remembered.grant.expiresAt.getTime() - deps.now().getTime()).toBe(30 * 24 * HOUR);
    expect(plain.grant.maxAgeSeconds).toBeUndefined();
    expect(plain.grant.expiresAt.getTime() - deps.now().getTime()).toBe(24 * HOUR);
  });

  it("answers INVALID_CREDENTIALS for a wrong password", async () => {
    const { deps } = await withAlice();
    expect(await loginMember(deps, credentials({ password: "wrong-password" }))).toEqual({
      ok: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
  });

  it("answers the same INVALID_CREDENTIALS for an unknown username", async () => {
    const { deps } = await withAlice();
    expect(await loginMember(deps, credentials({ username: "nobody" }))).toEqual({
      ok: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
  });

  it("verifies the dummy hash when the username does not exist, and the real hash otherwise", async () => {
    const { deps, passwords } = await withAlice();
    passwords.verifyCalls.length = 0;

    await loginMember(deps, credentials({ username: "nobody", password: "whatever-pass" }));
    await loginMember(deps, credentials({ password: "wrong-password" }));

    expect(passwords.verifyCalls).toEqual([
      { hash: DUMMY_PASSWORD_HASH, password: "whatever-pass" },
      { hash: "fake-hash:correct-password1", password: "wrong-password" },
    ]);
  });

  describe("account without a password (created through GitHub or Discord)", () => {
    async function withOAuthMember() {
      const test = createTestDeps();
      await test.oauthAccounts.createMemberWithAccount({
        provider: "github",
        providerAccountId: "583231",
        username: "octocat",
        displayName: "The Octocat",
        locale: "fr",
      });
      return test;
    }

    it("answers INVALID_CREDENTIALS, exactly like an unknown username", async () => {
      const { deps } = await withOAuthMember();

      const passwordless = await loginMember(deps, credentials({ username: "octocat", password: "whatever-pass" }));
      const unknown = await loginMember(deps, credentials({ username: "nobody", password: "whatever-pass" }));

      expect(passwordless).toEqual({ ok: false, error: { code: "INVALID_CREDENTIALS" } });
      expect(passwordless).toEqual(unknown);
    });

    it("verifies the dummy hash, so the response time does not reveal the account", async () => {
      const { deps, passwords } = await withOAuthMember();
      passwords.verifyCalls.length = 0;

      await loginMember(deps, credentials({ username: "octocat", password: "whatever-pass" }));

      expect(passwords.verifyCalls).toEqual([{ hash: DUMMY_PASSWORD_HASH, password: "whatever-pass" }]);
    });

    it("never opens a session, even if the hasher says yes, and consumes the failure counters", async () => {
      const { deps, passwords, sessions } = await withOAuthMember();
      passwords.verify = async () => true;

      for (let i = 0; i < 5; i += 1) {
        expect(await loginMember(deps, credentials({ username: "octocat", password: "whatever-pass" }))).toEqual({
          ok: false,
          error: { code: "INVALID_CREDENTIALS" },
        });
      }

      expect(sessions.sessions.size).toBe(0);
      // Les 5 essais du couple (IP, identifiant) sont consommés : le suivant est limité.
      expect(await loginMember(deps, credentials({ username: "octocat", password: "whatever-pass" }))).toEqual({
        ok: false,
        error: { code: "RATE_LIMITED" },
      });
    });
  });

  it("never logs a user in against the dummy hash", async () => {
    const { deps } = createTestDeps();
    deps.passwords.verify = async () => true; // even a verifier that says yes

    expect(await loginMember(deps, credentials({ username: "ghost" }))).toEqual({
      ok: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
  });

  it("answers INVALID_CREDENTIALS to malformed input without hashing it", async () => {
    const { deps, passwords } = await withAlice();
    passwords.verifyCalls.length = 0;

    expect(await loginMember(deps, credentials({ username: "a!" }))).toEqual({
      ok: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
    expect(await loginMember(deps, credentials({ password: "x".repeat(10_000) }))).toEqual({
      ok: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
    expect(passwords.verifyCalls).toHaveLength(0);
  });

  it("blocks the 6th failure within 15 minutes with RATE_LIMITED, even with the right password", async () => {
    const { deps, passwords } = await withAlice();

    for (let i = 0; i < 5; i += 1) {
      expect(await loginMember(deps, credentials({ password: "wrong-password" }))).toEqual({
        ok: false,
        error: { code: "INVALID_CREDENTIALS" },
      });
    }
    passwords.verifyCalls.length = 0;

    expect(await loginMember(deps, credentials({ password: "wrong-password" }))).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
    expect(await loginMember(deps, credentials())).toEqual({ ok: false, error: { code: "RATE_LIMITED" } });
    expect(passwords.verifyCalls).toHaveLength(0);
  });

  it("slides: the block lifts once the failures leave the 15 minute window", async () => {
    const { deps, advance } = await withAlice();
    for (let i = 0; i < 5; i += 1) await loginMember(deps, credentials({ password: "wrong-password" }));

    advance(15 * MINUTE - 1);
    expect(await loginMember(deps, credentials())).toEqual({ ok: false, error: { code: "RATE_LIMITED" } });

    advance(1);
    expect(await loginMember(deps, credentials())).toMatchObject({ ok: true });
  });

  it("counts failures per (IP, username): other IPs and other usernames are unaffected", async () => {
    const { deps } = await withAlice();
    for (let i = 0; i < 5; i += 1) await loginMember(deps, credentials({ password: "wrong-password" }));

    expect(await loginMember(deps, credentials({ ip: "198.51.100.9" }))).toMatchObject({ ok: true });
    expect(await loginMember(deps, credentials({ username: "bob", password: "wrong-password" }))).toEqual({
      ok: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
  });

  it("a success clears the failure counter of that pair", async () => {
    const { deps } = await withAlice();
    for (let i = 0; i < 4; i += 1) await loginMember(deps, credentials({ password: "wrong-password" }));
    expect(await loginMember(deps, credentials())).toMatchObject({ ok: true });

    for (let i = 0; i < 5; i += 1) {
      expect(await loginMember(deps, credentials({ password: "wrong-password" }))).toEqual({
        ok: false,
        error: { code: "INVALID_CREDENTIALS" },
      });
    }
  });

  it("limits an IP to 300 attempts per 15 minutes across usernames", async () => {
    const { deps, advance } = createTestDeps();

    for (let i = 0; i < 300; i += 1) {
      expect(await loginMember(deps, credentials({ username: `user_${i}`, password: "wrong-password" }))).toEqual({
        ok: false,
        error: { code: "INVALID_CREDENTIALS" },
      });
    }
    expect(await loginMember(deps, credentials({ username: "user_300" }))).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
    expect(await loginMember(deps, credentials({ ip: "198.51.100.9", username: "user_300" }))).toEqual({
      ok: false,
      error: { code: "INVALID_CREDENTIALS" },
    });

    advance(15 * MINUTE);
    expect(await loginMember(deps, credentials({ username: "user_301" }))).toEqual({
      ok: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
  });

  it("purges expired sessions when a session is opened", async () => {
    const { deps, sessions, advance } = await withAlice();
    expect(sessions.sessions.size).toBe(1);

    advance(25 * HOUR);
    await loginMember(deps, credentials({ remember: true }));

    expect(sessions.sessions.size).toBe(1);
  });

  it("does not fail the login when the purge fails", async () => {
    const { deps, sessions, advance } = await withAlice();
    let purgeAttempts = 0;
    sessions.deleteExpired = async () => {
      purgeAttempts += 1;
      throw new Error("purge failed");
    };
    advance(2 * MINUTE); // past the once-per-minute throttle of the registration's purge

    expect(await loginMember(deps, credentials())).toMatchObject({ ok: true });
    expect(purgeAttempts).toBe(1);
  });

  it("purges expired guests along with expired sessions", async () => {
    const { deps, users, advance } = createTestDeps();
    await createGuest(deps, { ip: "203.0.113.7", pseudo: "Zoé", locale: "fr" });
    expect(users.users).toHaveLength(1);

    advance(25 * HOUR);
    await createGuest(deps, { ip: "203.0.113.8", pseudo: "Léa", locale: "fr" });

    expect(users.users.map((user) => user.displayName)).toEqual(["Léa"]);
  });
});

describe("concurrent login attempts", () => {
  /** Hacheur lent : `verify` ne rend la main que quand le test le décide. */
  function slowVerifier(deps: ReturnType<typeof createTestDeps>["deps"]) {
    let verifyCalls = 0;
    const releases: (() => void)[] = [];
    deps.passwords.verify = (hash, password) => {
      verifyCalls += 1;
      return new Promise<boolean>((resolve) => {
        releases.push(() => resolve(hash === `fake-hash:${password}`));
      });
    };
    return {
      calls: () => verifyCalls,
      releaseAll: () => releases.splice(0).forEach((release) => release()),
    };
  }

  it("lets at most 5 verifications through for 20 parallel attempts on the same pair", async () => {
    const { deps } = await withAlice();
    const slow = slowVerifier(deps);

    const attempts = Array.from({ length: 20 }, () =>
      loginMember(deps, credentials({ password: "wrong-password" })),
    );
    // Les 15 refus sont immédiats ; on laisse les 5 réservations atteindre leur vérification avant de les débloquer.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(slow.calls()).toBeLessThanOrEqual(5);
    slow.releaseAll();
    const results = await Promise.all(attempts);

    expect(slow.calls()).toBe(5);
    expect(results.filter((r) => !r.ok && r.error.code === "INVALID_CREDENTIALS")).toHaveLength(5);
    expect(results.filter((r) => !r.ok && r.error.code === "RATE_LIMITED")).toHaveLength(15);
  });

  it("also caps parallel attempts at 50 per username across different IPs", async () => {
    const { deps } = await withAlice();
    const slow = slowVerifier(deps);

    const attempts = Array.from({ length: 80 }, (_, i) =>
      loginMember(deps, credentials({ ip: `198.51.100.${i}`, password: "wrong-password" })),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    slow.releaseAll();
    const results = await Promise.all(attempts);

    expect(slow.calls()).toBe(50);
    expect(results.filter((r) => !r.ok && r.error.code === "RATE_LIMITED")).toHaveLength(30);
  });
});

describe("distributed brute force", () => {
  it("blocks a username after 50 failures from many IPs, unknown usernames included", async () => {
    const { deps, passwords } = createTestDeps();

    for (let i = 0; i < 50; i += 1) {
      expect(await loginMember(deps, credentials({ ip: `198.51.100.${i}`, username: "ghost" }))).toEqual({
        ok: false,
        error: { code: "INVALID_CREDENTIALS" },
      });
    }
    passwords.verifyCalls.length = 0;

    expect(await loginMember(deps, credentials({ ip: "203.0.113.200", username: "ghost" }))).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
    expect(passwords.verifyCalls).toHaveLength(0);
    // Un autre identifiant n'est pas touché.
    expect(await loginMember(deps, credentials({ ip: "203.0.113.200", username: "other" }))).toEqual({
      ok: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
  });

  it("a successful login releases its slot in the per-username budget", async () => {
    const { deps } = await withAlice();

    for (let i = 0; i < 60; i += 1) {
      expect(await loginMember(deps, credentials({ ip: `198.51.100.${i}` }))).toMatchObject({ ok: true });
    }
  });

  it("the per-username block lifts after 15 minutes", async () => {
    const { deps, advance } = createTestDeps();
    for (let i = 0; i < 50; i += 1) {
      await loginMember(deps, credentials({ ip: `198.51.100.${i}`, username: "ghost" }));
    }
    expect(await loginMember(deps, credentials({ ip: "203.0.113.200", username: "ghost" }))).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });

    advance(15 * MINUTE);
    expect(await loginMember(deps, credentials({ ip: "203.0.113.200", username: "ghost" }))).toEqual({
      ok: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
  });

  it("a refusal by the per-username cap does not consume the pair budget", async () => {
    const { deps } = createTestDeps();
    for (let i = 0; i < 50; i += 1) {
      await loginMember(deps, credentials({ ip: `198.51.100.${i}`, username: "ghost" }));
    }
    for (let i = 0; i < 10; i += 1) {
      await loginMember(deps, credentials({ ip: "203.0.113.200", username: "ghost" }));
    }

    expect(deps.limiters.loginFailures.isLimited("203.0.113.200|ghost")).toBe(false);
  });

  it("groups the IPv6 addresses of a /64 into one budget", async () => {
    const { deps } = await withAlice();
    const wrong = (suffix: string) =>
      loginMember(deps, credentials({ ip: `2001:db8:1:2:${suffix}`, password: "wrong-password" }));

    for (let i = 1; i <= 5; i += 1) await wrong(`${i}:${i}:${i}:${i}`);

    expect(await wrong("ffff:ffff:ffff:ffff")).toEqual({ ok: false, error: { code: "RATE_LIMITED" } });
    // Un autre /64 a son propre budget.
    expect(
      await loginMember(deps, credentials({ ip: "2001:db8:1:3::1", password: "wrong-password" })),
    ).toEqual({ ok: false, error: { code: "INVALID_CREDENTIALS" } });
  });

  it("keeps IPv4-mapped IPv6 and plain IPv4 forms of a client in one budget", async () => {
    const { deps } = await withAlice();
    for (let i = 0; i < 3; i += 1) await loginMember(deps, credentials({ ip: "203.0.113.7", password: "wrong-password" }));
    for (let i = 0; i < 2; i += 1) {
      await loginMember(deps, credentials({ ip: "::ffff:203.0.113.7", password: "wrong-password" }));
    }

    expect(await loginMember(deps, credentials({ ip: "203.0.113.7" }))).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
  });

  it("groups registrations and guests by IPv6 /64 too", async () => {
    const { deps } = createTestDeps();
    for (let i = 0; i < 120; i += 1) {
      await createGuest(deps, { ip: `2001:db8:9:9:${i}::1`, pseudo: `Guest ${i}`, locale: "fr" });
    }

    expect(await createGuest(deps, { ip: "2001:db8:9:9::dead", pseudo: "Late", locale: "fr" })).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
  });
});

describe("createGuest: pseudo equal to a member username", () => {
  it.each(["alice", "Alice", "ALICE", "  alice  "])("refuses %j with PSEUDO_TAKEN on the pseudo field", async (pseudo) => {
    const { deps, users } = await withAlice();

    expect(await createGuest(deps, { ip: "203.0.113.7", pseudo, locale: "fr" })).toEqual({
      ok: false,
      error: { code: "PSEUDO_TAKEN", field: "pseudo" },
    });
    expect(users.users.filter((user) => user.kind === "guest")).toHaveLength(0);
  });

  it("compares without case: a lookalike made with the Kelvin sign is refused too", async () => {
    const { deps } = createTestDeps();
    await registerMember(deps, credentials({ username: "kevin", ip: "10.0.0.1" }));

    expect(await createGuest(deps, { ip: "203.0.113.7", pseudo: "Kevin", locale: "fr" })).toMatchObject({
      ok: false,
      error: { code: "PSEUDO_TAKEN" },
    });
  });

  it.each([
    ["Àlice", "an accented lookalike"],
    ["ALICÉ", "an accented lookalike in capitals"],
    ["A" + String.fromCodePoint(0x300) + "lice", "an accented lookalike typed decomposed (NFD)"],
  ])("refuses %j (%s) with PSEUDO_TAKEN: the comparison uses the skeleton", async (pseudo) => {
    const { deps } = await withAlice();

    expect(await createGuest(deps, { ip: "203.0.113.7", pseudo, locale: "fr" })).toEqual({
      ok: false,
      error: { code: "PSEUDO_TAKEN", field: "pseudo" },
    });
  });

  it.each([
    ["AIice", "a capital I standing for l"],
    ["a1ice", "a digit 1 standing for l"],
    ["b0b", "a digit 0 standing for o"],
    ["rnario", "rn standing for m"],
    ["ALICE", "capitals only"],
    ["Àlice", "an accented lookalike"],
    ["aIice", "a capital I in lowercase text"],
  ])("refuses %j (%s) when the members alice, bob and mario exist", async (pseudo) => {
    const { deps } = await withMembers(["alice", "bob", "mario"]);

    expect(await createGuest(deps, { ip: "203.0.113.7", pseudo, locale: "fr" })).toEqual({
      ok: false,
      error: { code: "PSEUDO_TAKEN", field: "pseudo" },
    });
  });

  it.each([
    ["b0b", "bob"],
    ["rnario", "mario"],
    ["vvill", "will"],
    ["ilyes", "IIyes"],
    ["ines", "lnes"],
    ["avw", "avvv"],
    ["vwa", "vvva"],
    ["ella", "Elia"],
  ])("folds both sides: with the member %j, the guest %j is refused", async (username, pseudo) => {
    const { deps } = await withMembers([username]);

    expect(await createGuest(deps, { ip: "203.0.113.7", pseudo, locale: "fr" })).toEqual({
      ok: false,
      error: { code: "PSEUDO_TAKEN", field: "pseudo" },
    });
  });

  it.each(["alice 2", "Zoé", "Aline", "Lucas10", "Inès", "Bernard"])(
    "accepts the legitimate pseudo %j when the members alice, bob and mario exist",
    async (pseudo) => {
      const { deps } = await withMembers(["alice", "bob", "mario"]);

      expect(await createGuest(deps, { ip: "203.0.113.7", pseudo, locale: "fr" })).toMatchObject({ ok: true });
    },
  );

  it.each([
    ["Cyrillic a (U+0430)", String.fromCodePoint(0x430) + "lice"],
    ["fullwidth", String.fromCodePoint(0xff41, 0xff4c, 0xff49, 0xff43, 0xff45)],
  ])("refuses a %s homoglyph of a member username with INVALID_PSEUDO and creates nothing", async (_label, pseudo) => {
    const { deps, users } = await withAlice();

    expect(await createGuest(deps, { ip: "203.0.113.7", pseudo, locale: "fr" })).toEqual({
      ok: false,
      error: { code: "INVALID_PSEUDO", field: "pseudo" },
    });
    expect(users.users.filter((user) => user.kind === "guest")).toHaveLength(0);
  });

  it("accepts French accented pseudos when no member has their skeleton", async () => {
    const { deps } = await withAlice();

    expect(await createGuest(deps, { ip: "203.0.113.7", pseudo: "Éloïse", locale: "fr" })).toMatchObject({ ok: true });
    expect(await createGuest(deps, { ip: "203.0.113.7", pseudo: "Lætitia", locale: "fr" })).toMatchObject({ ok: true });
  });

  it("allows a pseudo that only resembles a member username", async () => {
    const { deps } = await withAlice();

    expect(await createGuest(deps, { ip: "203.0.113.7", pseudo: "alice 2", locale: "fr" })).toMatchObject({ ok: true });
    expect(await createGuest(deps, { ip: "203.0.113.7", pseudo: "Zoé", locale: "fr" })).toMatchObject({ ok: true });
  });

  it("does not match another guest's pseudo", async () => {
    const { deps } = createTestDeps();
    expect(await createGuest(deps, { ip: "203.0.113.7", pseudo: "Zoé", locale: "fr" })).toMatchObject({ ok: true });
    expect(await createGuest(deps, { ip: "203.0.113.7", pseudo: "zoé", locale: "fr" })).toMatchObject({ ok: true });
  });

  it("checks the format and the limiter first: no lookup for an invalid pseudo or a limited IP", async () => {
    const { deps } = await withAlice();
    let lookups = 0;
    const lookup = deps.users.memberUsernameExists.bind(deps.users);
    deps.users.memberUsernameExists = async (skeleton, options) => {
      lookups += 1;
      return lookup(skeleton, options);
    };

    await createGuest(deps, { ip: "203.0.113.7", pseudo: "<b>", locale: "fr" });
    expect(lookups).toBe(0);

    for (let i = 0; i < 120; i += 1) {
      await createGuest(deps, { ip: "198.51.100.1", pseudo: `Guest ${i}`, locale: "fr" });
    }
    lookups = 0;
    expect(await createGuest(deps, { ip: "198.51.100.1", pseudo: "alice", locale: "fr" })).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
    expect(lookups).toBe(0);
  });
});

describe("loginMember: per-username limiter full of live keys", () => {
  it("answers RATE_LIMITED for a new username without evicting a victim, and releases the pair reservation", async () => {
    const { deps } = await withAlice();
    const { loginFailuresPerUsername, loginFailures } = deps.limiters;
    for (let i = 0; i < 100_000; i += 1) loginFailuresPerUsername.consume(`filler-${i}`);

    expect(await loginMember(deps, credentials({ username: "newcomer", password: "wrong-password1" }))).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
    expect(loginFailuresPerUsername.size()).toBe(100_000);
    expect(loginFailures.isLimited("203.0.113.7|newcomer")).toBe(false);
  });
});

describe("createGuest", () => {
  it("creates a guest with no username or password, expiring in 24 hours", async () => {
    const { deps, users } = createTestDeps();
    const result = await createGuest(deps, { ip: "203.0.113.7", pseudo: "  Zoé  ", locale: "en" });

    expect(result.ok).toBe(true);
    expect(users.users[0]).toEqual({
      id: "user-1",
      kind: "guest",
      username: null,
      passwordHash: null,
      displayName: "Zoé",
      locale: "en",
      expiresAt: new Date(deps.now().getTime() + 24 * HOUR),
    });
  });

  it("opens a 24 hour session cookie without Max-Age", async () => {
    const { deps, sessions } = createTestDeps();
    const result = await createGuest(deps, { ip: "203.0.113.7", pseudo: "Zoé", locale: "fr" });

    if (!result.ok) throw new Error("expected success");
    expect(result.grant.maxAgeSeconds).toBeUndefined();
    expect(result.grant.expiresAt).toEqual(new Date(deps.now().getTime() + 24 * HOUR));
    expect(sessions.sessions.get(hashToken(result.grant.token))?.expiresAt).toEqual(result.grant.expiresAt);
  });

  it("answers INVALID_PSEUDO with its field and creates nothing", async () => {
    const { deps, users } = createTestDeps();

    expect(await createGuest(deps, { ip: "203.0.113.7", pseudo: "x", locale: "fr" })).toEqual({
      ok: false,
      error: { code: "INVALID_PSEUDO", field: "pseudo" },
    });
    expect(users.users).toHaveLength(0);
  });

  it("allows 120 guests per hour per IP", async () => {
    const { deps, advance } = createTestDeps();
    for (let i = 0; i < 120; i += 1) {
      expect(await createGuest(deps, { ip: "203.0.113.7", pseudo: `Guest ${i}`, locale: "fr" })).toMatchObject({
        ok: true,
      });
    }

    expect(await createGuest(deps, { ip: "203.0.113.7", pseudo: "Guest 120", locale: "fr" })).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
    expect(await createGuest(deps, { ip: "198.51.100.9", pseudo: "Guest", locale: "fr" })).toMatchObject({
      ok: true,
    });

    advance(HOUR);
    expect(await createGuest(deps, { ip: "203.0.113.7", pseudo: "Guest 121", locale: "fr" })).toMatchObject({
      ok: true,
    });
  });
});
