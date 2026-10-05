// @vitest-environment node
import { describe, expect, it } from "vitest";
import { REMEMBERED_SESSION_MS } from "../session";
import { createTestDeps } from "../testSupport";
import { hashToken } from "../token";
import type { CurrentUser } from "../types";
import { UsernameTakenError } from "../userRepository";
import { OAuthAccountTakenError } from "./oauthRepository";
import { completeOAuthSignIn, UsernameExhaustedError, type OAuthSignInResult } from "./signIn";
import { profile } from "./testSupport";

function currentUser(id: string, kind: CurrentUser["kind"] = "member"): CurrentUser {
  return { id, kind, displayName: "Someone", username: kind === "member" ? "someone" : null, locale: "fr" };
}

function signedIn(result: OAuthSignInResult) {
  if (result.status !== "signed-in") throw new Error(`expected signed-in, got ${result.status}`);
  return result.grant;
}

describe("completeOAuthSignIn: creating a member", () => {
  it("creates a member without a password, linked to the account, and opens a 30-day session", async () => {
    const { deps, users, oauthAccounts, sessions } = createTestDeps();

    const grant = signedIn(
      await completeOAuthSignIn(deps, {
        provider: "github",
        profile: profile(),
        currentUser: null,
        locale: "en",
      }),
    );

    expect(users.users).toHaveLength(1);
    expect(users.users[0]).toMatchObject({
      kind: "member",
      username: "octocat",
      displayName: "The Octocat",
      passwordHash: null,
      locale: "en",
      expiresAt: null,
    });
    expect(oauthAccounts.accounts).toEqual([
      { provider: "github", providerAccountId: "583231", userId: users.users[0].id },
    ]);
    expect(sessions.sessions.get(hashToken(grant.token))?.userId).toBe(users.users[0].id);
    expect(grant.maxAgeSeconds).toBe(REMEMBERED_SESSION_MS / 1000);
    expect(grant.expiresAt.getTime() - deps.now().getTime()).toBe(REMEMBERED_SESSION_MS);
  });

  it("stores nothing but the provider and the numeric id: no login, name or token anywhere", async () => {
    const { deps, users, oauthAccounts } = createTestDeps();

    await completeOAuthSignIn(deps, {
      provider: "discord",
      profile: profile({ accountId: "80351110224678912", login: "UniqueLoginString", displayName: "Unique Name" }),
      currentUser: null,
      locale: "fr",
    });

    expect(Object.keys(oauthAccounts.accounts[0]).sort()).toEqual(["provider", "providerAccountId", "userId"]);
    const stored = JSON.stringify([users.users, oauthAccounts.accounts]);
    expect(stored).not.toContain("access-token");
    // Le login n'apparaît que dans l'identifiant dérivé, le nom que dans le nom d'affichage.
    expect(users.users[0].username).toBe("uniqueloginstrin");
  });

  it("derives the username from the login: lowercase, [a-z0-9_] only, 16 characters at most", async () => {
    const { deps, users } = createTestDeps();

    await completeOAuthSignIn(deps, {
      provider: "github",
      profile: profile({ login: "Jean-Pierre.Dupont-Martin", displayName: null }),
      currentUser: null,
      locale: "fr",
    });

    expect(users.users[0].username).toBe("jean_pierre_dupo");
    expect(users.users[0].displayName).toBe("jean_pierre_dupo");
  });

  it("falls back to « joueur » when the login leaves fewer than 3 usable characters", async () => {
    const { deps, users } = createTestDeps();

    await completeOAuthSignIn(deps, {
      provider: "discord",
      profile: profile({ login: "日本", displayName: null }),
      currentUser: null,
      locale: "fr",
    });

    expect(users.users[0].username).toBe("joueur");
  });

  it("adds _ and three digits when the username is taken, without case sensitivity", async () => {
    const { deps, users } = createTestDeps();
    await deps.users.createMember({ username: "Octocat", displayName: "x", passwordHash: "h", locale: "fr" });

    await completeOAuthSignIn(deps, {
      provider: "github",
      profile: profile(),
      currentUser: null,
      locale: "fr",
      randomThreeDigits: () => "042",
    });

    expect(users.users.map((user) => user.username)).toEqual(["Octocat", "octocat_042"]);
  });

  it("retries with a new suffix on each collision, 5 attempts in all", async () => {
    const { deps, users } = createTestDeps();
    for (const username of ["octocat", "octocat_001", "octocat_002"]) {
      await deps.users.createMember({ username, displayName: "x", passwordHash: "h", locale: "fr" });
    }
    const suffixes = ["001", "002", "003"];

    await completeOAuthSignIn(deps, {
      provider: "github",
      profile: profile(),
      currentUser: null,
      locale: "fr",
      randomThreeDigits: () => suffixes.shift() ?? "999",
    });

    expect(users.users.at(-1)?.username).toBe("octocat_003");
  });

  it("fails cleanly after 5 collisions: no user, no link, no session", async () => {
    const { deps, users, oauthAccounts, sessions } = createTestDeps();
    await deps.users.createMember({ username: "octocat", displayName: "x", passwordHash: "h", locale: "fr" });
    await deps.users.createMember({ username: "octocat_777", displayName: "x", passwordHash: "h", locale: "fr" });

    await expect(
      completeOAuthSignIn(deps, {
        provider: "github",
        profile: profile(),
        currentUser: null,
        locale: "fr",
        randomThreeDigits: () => "777",
      }),
    ).rejects.toBeInstanceOf(UsernameExhaustedError);

    expect(users.users).toHaveLength(2);
    expect(oauthAccounts.accounts).toHaveLength(0);
    expect(sessions.sessions.size).toBe(0);
  });

  it("does not swallow other errors from the repository", async () => {
    const { deps } = createTestDeps();
    deps.oauthAccounts.createMemberWithAccount = async () => {
      throw new Error("db down");
    };

    await expect(
      completeOAuthSignIn(deps, { provider: "github", profile: profile(), currentUser: null, locale: "fr" }),
    ).rejects.toThrow("db down");
  });

  it("leaves no orphan user when the link insertion fails", async () => {
    const { deps, users, oauthAccounts } = createTestDeps();
    oauthAccounts.failNextLink = true;

    await expect(
      completeOAuthSignIn(deps, { provider: "github", profile: profile(), currentUser: null, locale: "fr" }),
    ).rejects.toBeInstanceOf(OAuthAccountTakenError);

    expect(users.users).toHaveLength(0);
  });

  it("signs in to the winner when a concurrent callback already created the same account", async () => {
    const { deps, users, oauthAccounts } = createTestDeps();
    const winner = await deps.users.createMember({ username: "winner", displayName: "w", passwordHash: "h", locale: "fr" });
    // L'autre requête lie le compte juste après notre lecture : la création lève OAuthAccountTakenError.
    const original = oauthAccounts.findUserIdByAccount.bind(oauthAccounts);
    let reads = 0;
    oauthAccounts.findUserIdByAccount = async (account) => {
      reads += 1;
      if (reads === 1) return null;
      await oauthAccounts.linkAccount({ ...account, userId: winner.id });
      return original(account);
    };
    oauthAccounts.failNextLink = true;

    const grant = signedIn(
      await completeOAuthSignIn(deps, { provider: "github", profile: profile(), currentUser: null, locale: "fr" }),
    );

    expect(grant.token).toBeTruthy();
    expect(users.users.map((user) => user.username)).toEqual(["winner"]);
  });

  it("creates a member for a guest, without touching the guest (the caller revokes its session)", async () => {
    const { deps, users } = createTestDeps();
    const guest = await deps.users.createGuest({ displayName: "Visitor", locale: "fr", expiresAt: new Date(Date.now() + 1e6) });

    const result = await completeOAuthSignIn(deps, {
      provider: "github",
      profile: profile(),
      currentUser: currentUser(guest.id, "guest"),
      locale: "fr",
    });

    expect(result.status).toBe("signed-in");
    expect(users.users.map((user) => user.kind)).toEqual(["guest", "member"]);
  });
});

