/**
 * Validité de session d'un socket ouvert. Un socket reste authentifié tant qu'il est
 * connecté, donc deux cas doivent le couper après la poignée de main :
 *
 * - la session arrive à échéance (jusqu'à 30 jours pour un membre) ;
 * - la session est supprimée (déconnexion dans un autre onglet, poste partagé en classe) ou
 *   appartient à un autre utilisateur : une relecture périodique le détecte.
 *
 * Un seul minuteur par socket, réglé sur la plus proche des deux échéances. L'échéance reste
 * ici, hors de `SocketData`. Le client coupé qui se reconnecte est refusé (`UNAUTHENTICATED`).
 */

import type { Socket } from "socket.io";

/** Limite de `setTimeout` (2^31 - 1 ms, environ 24,8 jours) : au-delà, le délai déborde et part aussitôt. */
export const MAX_TIMEOUT_MS = 2_147_483_647;

/** Intervalle entre deux relectures de la session d'un socket. */
export const SESSION_REVALIDATE_MS = 90_000;

/** Part de l'intervalle ajoutée au hasard au premier tour, pour ne pas synchroniser les sockets. */
const JITTER_RATIO = 0.1;

export interface SessionExpiryOptions {
  /** Intervalle de relecture ; `SESSION_REVALIDATE_MS` par défaut. */
  revalidateMs?: number;
  /** Source d'aléa dans [0, 1[ pour le décalage du premier tour. */
  random?: () => number;
}

/** Vrai si la session du socket est toujours la sienne. Peut lever (base indisponible). */
export type RevalidateSession = () => Promise<boolean>;

export interface SessionExpiryWatcher {
  /**
   * Coupe `socket` à `expiresAt`, ou dès que `revalidate` répond faux. Une erreur de
   * `revalidate` ne coupe pas le socket : on réessaie au tour suivant. Annulé si le socket se
   * déconnecte avant.
   */
  watch(
    socket: Pick<Socket, "id" | "disconnect" | "once">,
    expiresAt: Date,
    revalidate?: RevalidateSession,
  ): void;
  /** Annule tous les suivis (fermeture du serveur). */
  close(): void;
  /** Nombre de minuteurs en attente. */
  readonly size: number;
}

/** Message d'erreur seul, jamais l'objet : il pourrait embarquer la requête et le jeton. */
function describeError(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : "unknown error";
}

export function createSessionExpiryWatcher(
  now: () => Date,
  options: SessionExpiryOptions = {},
): SessionExpiryWatcher {
  const revalidateMs = options.revalidateMs ?? SESSION_REVALIDATE_MS;
  const random = options.random ?? Math.random;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const stoppers = new Set<() => void>();
  let closed = false;

  return {
    watch(socket, expiresAt, revalidate) {
      if (closed) return;

      let stopped = false;
      let nextCheckAt = now().getTime() + revalidateMs + random() * revalidateMs * JITTER_RATIO;

      const stop = (): void => {
        stopped = true;
        const timer = timers.get(socket.id);
        if (timer !== undefined) clearTimeout(timer);
        timers.delete(socket.id);
        stoppers.delete(stop);
      };

      const schedule = (): void => {
        const at = now().getTime();
        const untilExpiry = expiresAt.getTime() - at;
        const untilCheck = revalidate ? nextCheckAt - at : Number.POSITIVE_INFINITY;
        const delay = Math.min(untilExpiry, untilCheck, MAX_TIMEOUT_MS);
        const timer = setTimeout(() => void tick(), Math.max(delay, 0));
        timer.unref?.();
        timers.set(socket.id, timer);
      };

      const cut = (): void => {
        stop();
        socket.disconnect(true);
      };

      const tick = async (): Promise<void> => {
        timers.delete(socket.id);
        if (stopped || closed) return;

        const at = now().getTime();
        if (at >= expiresAt.getTime()) return cut();

        if (revalidate && at >= nextCheckAt) {
          try {
            if (!(await revalidate())) return cut();
          } catch (e) {
            // Base indisponible : on garde le socket et on réessaie au tour suivant.
            console.error("[realtime] session revalidation failed:", describeError(e));
          }
          if (stopped || closed) return;
          nextCheckAt = now().getTime() + revalidateMs;
        }
        schedule();
      };

      stoppers.add(stop);
      socket.once("disconnect", stop);
      // Une échéance déjà passée coupe tout de suite.
      if (expiresAt.getTime() <= now().getTime()) return cut();
      schedule();
    },
    close() {
      closed = true;
      for (const stop of [...stoppers]) stop();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
    get size() {
      return timers.size;
    },
  };
}
