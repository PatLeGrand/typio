import { eq, inArray, lt } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { defaultLocale, isLocale } from "@/i18n/config";
import { sessions, users } from "@/db/schema";
import type { NewSession, SessionRepository, SessionWithUser } from "./session";

/**
 * Implémentation Drizzle de `SessionRepository` sur la table `sessions`. Sans `server-only` :
 * le service temps réel (ADR-001), lancé hors de Next, l'importe aussi. Côté Next, passer par
 * `sessionRepository.ts`.
 */
export function createDrizzleSessionRepository(db: PostgresJsDatabase): SessionRepository {
  return {
    async insert(session: NewSession) {
      await db.insert(sessions).values(session);
    },

    async findWithUser(id: string): Promise<SessionWithUser | null> {
      const [row] = await db
        .select({
          sessionExpiresAt: sessions.expiresAt,
          userId: users.id,
          kind: users.kind,
          displayName: users.displayName,
          username: users.username,
          locale: users.locale,
          userExpiresAt: users.expiresAt,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.id, id))
        .limit(1);
      if (!row) return null;
      // Le CHECK de la base l'interdit : un `kind` inattendu est une anomalie, pas un membre.
      if (row.kind !== "member" && row.kind !== "guest") return null;

      return {
        session: { expiresAt: row.sessionExpiresAt },
        user: {
          id: row.userId,
          kind: row.kind,
          displayName: row.displayName,
          username: row.username,
          locale: isLocale(row.locale) ? row.locale : defaultLocale,
          expiresAt: row.userExpiresAt,
        },
      };
    },

    async delete(id: string) {
      await db.delete(sessions).where(eq(sessions.id, id));
    },

    async deleteExpired(now: Date, limit: number) {
      const result = await db.delete(sessions).where(
        inArray(
          sessions.id,
          db.select({ id: sessions.id }).from(sessions).where(lt(sessions.expiresAt, now)).limit(limit),
        ),
      );
      return result.count;
    },
  };
}