describe("completeOAuthSignIn: existing account", () => {
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

    const grant = signedIn(
      await completeOAuthSignIn(deps, {
        provider: "github",
        profile: profile({ login: "renamed-login", displayName: "Renamed" }),
        currentUser: null,
        locale: "en",
      }),
    );

    expect(sessions.sessions.get(hashToken(grant.token))?.userId).toBe(memberId);
    expect(users.users).toHaveLength(1);
    expect(oauthAccounts.accounts).toHaveLength(1);
    // Le profil du fournisseur n'écrase rien : ni identifiant, ni nom, ni langue.
    expect(users.users[0]).toMatchObject({ username: "octocat", displayName: "Octo", locale: "fr" });
  });

  it("matches on (provider, id): the same id on the other provider is another account", async () => {
    const { deps, users } = await withLinkedMember();

    await completeOAuthSignIn(deps, {
      provider: "discord",
      profile: profile({ login: "other" }),
      currentUser: null,
      locale: "fr",
    });

    expect(users.users).toHaveLength(2);
  });

  it("opens a new session when the same member is already signed in", async () => {
    const { deps, memberId } = await withLinkedMember();

    const result = await completeOAuthSignIn(deps, {
      provider: "github",
      profile: profile(),
      currentUser: currentUser(memberId),
      locale: "fr",
    });

    expect(result.status).toBe("signed-in");
  });

  it("refuses without changing anything when ANOTHER member is signed in", async () => {
    const { deps, users, oauthAccounts, sessions } = await withLinkedMember();
    const other = await deps.users.createMember({ username: "other", displayName: "o", passwordHash: "h", locale: "fr" });

    const result = await completeOAuthSignIn(deps, {
      provider: "github",
      profile: profile(),
      currentUser: currentUser(other.id),
      locale: "fr",
    });

    expect(result).toEqual({ status: "already-linked" });
    expect(oauthAccounts.accounts).toHaveLength(1);
    expect(oauthAccounts.accounts[0].userId).not.toBe(other.id);
    expect(users.users).toHaveLength(2);
    expect(sessions.sessions.size).toBe(0);
  });

  it("signs a guest into the linked member's account", async () => {
    const { deps, memberId, sessions } = await withLinkedMember();
    const guest = await deps.users.createGuest({ displayName: "G", locale: "fr", expiresAt: new Date(Date.now() + 1e6) });

    const grant = signedIn(
      await completeOAuthSignIn(deps, {
        provider: "github",
        profile: profile(),
        currentUser: currentUser(guest.id, "guest"),
        locale: "fr",
      }),
    );

    expect(sessions.sessions.get(hashToken(grant.token))?.userId).toBe(memberId);
  });
});

