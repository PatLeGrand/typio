import type { Dictionary } from "@/i18n/dictionaries";
import type { BonusAward } from "@/race/bonuses";

type BonusEvent = BonusAward & { at: number };
type Labels = Dictionary["raceScreen"]["bonuses"];
const RECENT_MS = 3_000;
const ICONS = { shorten: "✂", lengthen: "+", fog: "☁" };

export function racerBonusLabel(events: readonly BonusEvent[], id: string, now: number, labels: Labels): string {
  return events.filter((event) => event.targetId === id && event.at <= now && now - event.at < RECENT_MS)
    .map((event) => `${ICONS[event.type]} ${labels.types[event.type]}`).join(" · ");
}

export function playerBonusMessage(
  events: readonly BonusEvent[], id: string, now: number, labels: Labels,
  racers: readonly { id: string; name: string }[],
): string {
  return events.filter((event) => (event.targetId === id || event.recipientId === id) &&
    event.at <= now && now - event.at < RECENT_MS).map((event) => {
    if (event.type === "shorten") return labels.shorten;
    const sent = event.recipientId === id;
    const name = racers.find((racer) => racer.id === (sent ? event.targetId : event.recipientId))?.name ?? "";
    const message = sent ? event.type === "lengthen" ? labels.sentLengthen : labels.sentFog : labels[event.type];
    return message.replace("{name}", name);
  }).join(" · ");
}
