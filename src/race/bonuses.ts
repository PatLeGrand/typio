/** Bonus de remontée : décisions pures, hasard et mots fournis par l'appelant. */
export const FOG_DURATION_MS = 4_000;

export type BonusType = "shorten" | "lengthen" | "fog";
export type TextEdit =
  | { type: "remove"; start: number; end: number }
  | { type: "append"; text: string };

export interface BonusAward {
  checkpoint: number;
  recipientId: string;
  targetId: string;
  type: BonusType;
  edit?: TextEdit;
  fogUntilMs?: number;
}

export interface BonusRunner {
  readonly id: string;
  readonly active: boolean;
  /** Progression = caractères corrects / longueur du texte courant propre au coureur.
   * Un retrait préserve la position tapée ; la MPM reste fondée sur les caractères corrects. */
  readonly progress: number;
  readonly typedLength: number;
  readonly text: string;
  readonly bonusesReceived: number;
  readonly fogUntilMs: number;
}

/** Les plages portent sur le texte courant au moment de chaque modification. */
export function applyTextEdits(baseText: string, edits: readonly TextEdit[]): string {
  return edits.reduce((text, edit) => edit.type === "remove"
    ? text.slice(0, edit.start) + text.slice(edit.end)
    : text + edit.text, baseText);
}

export function shortenEdit(text: string, typedLength: number, count = 3): TextEdit | null {
  const words = [...text.matchAll(/\S+/gu)];
  const current = words.findIndex((word) => word.index + word[0].length >= typedLength);
  const first = current + 1;
  const after = Math.min(first + Math.max(0, Math.floor(count)), words.length - 1);
  if (current < 0 || after <= first) return null;
  // Conserver l'espace après le mot courant, puis reprendre au premier mot non retiré.
  return { type: "remove", start: words[first].index, end: words[after].index };
}

export function lengthenEdit(text: string, words: readonly string[]): TextEdit {
  return { type: "append", text: (text.length > 0 ? " " : "") + words.join(" ") };
}

/** `alreadyTriggered` est le nombre de points déjà traités ; le seuil doit être dépassé. */
export function crossedCheckpoints(maxProgress: number, alreadyTriggered: number): number[] {
  return [0.25, 0.5, 0.75].flatMap((threshold, index) =>
    index >= alreadyTriggered && maxProgress > threshold ? [index] : []);
}

export function resolveCheckpoint(
  checkpoint: number,
  runners: readonly BonusRunner[],
  now: number,
  random: () => number,
  drawWords: (count: number) => readonly string[],
): BonusAward[] {
  const active = runners.filter((runner) => runner.active);
  const leader = active.reduce<BonusRunner | undefined>((best, runner) =>
    !best || runner.progress > best.progress ? runner : best, undefined);
  const last = active.reduce<BonusRunner | undefined>((worst, runner) =>
    !worst || runner.progress < worst.progress ? runner : worst, undefined);
  const awards: BonusAward[] = [];
  let penaltyUsed = false;
  for (const runner of active) {
    if (runner === leader || runner.bonusesReceived >= 3 ||
      (runner !== last && (!leader || leader.progress < runner.progress + 0.25))) continue;
    const edit = shortenEdit(runner.text, runner.typedLength);
    const possible: BonusType[] = edit ? ["shorten"] : [];
    if (leader && !penaltyUsed) {
      possible.push("lengthen");
      if (leader.fogUntilMs <= now) possible.push("fog");
    }
    if (possible.length === 0) continue;
    const type = possible[Math.min(possible.length - 1, Math.floor(random() * possible.length))];
    const award: BonusAward = { checkpoint, recipientId: runner.id, targetId: runner.id, type };
    if (type === "shorten" && edit) award.edit = edit;
    else if (leader) {
      award.targetId = leader.id;
      penaltyUsed = true;
      if (type === "lengthen") award.edit = lengthenEdit(leader.text, drawWords(3));
      else award.fogUntilMs = now + FOG_DURATION_MS;
    }
    awards.push(award);
  }
  return awards;
}
