import { describe, expect, it } from "vitest";
import { DEFAULT_RACE_SETTINGS, type RaceSettings } from "./config";
import { computeAccuracy } from "./metrics";
import {
  abandonRaceSession,
  createRaceSession,
  getPlayerOutcome,
  raceElapsedMs,
  raceTimeLeftMs,
  tickRaceSession,
  typeIntoRaceSession,
} from "./session";

const SETTINGS: RaceSettings = { ...DEFAULT_RACE_SETTINGS, timeLimitSeconds: 60 };
// Le départ est à 1000 + 3000 = 4000 ms, la limite à 64000 ms.
const T0 = 1000;
const START = 4000;

function racing(settings = SETTINGS, text = "abc") {
  return tickRaceSession(createRaceSession(settings, text, T0), START);
}

describe("session de course (A-D6)", () => {
  it("compte à rebours de 3 s puis course : le temps vient des horodatages", () => {
    const session = createRaceSession(SETTINGS, "abc", T0);
    expect(session.lifecycle.phase).toBe("countdown");
    expect(tickRaceSession(session, 3999)).toBe(session);
    expect(tickRaceSession(session, START).lifecycle.phase).toBe("racing");
  });

  it("AC-4 : une course d'une minute finit à 60 s, même avec des ticks très irréguliers", () => {
    let session = racing();
    session = tickRaceSession(session, START + 1);
    session = tickRaceSession(session, START + 59_999);
    expect(session.lifecycle.phase).toBe("racing");
    expect(raceTimeLeftMs(session, START + 59_999)).toBe(1);
    // Un onglet endormi se réveille longtemps après l'échéance.
    session = tickRaceSession(session, START + 200_000);
    expect(session.lifecycle).toMatchObject({ phase: "results", reason: "timeout", finishedAt: START + 60_000 });
    expect(getPlayerOutcome(session)?.elapsedMs).toBe(60_000);
    expect(raceTimeLeftMs(session, START + 200_000)).toBe(0);
  });

  it("AC-5 : 10 justes et 1 faute corrigée donnent 91 %, et la course se termine au dernier caractère", () => {
    const text = "0123456789";
    let session = racing(SETTINGS, text);
    let now = START;
    for (const value of ["0", "01", "012", "0123", "01234", "012345x", "012345", "0123456", "01234567", "012345678", "0123456789"]) {
      now += 500;
      session = typeIntoRaceSession(session, value, now);
    }
    const outcome = getPlayerOutcome(session);
    expect(outcome).toMatchObject({ reason: "completed", elapsedMs: 5500, correctChars: 10 });
    expect(computeAccuracy(outcome?.keystrokes ?? { total: 0, correct: 0 })).toBe(91);
  });

  it("ignore la saisie avant le départ et après la limite de temps", () => {
    const waiting = createRaceSession(SETTINGS, "abc", T0);
    expect(typeIntoRaceSession(waiting, "a", 2000).typed).toBe("");
    const late = typeIntoRaceSession(racing(), "a", START + 61_000);
    expect(late.typed).toBe("");
    expect(late.lifecycle).toMatchObject({ phase: "results", reason: "timeout" });
  });

  it("mode libre : on continue après une faute, mais il faut corriger pour finir", () => {
    let session = racing(SETTINGS, "abc");
    session = typeIntoRaceSession(session, "x", START + 100);
    session = typeIntoRaceSession(session, "xb", START + 200);
    session = typeIntoRaceSession(session, "xbc", START + 300);
    expect(session.typed).toBe("xbc");
    expect(session.lifecycle.phase).toBe("racing");
    session = typeIntoRaceSession(session, "", START + 400);
    session = typeIntoRaceSession(session, "a", START + 500);
    session = typeIntoRaceSession(session, "ab", START + 600);
    session = typeIntoRaceSession(session, "abc", START + 700);
    expect(session.lifecycle).toMatchObject({ phase: "results", reason: "completed" });
  });

  it("mode bloquant : le caractère faux n'entre pas", () => {
    const blocking = { ...SETTINGS, inputMode: "blocking" as const };
    let session = racing(blocking, "abc");
    session = typeIntoRaceSession(session, "x", START + 100);
    expect(session.typed).toBe("");
    expect(session.keystrokes).toEqual({ total: 1, correct: 0 });
    session = typeIntoRaceSession(session, "a", START + 200);
    expect(session.typed).toBe("a");
  });

  it("COURSE-5 : l'abandon n'est possible qu'en course et arrête le temps", () => {
    const waiting = createRaceSession(SETTINGS, "abc", T0);
    expect(abandonRaceSession(waiting, 2000)).toBe(waiting);
    const session = abandonRaceSession(typeIntoRaceSession(racing(), "a", START + 1000), START + 5000);
    expect(getPlayerOutcome(session)).toMatchObject({ reason: "abandoned", elapsedMs: 5000, correctChars: 1 });
  });

  it("borne le temps écoulé", () => {
    const session = racing();
    expect(raceElapsedMs(createRaceSession(SETTINGS, "abc", T0), 2000)).toBe(0);
    expect(raceElapsedMs(session, START + 2500)).toBe(2500);
    expect(raceElapsedMs(session, START + 90_000)).toBe(60_000);
    expect(raceTimeLeftMs(createRaceSession(SETTINGS, "abc", T0), 2000)).toBe(60_000);
  });
});
