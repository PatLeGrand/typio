import type { RoomConfig, TextComplexity, TextLanguage, TextMode } from "@/realtime/protocol";

/** Plafond de courses détaillées chargées pour la passe serveur (heatmap, séries, répartitions). */
export const MAX_DETAILED_RACES = 500;
export const WPM_HISTORY_LIMIT = 50;
export const RECENT_RACES_LIMIT = 8;

export type RaceStatus = "finished" | "unfinished" | "abandoned";

export type PersonalRaceRow = {
  id: string;
  raceId: string;
  rank: number;
  status: RaceStatus;
  wpm: number;
  grossWpm: number;
  accuracy: number;
  errors: number;
  durationMs: number;
  personalBest: boolean;
  missedKeys: Record<string, number>;
  createdAt: Date;
  endedAt: Date;
  participantCount: number;
  config: Partial<RoomConfig> | null;
};

export type PersonalStatsTotals = {
  raceCount: number;
  finishedCount: number;
  unfinishedCount: number;
  abandonedCount: number;
  wins: number;
  podiums: number;
  multiplayerRaces: number;
  bestWpm: number | null;
  averageWpm: number | null;
  averageGrossWpm: number | null;
  averageAccuracy: number | null;
  totalDurationMs: number;
  totalErrors: number;
};

export type BestRaceSummary = {
  raceId: string;
  wpm: number;
  grossWpm: number;
  accuracy: number;
  endedAt: Date;
};

export type WpmHistoryPoint = {
  id: string;
  raceId: string;
  wpm: number;
  grossWpm: number;
  accuracy: number;
  personalBest: boolean;
  endedAt: Date;
  textMode: TextMode;
  language: TextLanguage;
  rollingAvg5: number;
};

export type TrendSummary = {
  recentAvg: number;
  previousAvg: number;
  delta: number;
  direction: "up" | "down" | "flat";
};

export type ConsistencyLevel = "steady" | "regular" | "variable";

export type ConsistencySummary = {
  stdDev: number;
  coefficientOfVariation: number;
  level: ConsistencyLevel;
};

export type StreakSummary = {
  currentWinStreak: number;
  bestWinStreak: number;
  currentFinishStreak: number;
  bestFinishStreak: number;
};

export type BreakdownBucket<K extends string> = {
  key: K;
  raceCount: number;
  eligibleCount: number;
  averageWpm: number | null;
  averageAccuracy: number | null;
  bestWpm: number | null;
};

export type RecentRaceItem = {
  raceId: string;
  endedAt: Date;
  rank: number;
  participantCount: number;
  wpm: number;
  grossWpm: number;
  accuracy: number;
  durationMs: number;
  status: RaceStatus;
  personalBest: boolean;
  textMode: TextMode;
  language: TextLanguage;
};

export type PersonalStatsReport = {
  totals: PersonalStatsTotals;
  bestRace: BestRaceSummary | null;
  wpmHistory: WpmHistoryPoint[];
  trend: TrendSummary | null;
  consistency: ConsistencySummary | null;
  errorCostWpm: number | null;
  streaks: StreakSummary;
  cumulativeMissedKeys: Record<string, number>;
  totalMissedKeyCount: number;
  breakdowns: {
    byTextMode: BreakdownBucket<TextMode>[];
    byLanguage: BreakdownBucket<TextLanguage>[];
    byComplexity: BreakdownBucket<TextComplexity>[];
    byFormat: BreakdownBucket<"solo" | "multiplayer">[];
  };
  recentRaces: RecentRaceItem[];
  isCapped: boolean;
};

type MutableBucket = {
  raceCount: number;
  eligibleCount: number;
  wpmSum: number;
  accuracySum: number;
  bestWpm: number | null;
};

function createBucket(): MutableBucket {
  return { raceCount: 0, eligibleCount: 0, wpmSum: 0, accuracySum: 0, bestWpm: null };
}

function addToBucket(bucket: MutableBucket, row: PersonalRaceRow) {
  bucket.raceCount += 1;
  if (row.status !== "abandoned") {
    bucket.eligibleCount += 1;
    bucket.wpmSum += row.wpm;
    bucket.accuracySum += row.accuracy;
    if (bucket.bestWpm === null || row.wpm > bucket.bestWpm) {
      bucket.bestWpm = row.wpm;
    }
  }
}

function finalizeBuckets<K extends string>(keys: readonly K[], map: Record<K, MutableBucket>): BreakdownBucket<K>[] {
  return keys.map((key) => {
    const bucket = map[key];
    return {
      key,
      raceCount: bucket.raceCount,
      eligibleCount: bucket.eligibleCount,
      averageWpm: bucket.eligibleCount > 0 ? bucket.wpmSum / bucket.eligibleCount : null,
      averageAccuracy: bucket.eligibleCount > 0 ? bucket.accuracySum / bucket.eligibleCount : null,
      bestWpm: bucket.bestWpm,
    };
  });
}

