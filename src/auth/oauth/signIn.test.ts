// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SHORT_SESSION_MS } from "../session";
import { createTestDeps } from "../testSupport";
import { hashToken } from "../token";
import { UsernameTakenError } from "../userRepository";
import { OAuthAccountTakenError } from "./oauthRepository";
import { completeOAuthSignIn, UsernameExhaustedError } from "./signIn";
import { profile } from "./testSupport";

const input = (overrides: Partial<Parameters<typeof completeOAuthSignIn>[1]> = {}) => ({
  provider: "github" as const,
  profile: profile(),
  locale: "fr" as const,
  ...overrides,
});

describe("completeOAuthSignIn: creating a member", () => {
  it("creates a member without a password, linked to the account", async () => {
    const { deps, users, oauthAccounts, sessions } = createTestDeps();

    const grant = await completeOAuthSignIn(deps, input({ locale: "en" }));

    expect(users.users).toHaveLength(1);
    expect(users.users[0]).toMatchObject({
      kind: "member",
      username: "octocat",
      passwordHash: null,
      locale: "en",
      expiresAt: null,
    });
    expect(oauthAccounts.accounts).toEqual([
      { provider: "github", providerAccountId: "583231", userId: users.users[0].id },
    ]);
    expect(sessions.sessions.get(hashToken(grant.token))?.userId).toBe(users.users[0].id);
  });

  it("opens the same session as a login without « stay signed in »: 24 hours, session cookie", async () => {
    const { deps } = createTestDeps();

    const grant = await completeOAuthSignIn(deps, input());

    expect(grant.maxAgeSeconds).toBeUndefined();
    expect(grant.expiresAt.getTime() - deps.now().getTime()).toBe(SHORT_SESSION_MS);
  });

  it("derives the username from the login, and the display name from the username", async () => {
    const { deps, users } = createTestDeps();

    await completeOAuthSignIn(deps, input({ profile: profile({ login: "Jean-Pierre.Dupont-Martin" }) }));

    expect(users.users[0].username).toBe("jean_pierre_dupo");
    expect(users.users[0].displayName).toBe("jean_pierre_dupo");
  });

  it("stores nothing but the provider and the numeric id: no login, name or token", async () => {
    const { deps, oauthAccounts } = createTestDeps();

    await completeOAuthSignIn(
      deps,
      input({ provider: "discord", profile: profile({ accountId: "80351110224678912", login: "UniqueLoginString" }) }),
    );

    expect(Object.keys(oauthAccounts.accounts[0]).sort()).toEqual(["provider", "providerAccountId", "userId"]);
    expect(JSON.stringify(oauthAccounts.accounts)).not.toMatch(/UniqueLogin|uniquelogin/i);
  });

  it("falls back to « joueur » when the login leaves fewer than 3 usable characters", async () => {
    const { deps, users } = createTestDeps();

    await completeOAuthSignIn(deps, input({ provider: "discord", profile: profile({ login: "日本" }) }));

    expect(users.users[0].username).toBe("joueur");
    expect(users.users[0].displayName).toBe("joueur");
  });

  it("adds _ and three digits when the username is taken, without case sensitivity, keeping them in the display name", async () => {
    const { deps, users } = createTestDeps();
    await deps.users.createMember({ username: "Octocat", displayName: "x", passwordHash: "h", locale: "fr" });

    await completeOAuthSignIn(deps, input({ randomThreeDigits: () => "042" }));

    expect(users.users.map((user) => user.username)).toEqual(["Octocat", "octocat_042"]);
    expect(users.users[1].displayName).toBe("octocat_042");
  });

  it("retries with a new suffix on each collision, 5 attempts in all", async () => {
    const { deps, users } = createTestDeps();
    for (const username of ["octocat", "octocat_001", "octocat_002"]) {
      await deps.users.createMember({ username, displayName: "x", passwordHash: "h", locale: "fr" });
    }
    const suffixes = ["001", "002", "003"];

    await completeOAuthSignIn(deps, input({ randomThreeDigits: () => suffixes.shift() ?? "999" }));

    expect(users.users.at(-1)?.username).toBe("octocat_003");
  });

  it("fails cleanly after 5 collisions: no user, no link, no session", async () => {
    const { deps, users, oauthAccounts, sessions } = createTestDeps();
    await deps.users.createMember({ username: "octocat", displayName: "x", passwordHash: "h", locale: "fr" });
    await deps.users.createMember({ username: "octocat_777", displayName: "x", passwordHash: "h", locale: "fr" });

    await expect(completeOAuthSignIn(deps, input({ randomThreeDigits: () => "777" }))).rejects.toBeInstanceOf(
      UsernameExhaustedError,
    );

    expect(users.users).toHaveLength(2);
    expect(oauthAccounts.accounts).toHaveLength(0);
    expect(sessions.sessions.size).toBe(0);
  });

  it("does not swallow other errors from the repository", async () => {
    const { deps } = createTestDeps();
    deps.oauthAccounts.createMemberWithAccount = async () => {
      throw new Error("db down");
    };

    await expect(completeOAuthSignIn(deps, input())).rejects.toThrow("db down");
  });

  it("leaves no orphan user when the link insertion fails", async () => {
    const { deps, users, oauthAccounts } = createTestDeps();
    oauthAccounts.failNextLink = true;

    await expect(completeOAuthSignIn(deps, input())).rejects.toBeInstanceOf(OAuthAccountTakenError);

    expect(users.users).toHaveLength(0);
  });

  it("signs in to the winner when a concurrent callback already created the same account", async () => {
    const { deps, users, oauthAccounts, sessions } = createTestDeps();
    const winner = await deps.users.createMember({ username: "winner", displayName: "w", passwordHash: "h", locale: "fr" });
    const original = oauthAccounts.findUserIdByAccount.bind(oauthAccounts);
    let reads = 0;
    oauthAccounts.findUserIdByAccount = async (account) => {
      reads += 1;
      if (reads === 1) return null;
      oauthAccounts.accounts.push({ ...account, userId: winner.id });
      return original(account);
    };
    oauthAccounts.failNextLink = true;

    const grant = await completeOAuthSignIn(deps, input());

    expect(sessions.sessions.get(hashToken(grant.token))?.userId).toBe(winner.id);
    expect(users.users.map((user) => user.username)).toEqual(["winner"]);
  });
});

