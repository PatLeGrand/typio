// Dépôts en mémoire pour les tests unitaires de l'authentification (aucune base requise).
import type { Locale } from "@/i18n/config";
import type { AuthDeps } from "./authFlows";
import { OAuthAccountTakenError, type NewOAuthMember, type OAuthAccountRef, type OAuthAccountRepository } from "./oauth/oauthRepository";
import type { PasswordHasher } from "./password";
import { resetPurgeThrottle } from "./purge";
import { createAuthLimiters } from "./rateLimit";
import type { NewSession, SessionRepository, SessionWithUser } from "./session";
import type { UserKind } from "./types";
import { UsernameTakenError, type MemberRecord, type UserRepository } from "./userRepository";

export interface StoredUser {
  id: string;
  kind: UserKind;
  username: string | null;
  displayName: string;
  passwordHash: string | null;
  locale: Locale;
  expiresAt: Date | null;
}

export class MemoryUserRepository implements UserRepository {
  readonly users: StoredUser[] = [];
  private counter = 0;

  async findMemberByUsername(username: string): Promise<MemberRecord | null> {
    const user = this.users.find(
      (candidate) => candidate.kind === "member" && candidate.username?.toLowerCase() === username,
    );
    if (!user || user.passwordHash === null) return null;
    return { id: user.id, passwordHash: user.passwordHash };
  }

  async memberUsernameExists(username: string): Promise<boolean> {
    return this.users.some((user) => user.kind === "member" && user.username?.toLowerCase() === username);
  }

  async createMember(params: {
    username: string;
    displayName: string;
    passwordHash: string | null;
    locale: Locale;
  }): Promise<{ id: string }> {
    if (this.users.some((user) => user.username?.toLowerCase() === params.username.toLowerCase())) {
      throw new UsernameTakenError();
    }
    const id = `user-${(this.counter += 1)}`;
    this.users.push({ id, kind: "member", expiresAt: null, ...params });
    return { id };
  }

  async createGuest(params: {
    displayName: string;
    locale: Locale;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    const id = `user-${(this.counter += 1)}`;
    this.users.push({ id, kind: "guest", username: null, passwordHash: null, ...params });
    return { id };
  }

  async deleteGuest(id: string): Promise<void> {
    const index = this.users.findIndex((user) => user.id === id && user.kind === "guest");
    if (index === -1) return;
    this.users.splice(index, 1);
    // Comme la cascade SQL : les sessions de l'invité disparaissent avec lui.
    this.onUserDeleted?.(id);
  }

  /** Branché par `MemorySessionRepository` pour reproduire `on delete cascade`. */
  onUserDeleted?: (id: string) => void;

  async deleteExpiredGuests(now: Date, limit: number): Promise<number> {
    const expired = this.users
      .filter((user) => user.kind === "guest" && user.expiresAt !== null && user.expiresAt < now)
      .slice(0, limit);
    for (const user of expired) this.users.splice(this.users.indexOf(user), 1);
    return expired.length;
  }
}

/** Comptes GitHub et Discord reliés, en mémoire : reproduit la clé primaire et la création atomique. */
export class MemoryOAuthAccountRepository implements OAuthAccountRepository {
  readonly accounts: (OAuthAccountRef & { userId: string })[] = [];
  /** Test : fait échouer l'insertion du lien, pour vérifier qu'aucun membre ne reste. */
  failNextLink = false;

  constructor(private readonly users: MemoryUserRepository) {}

  private find({ provider, providerAccountId }: OAuthAccountRef) {
    return this.accounts.find((a) => a.provider === provider && a.providerAccountId === providerAccountId);
  }

  async findUserIdByAccount(account: OAuthAccountRef): Promise<string | null> {
    return this.find(account)?.userId ?? null;
  }

  async linkAccount(account: OAuthAccountRef & { userId: string }): Promise<boolean> {
    if (this.find(account)) return false;
    this.accounts.push({ ...account });
    return true;
  }

  async createMemberWithAccount(member: NewOAuthMember): Promise<{ id: string }> {
    // Même ordre que la transaction SQL : l'identifiant d'abord, puis le lien ; tout ou rien.
    const before = this.users.users.length;
    const { id } = await this.users.createMember({
      username: member.username,
      displayName: member.displayName,
      passwordHash: null,
      locale: member.locale,
    });
    if (this.find(member) || this.failNextLink) {
      this.failNextLink = false;
      this.users.users.length = before;
      throw new OAuthAccountTakenError();
    }
    this.accounts.push({ provider: member.provider, providerAccountId: member.providerAccountId, userId: id });
    return { id };
  }
}

export class MemorySessionRepository implements SessionRepository {
  readonly sessions = new Map<string, NewSession>();

  constructor(private readonly users: MemoryUserRepository) {
    users.onUserDeleted = (userId) => {
      for (const [id, session] of this.sessions) if (session.userId === userId) this.sessions.delete(id);
    };
  }

  async insert(session: NewSession): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async findWithUser(id: string): Promise<SessionWithUser | null> {
    const session = this.sessions.get(id);
    if (!session) return null;
    const user = this.users.users.find((candidate) => candidate.id === session.userId);
    if (!user) return null;
    return {
      session: { expiresAt: session.expiresAt },
      user: {
        id: user.id,
        kind: user.kind,
        displayName: user.displayName,
        username: user.username,
        locale: user.locale,
        expiresAt: user.expiresAt,
      },
    };
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async deleteExpired(now: Date, limit: number): Promise<number> {
    let deleted = 0;
    for (const [id, session] of this.sessions) {
      if (deleted >= limit) break;
      if (session.expiresAt.getTime() < now.getTime()) {
        this.sessions.delete(id);
        deleted += 1;
      }
    }
    return deleted;
  }
}

/** Hacheur factice rapide : les parcours se testent sans payer argon2, et les appels sont observables. */
function createFakePasswordHasher(): PasswordHasher & {
  verifyCalls: { hash: string; password: string }[];
} {
  const verifyCalls: { hash: string; password: string }[] = [];
  return {
    verifyCalls,
    async hash(password) {
      return `fake-hash:${password}`;
    },
    async verify(hash, password) {
      verifyCalls.push({ hash, password });
      return hash === `fake-hash:${password}`;
    },
  };
}

/** Dépendances en mémoire et horloge pilotable. Remet à zéro le délai de purge, global au processus. */
export function createTestDeps(start = new Date("2026-10-05T10:00:00.000Z")) {
  resetPurgeThrottle();
  let current = start.getTime();
  const users = new MemoryUserRepository();
  const sessions = new MemorySessionRepository(users);
  const oauthAccounts = new MemoryOAuthAccountRepository(users);
  const passwords = createFakePasswordHasher();
  const limiters = createAuthLimiters(() => current);
  const deps: AuthDeps = { users, oauthAccounts, sessions, limiters, passwords, now: () => new Date(current) };
  return {
    deps,
    users,
    oauthAccounts,
    sessions,
    passwords,
    advance(ms: number) {
      current += ms;
    },
  };
}