function isWin(row: PersonalRaceRow): boolean {
  return row.rank === 1 && row.status === "finished" && row.participantCount >= 2;
}

function isPodium(row: PersonalRaceRow): boolean {
  return row.rank <= 3 && row.status === "finished" && row.participantCount >= 2;
}

function readTextMode(config: Partial<RoomConfig> | null): TextMode {
  return config?.textMode === "words" ? "words" : "sentences";
}

function readLanguage(config: Partial<RoomConfig> | null): TextLanguage {
  return config?.language === "en" ? "en" : "fr";
}

function readComplexity(config: Partial<RoomConfig> | null): TextComplexity {
  if (config?.complexity === "easy" || config?.complexity === "hard") return config.complexity;
  return "medium";
}

/**
 * Agrège en une passe bornée les courses d'un membre (les plus récentes en premier).
 * Applique strictement H-26 : les abandons comptent dans le nombre de courses mais
 * sont exclus du meilleur MPM, des moyennes, du graphique, de la tendance et de la régularité.
 */
export function aggregatePersonalStats(
  rowsNewestFirst: readonly PersonalRaceRow[],
  sqlTotals?: PersonalStatsTotals,
): PersonalStatsReport {
  let finishedCount = 0;
  let unfinishedCount = 0;
  let abandonedCount = 0;
  let wins = 0;
  let podiums = 0;
  let multiplayerRaces = 0;
  let eligibleCount = 0;
  let wpmSum = 0;
  let grossWpmSum = 0;
  let accuracySum = 0;
  let totalDurationMs = 0;
  let totalErrors = 0;
  let bestRace: BestRaceSummary | null = null;

  const cumulativeMissedKeys: Record<string, number> = {};
  let totalMissedKeyCount = 0;

  const modeBuckets: Record<TextMode, MutableBucket> = { sentences: createBucket(), words: createBucket() };
  const langBuckets: Record<TextLanguage, MutableBucket> = { fr: createBucket(), en: createBucket() };
  const complexityBuckets: Record<TextComplexity, MutableBucket> = {
    easy: createBucket(),
    medium: createBucket(),
    hard: createBucket(),
  };
  const formatBuckets: Record<"solo" | "multiplayer", MutableBucket> = {
    solo: createBucket(),
    multiplayer: createBucket(),
  };

  const eligibleNewestFirst: PersonalRaceRow[] = [];
  const recentRaces: RecentRaceItem[] = [];

  for (let i = 0; i < rowsNewestFirst.length; i += 1) {
    const row = rowsNewestFirst[i];
    const textMode = readTextMode(row.config);
    const language = readLanguage(row.config);
    const complexity = readComplexity(row.config);
    const format = row.participantCount >= 2 ? "multiplayer" : "solo";

    if (row.status === "finished") finishedCount += 1;
    else if (row.status === "unfinished") unfinishedCount += 1;
    else abandonedCount += 1;

    if (row.participantCount >= 2) multiplayerRaces += 1;
    if (isWin(row)) wins += 1;
    if (isPodium(row)) podiums += 1;

    totalDurationMs += Math.max(0, row.durationMs);
    totalErrors += Math.max(0, row.errors);

    if (row.status !== "abandoned") {
      eligibleCount += 1;
      wpmSum += row.wpm;
      grossWpmSum += row.grossWpm;
      accuracySum += row.accuracy;
      eligibleNewestFirst.push(row);

      if (!bestRace || row.wpm > bestRace.wpm) {
        bestRace = {
          raceId: row.raceId,
          wpm: row.wpm,
          grossWpm: row.grossWpm,
          accuracy: row.accuracy,
          endedAt: row.endedAt,
        };
      }
    }

    if (row.missedKeys && typeof row.missedKeys === "object") {
      for (const [key, rawCount] of Object.entries(row.missedKeys)) {
        if (typeof rawCount === "number" && Number.isFinite(rawCount) && rawCount > 0) {
          cumulativeMissedKeys[key] = (cumulativeMissedKeys[key] ?? 0) + rawCount;
          totalMissedKeyCount += rawCount;
        }
      }
    }

    addToBucket(modeBuckets[textMode], row);
    addToBucket(langBuckets[language], row);
    addToBucket(complexityBuckets[complexity], row);
    addToBucket(formatBuckets[format], row);

    if (recentRaces.length < RECENT_RACES_LIMIT) {
      recentRaces.push({
        raceId: row.raceId,
        endedAt: row.endedAt,
        rank: row.rank,
        participantCount: row.participantCount,
        wpm: row.wpm,
        grossWpm: row.grossWpm,
        accuracy: row.accuracy,
        durationMs: row.durationMs,
        status: row.status,
        personalBest: row.personalBest,
        textMode,
        language,
      });
    }
  }

  const computedTotals: PersonalStatsTotals = {
    raceCount: rowsNewestFirst.length,
    finishedCount,
    unfinishedCount,
    abandonedCount,
    wins,
    podiums,
    multiplayerRaces,
    bestWpm: bestRace ? bestRace.wpm : null,
    averageWpm: eligibleCount > 0 ? wpmSum / eligibleCount : null,
    averageGrossWpm: eligibleCount > 0 ? grossWpmSum / eligibleCount : null,
    averageAccuracy: eligibleCount > 0 ? accuracySum / eligibleCount : null,
    totalDurationMs,
    totalErrors,
  };

  const totals = sqlTotals ?? computedTotals;

  // Graphique de progression : 50 dernières courses non abandonnées, ordre chronologique.
  const chartRows = eligibleNewestFirst.slice(0, WPM_HISTORY_LIMIT).reverse();
  let rollingSum = 0;
  const wpmHistory: WpmHistoryPoint[] = chartRows.map((row, index) => {
    rollingSum += row.wpm;
    if (index >= 5) rollingSum -= chartRows[index - 5].wpm;
    const windowSize = Math.min(index + 1, 5);
    return {
      id: row.id,
      raceId: row.raceId,
      wpm: row.wpm,
      grossWpm: row.grossWpm,
      accuracy: row.accuracy,
      personalBest: row.personalBest,
      endedAt: row.endedAt,
      textMode: readTextMode(row.config),
      language: readLanguage(row.config),
      rollingAvg5: rollingSum / windowSize,
    };
  });

  // Tendance récente : 5 dernières courses non abandonnées vs 5 précédentes (au moins 6 courses admissibles).
  let trend: TrendSummary | null = null;
  if (eligibleNewestFirst.length >= 6) {
    const recentSlice = eligibleNewestFirst.slice(0, 5);
    const previousSlice = eligibleNewestFirst.slice(5, 10);
    const recentAvg = recentSlice.reduce((sum, row) => sum + row.wpm, 0) / recentSlice.length;
    const previousAvg = previousSlice.reduce((sum, row) => sum + row.wpm, 0) / previousSlice.length;
    const delta = recentAvg - previousAvg;
    const direction = delta >= 1.5 ? "up" : delta <= -1.5 ? "down" : "flat";
    trend = { recentAvg, previousAvg, delta, direction };
  }

  // Régularité : écart-type du MPM net sur les courses non abandonnées (au moins 3).
  let consistency: ConsistencySummary | null = null;
  if (eligibleNewestFirst.length >= 3) {
    const mean = wpmSum / eligibleNewestFirst.length;
    const variance =
      eligibleNewestFirst.reduce((sum, row) => sum + (row.wpm - mean) ** 2, 0) /
      eligibleNewestFirst.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;
    const level: ConsistencyLevel =
      coefficientOfVariation <= 0.1 ? "steady" : coefficientOfVariation <= 0.2 ? "regular" : "variable";
    consistency = { stdDev, coefficientOfVariation, level };
  }

  // Coût moyen des erreurs en MPM (écart brut - net).
  const errorCostWpm =
    totals.averageWpm !== null && totals.averageGrossWpm !== null
      ? Math.max(0, totals.averageGrossWpm - totals.averageWpm)
      : null;

  // Séries (en ordre chronologique).
  let currentWinStreak = 0;
  let bestWinStreak = 0;
  let currentFinishStreak = 0;
  let bestFinishStreak = 0;
  for (let i = rowsNewestFirst.length - 1; i >= 0; i -= 1) {
    const row = rowsNewestFirst[i];
    if (row.status === "finished") {
      currentFinishStreak += 1;
      if (currentFinishStreak > bestFinishStreak) bestFinishStreak = currentFinishStreak;
    } else {
      currentFinishStreak = 0;
    }
    if (row.participantCount >= 2) {
      if (isWin(row)) {
        currentWinStreak += 1;
        if (currentWinStreak > bestWinStreak) bestWinStreak = currentWinStreak;
      } else {
        currentWinStreak = 0;
      }
    }
  }

  return {
    totals,
    bestRace,
    wpmHistory,
    trend,
    consistency,
    errorCostWpm,
    streaks: { currentWinStreak, bestWinStreak, currentFinishStreak, bestFinishStreak },
    cumulativeMissedKeys,
    totalMissedKeyCount,
    breakdowns: {
      byTextMode: finalizeBuckets(["sentences", "words"], modeBuckets),
      byLanguage: finalizeBuckets(["fr", "en"], langBuckets),
      byComplexity: finalizeBuckets(["easy", "medium", "hard"], complexityBuckets),
      byFormat: finalizeBuckets(["multiplayer", "solo"], formatBuckets),
    },
    recentRaces,
    isCapped: sqlTotals ? sqlTotals.raceCount > rowsNewestFirst.length : false,
  };
}
