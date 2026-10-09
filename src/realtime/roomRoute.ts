import type { Locale } from "@/i18n/config";
import type { ParticipantRole } from "./protocol";

const JOIN_ROLES = ["runner", "spectator"] as const satisfies readonly ParticipantRole[];

/** Rôle demandé dans `?role=` ; toute valeur absente ou inconnue donne `runner`. */
export function parseJoinRole(value: unknown): ParticipantRole {
  return JOIN_ROLES.find((role) => role === value) ?? "runner";
}

/** Chemin de la page d'une salle, avec le rôle voulu à l'arrivée. */
export function roomPath(locale: Locale, code: string, role?: ParticipantRole): string {
  const base = `/${locale}/room/${code}`;
  return role === "spectator" ? `${base}?role=spectator` : base;
}
