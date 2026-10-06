import { createSemaphore, type Semaphore } from "../semaphore";

/**
 * Au plus 4 échanges de code (jeton + profil) simultanés, 32 en file : chacun est une requête
 * sortante vers GitHub ou Discord, qu'un flot de retours ne doit pas pouvoir multiplier.
 * Au-delà, la demande est refusée sans requête (`QueueFullError`, rendue en `?oauth=failed`).
 */
export const OAUTH_EXCHANGE_CONCURRENCY = { maxConcurrent: 4, maxQueue: 32 } as const;

const globalForExchanges = globalThis as typeof globalThis & { __typioOAuthExchanges?: Semaphore };

/** Un seul sémaphore par processus, sur `globalThis` (comme celui d'argon2). */
export function getOAuthExchangeSemaphore(): Semaphore {
  globalForExchanges.__typioOAuthExchanges ??= createSemaphore(OAUTH_EXCHANGE_CONCURRENCY);
  return globalForExchanges.__typioOAuthExchanges;
}
