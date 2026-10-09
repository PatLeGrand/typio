/**
 * Index des sockets ouverts par utilisateur (un par onglet). Évite de balayer tous les
 * sockets du serveur à chaque événement, et sert de compteur pour plafonner les connexions
 * simultanées d'un même utilisateur.
 */

import type { RealtimeSocket } from "./roomHandlers";

/** Connexions simultanées maximum par utilisateur : borne la mémoire qu'un seul compte peut occuper. */
export const MAX_SOCKETS_PER_USER = 5;

export interface UserSockets {
  add(socket: RealtimeSocket): void;
  remove(socket: RealtimeSocket): void;
  /** Sockets ouverts de l'utilisateur ; copie, sûre à parcourir pendant qu'on les modifie. */
  of(userId: string): RealtimeSocket[];
  count(userId: string): number;
}

export function createUserSockets(): UserSockets {
  const byUser = new Map<string, Set<RealtimeSocket>>();

  return {
    add(socket) {
      const userId = socket.data.user.id;
      const sockets = byUser.get(userId) ?? new Set<RealtimeSocket>();
      sockets.add(socket);
      byUser.set(userId, sockets);
    },
    remove(socket) {
      const userId = socket.data.user.id;
      const sockets = byUser.get(userId);
      if (!sockets) return;
      sockets.delete(socket);
      if (sockets.size === 0) byUser.delete(userId);
    },
    of(userId) {
      return [...(byUser.get(userId) ?? [])];
    },
    count(userId) {
      return byUser.get(userId)?.size ?? 0;
    },
  };
}
