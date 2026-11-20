import { describe, expect, it } from "vitest";
import {
  aggregatePersonalStats,
  parseStatsPeriod,
  RECENT_RACES_LIMIT,
  statsPeriodStart,
  WPM_HISTORY_LIMIT,
  type PersonalRaceRow,
} from "./personalStats";

function makeRow(overrides: Partial<PersonalRaceRow> & { index?: number } = {}): PersonalRaceRow {
  const index = overrides.index ?? 0;
  const date = new Date(Date.UTC(2026, 10, 20, 12, 0, 0) - index * 60_000);
  return {
    id: `res-${index}`,
    raceId: `race-${index}`,
    rank: 1,
    status: "finished",
    wpm: 60,
    grossWpm: 65,
    accuracy: 96,
    errors: 4,
    durationMs: 45_000,
    personalBest: false,
    missedKeys: {},
    createdAt: date,
    endedAt: date,
    participantCount: 4,
    config: { textMode: "sentences", language: "fr", complexity: "medium" },
    ...overrides,
  };
}

describe("parseStatsPeriod", () => {
  it("accepte les périodes connues et retombe sur all pour toute entrée invalide", () => {
    expect(parseStatsPeriod("all")).toBe("all");
    expect(parseStatsPeriod("30d")).toBe("30d");
    expect(parseStatsPeriod("7d")).toBe("7d");
    expect(parseStatsPeriod(undefined)).toBe("all");
    expect(parseStatsPeriod("365d")).toBe("all");
    expect(parseStatsPeriod(["7d"])).toBe("all");
    expect(parseStatsPeriod(42)).toBe("all");
  });

  it("calcule la date de début pour 7d et 30d et renvoie null pour all", () => {
    const now = new Date("2026-11-20T12:00:00.000Z");
    expect(statsPeriodStart("all", now)).toBeNull();
    expect(statsPeriodStart("7d", now)?.toISOString()).toBe("2026-11-13T12:00:00.000Z");
    expect(statsPeriodStart("30d", now)?.toISOString()).toBe("2026-10-21T12:00:00.000Z");
  });
});

