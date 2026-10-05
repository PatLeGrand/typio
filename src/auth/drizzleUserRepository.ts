import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { users } from "@/db/schema";
import { postgresErrorCode, UNIQUE_VIOLATION } from "./errors";
import { UsernameTakenError, type MemberRecord, type UserRepository } from "./userRepository";

/** Implémentation Drizzle de `UserRepository` sur la table `users`. */
export function createDrizzleUserRepository(db: PostgresJsDatabase): UserRepository {
  return {
    async findMemberByUsername(username: string): Promise<MemberRecord | null> {
      const [row] = await db
        .select({ id: users.id, passwordHash: users.passwordHash })
        .from(users)
        // Même expression que l'index unique `lower(username)`, pour qu'il serve.
        .where(sql`${users.kind} = 'member' and lower(${users.username}) = ${username}`)
        .limit(1);
      if (!row || row.passwordHash === null) return null;
      return { id: row.id, passwordHash: row.passwordHash };
    },

    async memberUsernameExists(username: string): Promise<boolean> {
      const [row] = await db
        .select({ id: users.id })
        .from(users)
        // Même expression que l'index unique `lower(username)`, pour qu'il serve.
        .where(sql`${users.kind} = 'member' and lower(${users.username}) = ${username}`)
        .limit(1);
      return row !== undefined;
    },

    async createMember(params) {
      try {
        const [row] = await db
          .insert(users)
          .values({
            kind: "member",
            username: params.username,
            displayName: params.displayName,
            passwordHash: params.passwordHash,
            locale: params.locale,
          })
          .returning({ id: users.id });
        return { id: row.id };
      } catch (error) {
        if (postgresErrorCode(error) === UNIQUE_VIOLATION) throw new UsernameTakenError();
        throw error;
      }
    },

    async createGuest(params) {
      const [row] = await db
        .insert(users)
        .values({
          kind: "guest",
          displayName: params.displayName,
          locale: params.locale,
          expiresAt: params.expiresAt,
        })
        .returning({ id: users.id });
      return { id: row.id };
    },

    async deleteGuest(id: string) {
      // `kind = 'guest'` : un membre ne peut jamais être supprimé par ce chemin.
      await db.delete(users).where(and(eq(users.id, id), eq(users.kind, "guest")));
    },

    async deleteExpiredGuests(now: Date, limit: number) {
      // Même prédicat que l'index partiel `users_guest_expires_at_idx`.
      const result = await db.delete(users).where(
        inArray(
          users.id,
          db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.kind, "guest"), lt(users.expiresAt, now)))
            .limit(limit),
        ),
      );
      return result.count;
    },
  };
}
