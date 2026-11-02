import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "../../src/auth/password";
import { races, raceResults, textPassages, users } from "../../src/db/schema";
import { DEFAULT_ROOM_CONFIG } from "../../src/realtime/protocol";
import { SENTENCES_FR } from "./sentences.fr";
import { SENTENCES_EN } from "./sentences.en";

// Identifiants publics : ces comptes sont réservés à la démonstration.
export const DEMO_USERNAME = "demo";
export const DEMO_PASSWORD = "TypioDemo2026!";
export const SEED_USER_IDS = [1, 2, 3].map((id) => `de000000-0000-4000-8000-${String(id).padStart(12, "0")}`);
export const SEED_RACE_IDS = [1, 2, 3].map((id) => `de000001-0000-4000-8000-${String(id).padStart(12, "0")}`);

export async function seedDatabase(db: PostgresJsDatabase): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await db.transaction(async (tx) => {
    // Deux déploiements simultanés ne doivent pas créer un historique partiel.
    await tx.execute(sql`select pg_advisory_xact_lock(73491204)`);
    for (const language of ["fr", "en"] as const) {
      const sentences = language === "fr" ? SENTENCES_FR : SENTENCES_EN;
      await tx.insert(textPassages).values(sentences.map((content) => ({ language, content }))).onConflictDoNothing();
    }
    for (const [index, id] of SEED_USER_IDS.entries()) {
      await tx.insert(users).values({
        id, kind: "member", isDemo: true,
        username: index === 0 ? DEMO_USERNAME : `demo${index + 1}`,
        displayName: index === 0 ? "Demo" : `Demo ${index + 1}`,
        passwordHash, locale: "fr",
      }).onConflictDoNothing({ target: users.id });
    }
    for (const [index, id] of SEED_RACE_IDS.entries()) {
      const startedAt = new Date(Date.UTC(2026, 0, index + 1, 12));
      const text = SENTENCES_FR[index];
      const durationMs = 30_000;
      const [saved] = await tx.insert(races).values({
        id, roomCode: "DEMO01", hostId: SEED_USER_IDS[0], config: { ...DEFAULT_ROOM_CONFIG, bots: [] },
        text, participantCount: 3, startedAt, endedAt: new Date(startedAt.getTime() + durationMs),
      }).onConflictDoNothing({ target: races.id }).returning({ id: races.id });
      if (!saved) continue;
      for (const [participant, userId] of SEED_USER_IDS.entries()) {
        const elapsed = durationMs - 6000 + participant * 3000 - index * 1000;
        const wpm = (text.length / 5) / (elapsed / 60_000);
        const [previous] = await tx.select({ wpm: sql<number | null>`max(${raceResults.wpm})` })
          .from(raceResults).where(eq(raceResults.userId, userId));
        await tx.insert(raceResults).values({
          raceId: id, userId, rank: participant + 1, status: "finished", wpm,
          grossWpm: wpm, accuracy: 100, errors: 0, durationMs: elapsed, progress: 1,
          personalBest: previous.wpm !== null && wpm > previous.wpm,
          wpmSeries: [0, wpm, wpm], missedKeys: {}, createdAt: new Date(startedAt.getTime() + elapsed),
        });
      }
    }
  });
}
