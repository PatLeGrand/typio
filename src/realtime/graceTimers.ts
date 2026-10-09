/**
 * Minuteurs de grâce (SALLE-13, H-9) : un par utilisateur déconnecté, armé à la perte de son
 * dernier socket et annulé s'il revient. Le registre est créé par serveur (jamais global au
 * module), pour que deux serveurs, ou deux tests, ne partagent aucun minuteur.
 */

export interface GraceTimers {
  /** Arme le minuteur de `key` ; un minuteur déjà armé pour cette clé est annulé d'abord. */
  arm(key: string, delayMs: number, onExpire: () => void): void;
  /** Annule le minuteur de `key`, s'il existe. */
  cancel(key: string): void;
  /** Annule tout et refuse les armements suivants (fermeture du serveur). */
  close(): void;
  /** Nombre de minuteurs en attente. */
  readonly size: number;
}

export function createGraceTimers(): GraceTimers {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let closed = false;

  function cancel(key: string): void {
    const existing = timers.get(key);
    if (existing === undefined) return;
    clearTimeout(existing);
    timers.delete(key);
  }

  return {
    arm(key, delayMs, onExpire) {
      if (closed) return;
      cancel(key);
      const timer = setTimeout(() => {
        timers.delete(key);
        onExpire();
      }, delayMs);
      // Un minuteur de grâce ne doit pas empêcher le processus de s'arrêter.
      timer.unref?.();
      timers.set(key, timer);
    },
    cancel,
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
