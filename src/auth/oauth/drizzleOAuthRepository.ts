import "server-only";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { oauthAccounts, users } from "@/db/schema";
import { postgresErrorCode, UNIQUE_VIOLATION } from "../errors";
import { UsernameTakenError } from "../userRepository";
import { OAuthAccountTakenError, type OAuthAccountRepository } from "./oauthRepository";

/** Implémentation Drizzle de `OAuthAccountRepository` sur la table `oauth_accounts`. */
export function createDrizzleOAuthRepository(db: PostgresJsDatabase): OAuthAccountRepository {
  return {
    async findUserIdByAccount({ provider, providerAccountId }) {
      const [row] = await db
        .select({ userId: oauthAccounts.userId })
        .from(oauthAccounts)
        .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, providerAccountId)))
        .limit(1);
      return row?.userId ?? null;
    },

    async linkAccount({ provider, providerAccountId, userId }) {
      const inserted = await db
        .insert(oauthAccounts)
        .values({ provider, providerAccountId, userId })
        .onConflictDoNothing()
        .returning({ userId: oauthAccounts.userId });
      return inserted.length > 0;
    },

    async createMemberWithAccount(member) {
      // Les deux insertions réussissent ensemble ou échouent ensemble : jamais de membre
      // sans lien. Une erreur levée dans le rappel annule la transaction.
      return db.transaction(async (tx) => {
        let id: string;
        try {
          const [row] = await tx
            .insert(users)
            .values({
              kind: "member",
              username: member.username,
              displayName: member.displayName,
              passwordHash: null,
              locale: member.locale,
            })
            .returning({ id: users.id });
          id = row.id;
        } catch (error) {
          if (postgresErrorCode(error) === UNIQUE_VIOLATION) throw new UsernameTakenError();
          throw error;
        }

        try {
          await tx
            .insert(oauthAccounts)
            .values({ provider: member.provider, providerAccountId: member.providerAccountId, userId: id });
        } catch (error) {
          if (postgresErrorCode(error) === UNIQUE_VIOLATION) throw new OAuthAccountTakenError();
          throw error;
        }
        return { id };
      });
    },
  };
}
