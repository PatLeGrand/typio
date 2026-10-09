import { describe, expect, it } from "vitest";
import { botFinishMs } from "./bots";
import { DEFAULT_RACE_SETTINGS, type RaceSettings } from "./config";
import { createRound, PLAYER_ID, snapshotRound } from "./round";
import { abandonRaceSession, tickRaceSession, typeIntoRaceSession } from "./session";

const SETTINGS: RaceSettings = { ...DEFAULT_RACE_SETTINGS, botCount: 2, botDifficulty: "hard", timeLimitSeconds: 60 };
const TEXT = "le chat dort sur le canape du salon";
const NAMES = ["Milo", "Nino", "Luna"];
const T0 = 0;
const START = 3000;

function newRound() {
  return createRound(1, SETTINGS, TEXT, NAMES, T0, () => 0.5);
}
function racing() {
  const round = newRound();
  return { ...round, session: tickRaceSession(round.session, START) };
}

describe("manche solo (BOT-2, BOT-3, A-D7)", () => {
  it("crée un plan par bot, avec les noms de la liste dans l'ordre", () => {
    const round = newRound();
    expect(round.bots.map((bot) => bot.name)).toEqual(["Milo", "Nino"]);
    expect(round.bots.every((bot) => bot.plan.textLength === TEXT.length)).toBe(true);
    expect(createRound(2, { ...SETTINGS, botCount: 0 }, TEXT, NAMES, T0, () => 0.5).bots).toEqual([]);
    expect(createRound(3, { ...SETTINGS, botCount: 5 }, TEXT, NAMES, T0, () => 0.5).bots.map((bot) => bot.name)).toEqual([
      "Milo", "Nino", "Luna", "Milo", "Nino",
    ]);
  });

  it("compte à rebours : 3, 2, 1 puis la course, temps restant plein", () => {
    const round = newRound();
    expect(snapshotRound(round, T0, "Toi")).toMatchObject({ phase: "countdown", countdownSeconds: 3, timeLeftMs: 60_000, elapsedMs: 0 });
    expect(snapshotRound(round, 2100, "Toi").countdownSeconds).toBe(1);
    expect(snapshotRound(racing(), START + 10_000, "Toi")).toMatchObject({ phase: "racing", countdownSeconds: 0, timeLeftMs: 50_000 });
  });

  it("fait avancer les bots avec l'horodatage, sans jamais reculer", () => {
    const round = racing();
    const progress = (clock: number) => snapshotRound(round, clock, "Toi").racers.find((racer) => racer.id === "bot-0")?.progress ?? 0;
    expect(progress(START)).toBe(0);
    const samples = [START + 2000, START + 5000, START + 9000].map(progress);
    expect(samples[0]).toBeGreaterThan(0);
    expect(samples).toEqual([...samples].sort((a, b) => a - b));
  });

  it("calcule MPM et précision du joueur en direct", () => {
    let round = racing();
    round = { ...round, session: typeIntoRaceSession(round.session, "l", START + 500) };
    round = { ...round, session: typeIntoRaceSession(round.session, "lx", START + 1000) };
    const snapshot = snapshotRound(round, START + 6000, "Toi");
    expect(snapshot.accuracy).toBe(50);
    expect(snapshot.wpm).toBe(Math.round(1 / 5 / (6000 / 60_000)));
  });

  it("fin par abandon : résultats, joueur dernier et marqué, rang cohérent", () => {
    const round = racing();
    const ended = { ...round, session: abandonRaceSession(round.session, START + 2000) };
    const snapshot = snapshotRound(ended, START + 90_000, "Toi");
    expect(snapshot).toMatchObject({ phase: "results", endReason: "abandoned", playerRank: 3 });
    expect(snapshot.results?.at(-1)).toMatchObject({ id: PLAYER_ID, status: "abandoned", rank: 3 });
    expect(snapshot.racers.map((racer) => racer.id)).toEqual(snapshot.results?.map((row) => row.id));
  });

  it("fin par le texte : le joueur gagne contre des bots plus lents", () => {
    const round = racing();
    const botFinish = Math.min(...round.bots.map((bot) => botFinishMs(bot.plan)));
    let session = round.session;
    for (let index = 1; index <= TEXT.length; index += 1) {
      session = typeIntoRaceSession(session, TEXT.slice(0, index), START + index * 10);
    }
    expect(TEXT.length * 10).toBeLessThan(botFinish);
    const snapshot = snapshotRound({ ...round, session }, START + 5000, "Toi");
    expect(snapshot).toMatchObject({ phase: "results", endReason: "completed", playerRank: 1, accuracy: 100 });
    expect(snapshot.results?.[0]).toMatchObject({ isPlayer: true, status: "finished" });
  });

  it("fin par le temps : les bots non arrivés sont classés selon leur progression", () => {
    const round = createRound(1, { ...SETTINGS, timeLimitSeconds: 60, botCount: 1, botDifficulty: "easy" }, TEXT, NAMES, T0, () => 0.5);
    const session = tickRaceSession(tickRaceSession(round.session, START), START + 61_000);
    const snapshot = snapshotRound({ ...round, session }, START + 61_000, "Toi");
    expect(snapshot.endReason).toBe("timeout");
    expect(snapshot.results?.map((row) => row.status)).toEqual(["finished", "unfinished"]);
    expect(snapshot.results?.[0].isPlayer).toBe(false);
  });
});