describe("completeOAuthSignIn: account already linked", () => {
  async function withLinkedMember() {
    const test = createTestDeps();
    const { id } = await test.oauthAccounts.createMemberWithAccount({
      provider: "github",
      providerAccountId: "583231",
      username: "octocat",
      displayName: "Octo",
      locale: "fr",
    });
    return { ...test, memberId: id };
  }

  it("opens a session for the linked member and creates nothing", async () => {
    const { deps, users, oauthAccounts, sessions, memberId } = await withLinkedMember();

    const grant = await completeOAuthSignIn(deps, input({ profile: profile({ login: "renamed-login" }), locale: "en" }));

    expect(sessions.sessions.get(hashToken(grant.token))?.userId).toBe(memberId);
    expect(users.users).toHaveLength(1);
    expect(oauthAccounts.accounts).toHaveLength(1);
    // Le profil du fournisseur n'écrase rien : ni identifiant, ni nom, ni langue.
    expect(users.users[0]).toMatchObject({ username: "octocat", displayName: "Octo", locale: "fr" });
  });

  it("opens a 24-hour session on that member too", async () => {
    const { deps } = await withLinkedMember();

    const grant = await completeOAuthSignIn(deps, input());

    expect(grant.maxAgeSeconds).toBeUndefined();
    expect(grant.expiresAt.getTime() - deps.now().getTime()).toBe(SHORT_SESSION_MS);
  });

  it("matches on (provider, id): the same id on the other provider is another account", async () => {
    const { deps, users } = await withLinkedMember();

    await completeOAuthSignIn(deps, input({ provider: "discord", profile: profile({ login: "other" }) }));

    expect(users.users).toHaveLength(2);
  });
});

describe("no path links a provider account to an existing member", () => {
  it("never writes to an existing member: a sign-in either finds the owner or creates a NEW member", async () => {
    const { deps, users, oauthAccounts } = createTestDeps();
    const alice = await deps.users.createMember({ username: "alice", displayName: "Alice", passwordHash: "h", locale: "fr" });

    await completeOAuthSignIn(deps, input({ profile: profile({ accountId: "1", login: "alice" }) }));

    expect(oauthAccounts.accounts.some((account) => account.userId === alice.id)).toBe(false);
    expect(users.users).toHaveLength(2);
    expect(users.users[0]).toMatchObject({ id: alice.id, username: "alice", passwordHash: "h" });
  });

  it("the sign-in API takes no current user, and the repository has no link operation", () => {
    const { oauthAccounts } = createTestDeps();

    expect("linkAccount" in oauthAccounts).toBe(false);
    expect(Object.keys(input())).not.toContain("currentUser");
  });
});

describe("memory OAuth repository (test double)", () => {
  it("throws UsernameTakenError for a taken username, like the SQL unique index", async () => {
    const { deps } = createTestDeps();
    await deps.users.createMember({ username: "x_y", displayName: "x", passwordHash: "h", locale: "fr" });
    await expect(
      deps.oauthAccounts.createMemberWithAccount({
        provider: "github",
        providerAccountId: "1",
        username: "X_Y",
        displayName: "x",
        locale: "fr",
      }),
    ).rejects.toBeInstanceOf(UsernameTakenError);
  });
});
