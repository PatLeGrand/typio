/**
 * Explorateur de salles et partie rapide (SALLE-03, JOIN-02, JOIN-03) : fonctions pures sur
 * l'état des salles, sans Socket.IO. Seules les salles publiques sont jamais exposées.
 */

import { LOBBY_MAX_ROOMS, type LobbyRoom, type RoomState } from "./protocol";

/** Une salle publique et son horodatage de création (départage « la plus ancienne », JOIN-03). */
export interface LobbyEntry {
  room: LobbyRoom;
  createdAt: number;
}

/** Entrée de l'explorateur, ou `null` si la salle n'est pas publique ou est fermée (SALLE-03). */
export function toLobbyEntry(state: RoomState, createdAt: number): LobbyEntry | null {
  if (state.config.visibility !== "public" || state.status === "closed") return null;
  const runners =
    state.participants.filter((participant) => participant.role === "runner").length + state.config.botCount;
  const host = state.participants.find((participant) => participant.userId === state.hostId);
  return {
    createdAt,
    room: {
      code: state.code,
      runners,
      capacity: state.config.capacity,
      language: state.config.language,
      host: host?.displayName ?? "",
      status: state.status,
      // SALLE-09 : jamais une course en cours ; SALLE-05 : pas une salle pleine.
      joinable: (state.status === "waiting" || state.status === "results") && runners < state.config.capacity,
    },
  };
}

/** Partie rapide (JOIN-03) : la salle joignable qui a le moins de places libres, puis la plus ancienne. */
export function pickQuickJoin(entries: readonly LobbyEntry[]): LobbyEntry | null {
  let best: LobbyEntry | null = null;
  for (const entry of entries) {
    if (!entry.room.joinable) continue;
    const free = entry.room.capacity - entry.room.runners;
    if (
      best === null ||
      free < best.room.capacity - best.room.runners ||
      (free === best.room.capacity - best.room.runners && entry.createdAt < best.createdAt)
    ) {
      best = entry;
    }
  }
  return best;
}

/** Liste envoyée aux abonnés : les plus anciennes d'abord, plafonnée (JOIN-02). */
export function lobbyRooms(entries: readonly LobbyEntry[]): LobbyRoom[] {
  return [...entries]
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, LOBBY_MAX_ROOMS)
    .map((entry) => entry.room);
}