describe("aggregatePersonalStats", () => {
  it("respecte H-26 : les abandons comptent dans le nombre de courses mais sont exclus du meilleur MPM, des moyennes et du graphique", () => {
    const rows = [
      makeRow({ index: 0, status: "abandoned", wpm: 140, grossWpm: 150, accuracy: 99, rank: 1, participantCount: 4 }),
      makeRow({ index: 1, status: "finished", wpm: 80, grossWpm: 86, accuracy: 98, rank: 1, participantCount: 3 }),
      makeRow({ index: 2, status: "unfinished", wpm: 60, grossWpm: 68, accuracy: 92, rank: 2, participantCount: 3 }),
    ];

    const report = aggregatePersonalStats(rows);

    expect(report.totals.raceCount).toBe(3);
    expect(report.totals.finishedCount).toBe(1);
    expect(report.totals.unfinishedCount).toBe(1);
    expect(report.totals.abandonedCount).toBe(1);
    expect(report.totals.bestWpm).toBe(80);
    expect(report.totals.averageWpm).toBeCloseTo(70, 5);
    expect(report.totals.averageGrossWpm).toBeCloseTo(77, 5);
    expect(report.totals.averageAccuracy).toBeCloseTo(95, 5);
    expect(report.bestRace?.raceId).toBe("race-1");
    expect(report.wpmHistory.map((p) => p.raceId)).toEqual(["race-2", "race-1"]);
    expect(report.errorCostWpm).toBeCloseTo(7, 5);
  });

  it("renvoie null pour les agrégats de vitesse quand toutes les courses sont abandonnées", () => {
    const rows = [
      makeRow({ index: 0, status: "abandoned", wpm: 50, grossWpm: 55, accuracy: 90 }),
      makeRow({ index: 1, status: "abandoned", wpm: 70, grossWpm: 75, accuracy: 95 }),
    ];

    const report = aggregatePersonalStats(rows);

    expect(report.totals.raceCount).toBe(2);
    expect(report.totals.wins).toBe(0);
    expect(report.totals.bestWpm).toBeNull();
    expect(report.totals.averageWpm).toBeNull();
    expect(report.totals.averageAccuracy).toBeNull();
    expect(report.bestRace).toBeNull();
    expect(report.wpmHistory).toEqual([]);
    expect(report.errorCostWpm).toBeNull();
    expect(report.trend).toBeNull();
    expect(report.consistency).toBeNull();
  });

  it("applique la règle H-26 des victoires et podiums (rang 1, finished, au moins 2 participants)", () => {
    const rows = [
      makeRow({ index: 0, rank: 1, status: "finished", participantCount: 1 }), // solo : pas une victoire
      makeRow({ index: 1, rank: 1, status: "unfinished", participantCount: 4 }), // non arrivé : pas une victoire
      makeRow({ index: 2, rank: 1, status: "finished", participantCount: 2 }), // victoire + podium
      makeRow({ index: 3, rank: 3, status: "finished", participantCount: 5 }), // podium uniquement
      makeRow({ index: 4, rank: 4, status: "finished", participantCount: 5 }), // ni l'un ni l'autre
    ];

    const report = aggregatePersonalStats(rows);

    expect(report.totals.wins).toBe(1);
    expect(report.totals.podiums).toBe(2);
    expect(report.totals.multiplayerRaces).toBe(4);
  });

  it("cumule les touches ratées sur toutes les courses et ignore les comptes invalides", () => {
    const rows = [
      makeRow({ index: 0, missedKeys: { e: 3, " ": 2, é: 1 }, status: "finished" }),
      makeRow({ index: 1, missedKeys: { e: 4, a: 2, z: 0, x: -5 }, status: "abandoned" }),
      makeRow({ index: 2, missedKeys: { é: 2, a: 1 }, status: "unfinished" }),
    ];

    const report = aggregatePersonalStats(rows);

    expect(report.cumulativeMissedKeys).toEqual({ e: 7, " ": 2, é: 3, a: 3 });
    expect(report.totalMissedKeyCount).toBe(15);
  });

  it("calcule la tendance récente, la moyenne mobile, la régularité et les séries", () => {
    // 10 courses du plus récent (index 0) au plus ancien (index 9) :
    // 5 plus récentes : 80 MPM, 5 précédentes : 60 MPM => tendance +20 ("up")
    const rows = Array.from({ length: 10 }, (_, index) =>
      makeRow({
        index,
        wpm: index < 5 ? 80 : 60,
        grossWpm: index < 5 ? 84 : 64,
        rank: index < 3 ? 1 : 2,
        participantCount: 4,
        status: "finished",
      }),
    );

    const report = aggregatePersonalStats(rows);

    expect(report.trend).not.toBeNull();
    expect(report.trend?.recentAvg).toBeCloseTo(80, 5);
    expect(report.trend?.previousAvg).toBeCloseTo(60, 5);
    expect(report.trend?.delta).toBeCloseTo(20, 5);
    expect(report.trend?.direction).toBe("up");

    // Chronologique : 5x60 puis 5x80 => dernier rollingAvg5 = 80, premier = 60
    expect(report.wpmHistory[0].rollingAvg5).toBeCloseTo(60, 5);
    expect(report.wpmHistory.at(-1)?.rollingAvg5).toBeCloseTo(80, 5);

    expect(report.consistency).not.toBeNull();
    expect(report.consistency?.stdDev).toBeCloseTo(10, 5);
    expect(report.consistency?.level).toBe("regular");

    expect(report.streaks.currentWinStreak).toBe(3);
    expect(report.streaks.bestWinStreak).toBe(3);
    expect(report.streaks.currentFinishStreak).toBe(10);
    expect(report.streaks.bestFinishStreak).toBe(10);
  });

  it("calcule les répartitions par mode, langue, complexité et format et borne le graphique et les courses récentes", () => {
    const rows = Array.from({ length: 60 }, (_, index) =>
      makeRow({
        index,
        wpm: index % 2 === 0 ? 70 : 50,
        accuracy: index % 2 === 0 ? 98 : 94,
        participantCount: index % 3 === 0 ? 1 : 4,
        config: {
          textMode: index % 2 === 0 ? "sentences" : "words",
          language: index % 2 === 0 ? "fr" : "en",
          complexity: index % 3 === 0 ? "easy" : index % 3 === 1 ? "medium" : "hard",
        },
      }),
    );

    const report = aggregatePersonalStats(rows);

    expect(report.wpmHistory).toHaveLength(WPM_HISTORY_LIMIT);
    expect(report.recentRaces).toHaveLength(RECENT_RACES_LIMIT);
    expect(report.breakdowns.byTextMode.find((b) => b.key === "sentences")?.averageWpm).toBeCloseTo(70, 5);
    expect(report.breakdowns.byTextMode.find((b) => b.key === "words")?.averageWpm).toBeCloseTo(50, 5);
    expect(report.breakdowns.byLanguage.find((b) => b.key === "fr")?.raceCount).toBe(30);
    expect(report.breakdowns.byLanguage.find((b) => b.key === "en")?.raceCount).toBe(30);
    expect(report.breakdowns.byFormat.find((b) => b.key === "solo")?.raceCount).toBe(20);
    expect(report.breakdowns.byFormat.find((b) => b.key === "multiplayer")?.raceCount).toBe(40);
  });
});
