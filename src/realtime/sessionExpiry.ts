/**
 * Expiration de session en cours de connexion : un socket ouvert reste valide tant qu'il est
 * connecté, même si la session (ou le compte invité) arrive à échéance. Ce suivi coupe donc
 * chaque socket à l'échéance de sa session ; le client qui se reconnecte est alors refusé
 * (`UNAUTHENTICATED`). L'échéance reste ici, hors de `SocketData`.
 */

import type { Socket } from "socket.io";

/** Limite de `setTimeout` (2^31 - 1 ms, environ 24,8 jours) : au-delà, le délai déborde et part aussitôt. */
export const MAX_TIMEOUT_MS = 2_147_483_647;

export interface SessionExpiryWatcher {
  /** Coupe `socket` à `expiresAt` ; annulé si le socket se déconnecte avant. */
  watch(socket: Pick<Socket, "id" | "disconnect" | "once">, expiresAt: Date): void;
  /** Annule tous les suivis (fermeture du serveur). */
  close(): void;
  /** Nombre de suivis en attente. */
  readonly size: number;
}

export function createSessionExpiryWatcher(now: () => Date): SessionExpiryWatcher {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let closed = false;

  function cancel(socketId: string): void {
    const timer = timers.get(socketId);
    if (timer === undefined) return;
    clearTimeout(timer);
    timers.delete(socketId);
  }

  return {
    watch(socket, expiresAt) {
      if (closed) return;

      const schedule = (): void => {
        const remaining = expiresAt.getTime() - now().getTime();
        if (remaining <= 0) {
          timers.delete(socket.id);
          socket.disconnect(true);
          return;
        }
        // Au-delà de la limite de setTimeout, on avance par étapes.
        const timer = setTimeout(schedule, Math.min(remaining, MAX_TIMEOUT_MS));
        timer.unref?.();
        timers.set(socket.id, timer);
      };

      schedule();
      socket.once("disconnect", () => cancel(socket.id));
    },
    close() {
      closed = true;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
    get size() {
      return timers.size;
    },
  };
}
