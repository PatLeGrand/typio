"use server";

import { getCurrentUser } from "@/auth/currentUser";
import { getDb } from "@/db/shared";
import { createDrizzleProfileStatsRepository } from "@/race/drizzleProfileStatsRepository";

type Stats = {
  raceCount: number;
  wins: number;
  bestWpm: number | null;
  averageWpm: number | null;
  averageAccuracy: number | null;
};

export async function getProfileSummary(): Promise<{ ok: true; stats: Stats } | { ok: false }> {
  try {
    const user = await getCurrentUser();
    if (!user || user.kind !== "member") return { ok: false };

    const stats = await createDrizzleProfileStatsRepository(getDb()).getUserStats(user.id);
    return { ok: true, stats };
  } catch {
    return { ok: false };
  }
}
