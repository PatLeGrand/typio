import { PURGE_BATCH_SIZE, type SessionRepository } from "./session";
import type { UserRepository } from "./userRepository";

/** Au plus une purge par minute et par processus. */
export const PURGE_MIN_INTERVAL_MS = 60 * 1000;

const globalForPurge = globalThis as typeof globalThis & { __typioLastPurgeAt?: number };

interface PurgeDeps {
  users: UserRepository;
  sessions: SessionRepository;
  now: () => Date;
}

/**
 * Nettoyage opportuniste, appelé à l'ouverture d'une session : sessions échues puis invités
 * échus (H-2 : minimisation des données, sur une base partagée), un lot de
 * `PURGE_BATCH_SIZE` lignes au plus par table. L'horodatage de la dernière purge est sur
 * `globalThis`, donc commun à toutes les instances du module dans le processus.
 *
 * Ne lève jamais : un nettoyage raté ne doit pas faire échouer une connexion, le prochain
 * passage réessaiera.
 */
export async function purgeExpired(deps: PurgeDeps): Promise<void> {
  const now = deps.now();
  const elapsed = now.getTime() - (globalForPurge.__typioLastPurgeAt ?? Number.NEGATIVE_INFINITY);
  // `elapsed < 0` : l'horloge a reculé, on ne bloque pas la purge jusqu'à rattraper l'ancien instant.
  if (elapsed >= 0 && elapsed < PURGE_MIN_INTERVAL_MS) return;
  globalForPurge.__typioLastPurgeAt = now.getTime();

  try {
    await deps.sessions.deleteExpired(now, PURGE_BATCH_SIZE);
    await deps.users.deleteExpiredGuests(now, PURGE_BATCH_SIZE);
  } catch {
    // Sans conséquence : le prochain passage s'en chargera.
  }
}

/** Remet le délai à zéro. Réservé aux tests : l'état est global au processus. */
export function resetPurgeThrottle(): void {
  delete globalForPurge.__typioLastPurgeAt;
}