describe("completeOAuthSignIn: linking to the signed-in member", () => {
  it("links a free account to the current member, creates no user and no session", async () => {
    const { deps, users, oauthAccounts, sessions } = createTestDeps();
    const member = await deps.users.createMember({ username: "alice", displayName: "Alice", passwordHash: "h", locale: "fr" });

    const result = await completeOAuthSignIn(deps, {
      provider: "discord",
      profile: profile({ accountId: "9001" }),
      currentUser: currentUser(member.id),
      locale: "fr",
    });

    expect(result).toEqual({ status: "linked" });
    expect(oauthAccounts.accounts).toEqual([{ provider: "discord", providerAccountId: "9001", userId: member.id }]);
    expect(users.users).toHaveLength(1);
    expect(sessions.sessions.size).toBe(0);
  });

  it("lets the same member hold GitHub and Discord", async () => {
    const { deps, oauthAccounts } = createTestDeps();
    const member = await deps.users.createMember({ username: "alice", displayName: "Alice", passwordHash: "h", locale: "fr" });

    await completeOAuthSignIn(deps, { provider: "github", profile: profile({ accountId: "1" }), currentUser: currentUser(member.id), locale: "fr" });
    await completeOAuthSignIn(deps, { provider: "discord", profile: profile({ accountId: "2" }), currentUser: currentUser(member.id), locale: "fr" });

    expect(oauthAccounts.accounts.map((account) => account.provider)).toEqual(["github", "discord"]);
  });

  it("is idempotent when a concurrent request linked the account to the same member first", async () => {
    const { deps, oauthAccounts } = createTestDeps();
    const member = await deps.users.createMember({ username: "alice", displayName: "A", passwordHash: "h", locale: "fr" });
    const original = oauthAccounts.findUserIdByAccount.bind(oauthAccounts);
    let reads = 0;
    oauthAccounts.findUserIdByAccount = async (account) => {
      reads += 1;
      if (reads === 1) {
        await oauthAccounts.linkAccount({ ...account, userId: member.id });
        return null;
      }
      return original(account);
    };

    const result = await completeOAuthSignIn(deps, {
      provider: "github",
      profile: profile(),
      currentUser: currentUser(member.id),
      locale: "fr",
    });

    expect(result).toEqual({ status: "linked" });
  });

  it("refuses when a concurrent request linked the account to ANOTHER member first", async () => {
    const { deps, oauthAccounts } = createTestDeps();
    const member = await deps.users.createMember({ username: "alice", displayName: "A", passwordHash: "h", locale: "fr" });
    const other = await deps.users.createMember({ username: "bob", displayName: "B", passwordHash: "h", locale: "fr" });
    const original = oauthAccounts.findUserIdByAccount.bind(oauthAccounts);
    let reads = 0;
    oauthAccounts.findUserIdByAccount = async (account) => {
      reads += 1;
      if (reads === 1) {
        await oauthAccounts.linkAccount({ ...account, userId: other.id });
        return null;
      }
      return original(account);
    };

    const result = await completeOAuthSignIn(deps, {
      provider: "github",
      profile: profile(),
      currentUser: currentUser(member.id),
      locale: "fr",
    });

    expect(result).toEqual({ status: "already-linked" });
    expect(oauthAccounts.accounts).toHaveLength(1);
    expect(oauthAccounts.accounts[0].userId).toBe(other.id);
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
