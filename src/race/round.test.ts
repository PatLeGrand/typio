import { describe, expect, it } from "vitest";
import { botFinishMs, planBot } from "./bots";
import { BOT_LEVELS, INPUT_MODES } from "../realtime/protocol";
import { DEFAULT_RACE_SETTINGS, type RaceSettings } from "./config";
import { applyRoundBonuses, createRound, PLAYER_ID, snapshotRound } from "./round";
import { abandonRaceSession, tickRaceSession, typeIntoRaceSession } from "./session";

const SETTINGS: RaceSettings = { ...DEFAULT_RACE_SETTINGS, bots: ["expert", "expert"], timeLimitSeconds: 60 };
const TEXT = "le chat dort sur le canape du salon";
const NAMES = ["Milo", "Nino", "Luna"];
const T0 = 0;
const START = 3000;

function newRound() {
  return createRound(1, SETTINGS, TEXT, NAMES, 7, T0, () => 0.5);
}
function racing() {
  const round = newRound();
  return { ...round, session: tickRaceSession(round.session, START) };
}

describe("manche solo (BOT-02, BOT-03, COURSE-02, A-D7)", () => {
  it.each(INPUT_MODES)("transmet le niveau et le mode de saisie aux bots (%s)", (inputMode) => {
    for (const level of BOT_LEVELS) {
      const settings: RaceSettings = { ...SETTINGS, inputMode, bots: [level] };
      const round = createRound(1, settings, TEXT, NAMES, 7, T0, () => 0.01);
      expect(round.bots[0].plan).toEqual(planBot(TEXT, level, inputMode, () => 0.01));
    }
  });

  it("crée un plan par bot, avec des noms distincts tirés de la liste selon la graine", () => {
    const round = newRound();
    expect(round.bots).toHaveLength(2);
    expect(new Set(round.bots.map((bot) => bot.name)).size).toBe(2);
    expect(round.bots.every((bot) => NAMES.includes(bot.name))).toBe(true);
    // Même graine, mêmes noms (serveur et navigateur) ; une autre graine peut changer l'ordre.
    expect(newRound().bots.map((bot) => bot.name)).toEqual(round.bots.map((bot) => bot.name));
    const orders = new Set(Array.from({ length: 12 }, (_, seed) =>
      createRound(1, SETTINGS, TEXT, NAMES, seed, T0, () => 0.5).bots.map((bot) => bot.name).join()));
    expect(orders.size).toBeGreaterThan(1);
    expect(round.bots.every((bot) => bot.plan.textLength === TEXT.length)).toBe(true);
    expect(createRound(2, { ...SETTINGS, bots: [] }, TEXT, NAMES, 7, T0, () => 0.5).bots).toEqual([]);
    // Plus de bots que de noms : la liste mélangée est reprise depuis le début.
    const many = createRound(3, { ...SETTINGS, bots: ["expert", "expert", "expert", "expert", "expert"] }, TEXT, NAMES, 7, T0, () => 0.5).bots.map((bot) => bot.name);
    expect(many.slice(0, 2)).toEqual(many.slice(3));
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
    const round = createRound(1, { ...SETTINGS, timeLimitSeconds: 60, bots: ["expert"] }, TEXT, NAMES, 7, T0, () => 0.5);
    const session = tickRaceSession(tickRaceSession(round.session, START), START + 61_000);
    const snapshot = snapshotRound({ ...round, session }, START + 61_000, "Toi");
    expect(snapshot.endReason).toBe("timeout");
    expect(snapshot.results?.map((row) => row.status)).toEqual(["finished", "unfinished"]);
    expect(snapshot.results?.[0].isPlayer).toBe(false);
  });
});


describe("bonus en solo", () => {
  const text = "un deux trois quatre cinq six sept huit neuf dix onze douze";
  function checkpointRound(seed: number, bonuses = true) {
    const round = createRound(1, { ...SETTINGS, bonuses, bots: ["expert"] }, text, NAMES, seed, T0, () => 0.5);
    return { ...round, session: tickRaceSession(round.session, START) };
  }

  it("franchit un point une seule fois, raccourcit le texte du joueur et lui permet de finir", () => {
    const round = checkpointRound(3);
    const before = structuredClone(round);
    const now = START + 2500;
    const next = applyRoundBonuses(round, now);
    expect(next.checkpointsTriggered).toBe(1);
    expect(next.bonusEvents).toMatchObject([{ checkpoint: 0, recipientId: PLAYER_ID, targetId: PLAYER_ID, type: "shorten" }]);
    expect(next.session.text).toBe("un cinq six sept huit neuf dix onze douze");
    expect(round).toEqual(before);
    expect(applyRoundBonuses(next, now).bonusEvents).toEqual(next.bonusEvents);
    let session = next.session;
    for (let index = 1; index <= next.session.text.length; index++) {
      session = typeIntoRaceSession(session, next.session.text.slice(0, index), now + index);
    }
    expect(snapshotRound({ ...next, session }, now + 100, "Toi").results?.find((row) => row.isPlayer))
      .toMatchObject({ status: "finished", bonusesReceived: 1, bonusTypes: ["shorten"] });
  });

  it("replanifie le bot ciblé et utilise sa propre longueur pour la progression et les résultats", () => {
    const round = checkpointRound(3);
    const session = typeIntoRaceSession(round.session, text.slice(0, 16), START + 1000);
    const next = applyRoundBonuses({ ...round, session }, START + 1000);
    expect(next.bonusEvents).toMatchObject([{ recipientId: "bot-0", targetId: "bot-0", type: "shorten" }]);
    expect(next.bots[0].plan.textLength).toBe(next.texts["bot-0"].length);
    expect(next.bots[0].plan.textLength).toBeLessThan(text.length);
    expect(next.bots[0].plan).not.toEqual(round.bots[0].plan);
    const finish = START + botFinishMs(next.bots[0].plan);
    const ended = { ...next, session: abandonRaceSession(next.session, finish) };
    expect(snapshotRound(ended, finish, "Toi").results?.find((row) => row.id === "bot-0"))
      .toMatchObject({ status: "finished", correctChars: next.texts["bot-0"].length, bonusTypes: ["shorten"] });
  });

  it.each([[0, "lengthen"], [1, "fog"]] as const)("replanifie le meneur pour le malus %s (%s)", (seed, type) => {
    const round = checkpointRound(seed);
    const now = START + 2500;
    const next = applyRoundBonuses(round, now);
    expect(next.bonusEvents).toMatchObject([{ recipientId: PLAYER_ID, targetId: "bot-0", type }]);
    expect(next.bots[0].plan).not.toEqual(round.bots[0].plan);
    if (type === "lengthen") {
      expect(next.texts["bot-0"].slice(text.length + 1).split(" ")).toHaveLength(3);
      expect(next.bots[0].plan.textLength).toBe(next.texts["bot-0"].length);
    } else {
      expect(next.fogUntil["bot-0"]).toBe(now + 4000);
      expect(botFinishMs(next.bots[0].plan)).toBeGreaterThan(botFinishMs(round.bots[0].plan));
    }
  });

  it("ne produit aucun effet quand les bonus sont désactivés", () => {
    const round = checkpointRound(3, false);
    expect(applyRoundBonuses(round, START + 2500)).toBe(round);
    expect(round.bonusEvents).toEqual([]);
  });
});
