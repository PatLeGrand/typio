import { describe, expect, it } from "vitest";
import {
  applyTextEdits, crossedCheckpoints, FOG_DURATION_MS, lengthenEdit,
  resolveCheckpoint, shortenEdit, type BonusRunner,
} from "./bonuses";
import { createSeededRandom } from "./seededRandom";

const TEXT = "un deux trois quatre cinq six sept huit";
const drawWords = () => ["neuf", "dix", "onze"];
function runner(id: string, progress: number, overrides: Partial<BonusRunner> = {}): BonusRunner {
  return { id, progress, active: true, text: TEXT, typedLength: 1,
    bonusesReceived: 0, fogUntilMs: 0, ...overrides };
}

describe("éditions du texte", () => {
  it("retire les trois mots suivants sans toucher au mot courant ni au préfixe tapé", () => {
    for (const typedLength of [0, 1, 2]) {
      const edit = shortenEdit(TEXT, typedLength);
      expect(edit).toEqual({ type: "remove", start: 3, end: 21 });
      const text = applyTextEdits(TEXT, edit ? [edit] : []);
      expect(text).toBe("un cinq six sept huit");
      expect(text.slice(0, typedLength)).toBe(TEXT.slice(0, typedLength));
    }
    expect(applyTextEdits(TEXT, [shortenEdit(TEXT, 3)!])).toBe("un deux six sept huit");
  });

  it("conserve le dernier mot et retire moins de mots si nécessaire", () => {
    expect(applyTextEdits("un deux trois", [shortenEdit("un deux trois", 1)!])).toBe("un trois");
    for (const text of ["", "un", "un deux"]) expect(shortenEdit(text, 0)).toBeNull();
    expect(shortenEdit(TEXT, TEXT.length)).toBeNull();
    expect(shortenEdit(TEXT, 1, 0)).toBeNull();
    expect(applyTextEdits(TEXT, [shortenEdit(TEXT, 4, 1)!])).toBe("un deux quatre cinq six sept huit");
  });

  it("rejoue les plages dans l'ordre sur le texte courant, y compris après un ajout", () => {
    const added = lengthenEdit("un deux", drawWords());
    const longer = applyTextEdits("un deux", [added]);
    const removed = shortenEdit(longer, 1)!;
    expect(applyTextEdits("un deux", [added, removed])).toBe("un onze");
    expect(applyTextEdits(TEXT, [])).toBe(TEXT);
    expect(applyTextEdits("un", [lengthenEdit("un", drawWords())])).toBe("un neuf dix onze");
  });
});

describe("points de contrôle et attribution", () => {
  it("franchit plusieurs seuils dans l'ordre, strictement et une seule fois", () => {
    expect(crossedCheckpoints(0.25, 0)).toEqual([]);
    expect(crossedCheckpoints(0.5, 0)).toEqual([0]);
    expect(crossedCheckpoints(0.8, 0)).toEqual([0, 1, 2]);
    expect(crossedCheckpoints(0.8, 1)).toEqual([1, 2]);
    expect(crossedCheckpoints(1, 3)).toEqual([]);
  });

  it("aide le dernier et les retards d'au moins 25 points, hors meneur, inactifs et plafond", () => {
    const runners = [runner("leader", 0.8), runner("near", 0.7), runner("gap", 0.55),
      runner("last", 0.5), runner("capped", 0.4, { bonusesReceived: 3 }),
      runner("finished", 1, { active: false }), runner("abandoned", 0, { active: false })];
    const snapshot = structuredClone(runners);
    expect(resolveCheckpoint(1, runners, 100, () => 0, drawWords).map((award) => award.recipientId))
      .toEqual(["gap", "last"]);
    expect(runners).toEqual(snapshot);
    expect(resolveCheckpoint(0, [runner("leader", 0.8), runner("last", 0.79)], 0, () => 0, drawWords))
      .toMatchObject([{ recipientId: "last", targetId: "last", type: "shorten" }]);
    expect(resolveCheckpoint(0, runners.map((r) => ({ ...r, active: false })), 0, () => 0, drawWords))
      .toEqual([]);
  });

  it("choisit le premier meneur en cas d'égalité", () => {
    expect(resolveCheckpoint(0, [runner("first", 0.8), runner("second", 0.8), runner("last", 0.1)],
      100, () => 0.5, drawWords)).toMatchObject([{ targetId: "first", type: "lengthen" }]);
  });

  it("aide tous les derniers ex æquo, sauf le premier meneur si tous sont à égalité", () => {
    for (const leaderProgress of [0.6, 0.5]) {
      const runners = [runner("leader", leaderProgress), runner("last-a", 0.5), runner("last-b", 0.5)];
      expect(resolveCheckpoint(0, runners, 0, () => 0, drawWords).map((award) => award.recipientId))
        .toEqual(["last-a", "last-b"]);
    }
  });

  it("limite les malus à un par point et laisse ensuite seulement l'aide possible", () => {
    const runners = [runner("leader", 0.9), runner("a", 0.4), runner("b", 0.3),
      runner("c", 0.2, { text: "fin" })];
    const awards = resolveCheckpoint(2, runners, 100, () => 0.99, drawWords);
    expect(awards).toEqual([
      { checkpoint: 2, recipientId: "a", targetId: "leader", type: "fog", fogUntilMs: 100 + FOG_DURATION_MS },
      { checkpoint: 2, recipientId: "b", targetId: "b", type: "shorten", edit: shortenEdit(TEXT, 1) },
    ]);
    expect(runners[3].bonusesReceived).toBe(0);
    const lengthened = resolveCheckpoint(0, runners, 100, () => 0.5, (count) => {
      expect(count).toBe(3);
      return drawWords();
    });
    expect(lengthened.filter((award) => award.targetId === "leader")).toHaveLength(1);
    expect(lengthened[0].edit).toEqual(lengthenEdit(TEXT, drawWords()));
  });

  it("exclut un brouillard encore actif, mais autorise celui qui vient d'expirer", () => {
    const runners = [runner("leader", 0.9, { fogUntilMs: 101 }), runner("last", 0.2)];
    expect(resolveCheckpoint(0, runners, 100, () => 0.99, drawWords)[0].type).toBe("lengthen");
    expect(resolveCheckpoint(0, runners, 101, () => 0.99, drawWords)[0].type).toBe("fog");
  });

  it("tire uniformément parmi les seuls types possibles", () => {
    const runners = [runner("leader", 0.9), runner("last", 0.2)];
    expect([0, 1 / 3, 2 / 3].map((value) => resolveCheckpoint(0, runners, 0, () => value, drawWords)[0].type))
      .toEqual(["shorten", "lengthen", "fog"]);
    const noHelp = [runners[0], { ...runners[1], text: "fin" }];
    expect([0, 0.5].map((value) => resolveCheckpoint(0, noHelp, 0, () => value, drawWords)[0].type))
      .toEqual(["lengthen", "fog"]);
  });

  it("reproduit les mêmes attributions et mots à graine égale", () => {
    const run = () => {
      const random = createSeededRandom(42);
      return [0, 1, 2].flatMap((checkpoint) => resolveCheckpoint(checkpoint,
        [runner("leader", 0.9), runner("last", 0.2)], 100, random,
        (count) => Array.from({ length: count }, () => String(Math.floor(random() * 100)))));
    };
    expect(run()).toEqual(run());
  });
});
