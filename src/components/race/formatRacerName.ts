import type { Dictionary } from "@/i18n/dictionaries";
import type { BotLevel } from "@/realtime/protocol";

/** Suffixe « (Bot · niveau) » d'un nom de coureur, espace initial compris ; vide pour un humain. */
export function formatBotSuffix(
  isBot: boolean,
  level: BotLevel | undefined,
  botLabel: string,
  botLevels: Dictionary["raceScreen"]["botLevels"],
): string {
  return isBot ? ` (${botLabel}${level ? ` · ${botLevels[level]}` : ""})` : "";
}
