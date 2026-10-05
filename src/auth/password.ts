import { hash, verify } from "@node-rs/argon2";
import { createSemaphore, type Semaphore } from "./semaphore";

/**
 * Paramètres argon2id recommandés par l'OWASP (AUTH-5) : 19 MiB, 2 passes, 1 thread.
 * L'algorithme n'est pas passé : argon2id est le défaut de @node-rs/argon2 (et `Algorithm`,
 * une `const enum` ambiante, est inutilisable avec `isolatedModules`). Le test du préfixe
 * `$argon2id$v=19$m=19456,t=2,p=1$` garantit l'absence de dérive.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Plafond de concurrence d'argon2. Chaque calcul alloue 19 MiB : 30 connexions simultanées
 * en réclameraient environ 570 Mio, au-delà du `mem_limit: 512m` du conteneur `web` sur
 * le VPS (OOM kill). Avec 4 calculs à la fois, le pic reste autour de 80 Mio. Les
 * suivants attendent leur tour dans une file FIFO ; au-delà de `maxQueue`, la demande
 * est refusée sans calcul (`QueueFullError`, rendue à l'utilisateur en `RATE_LIMITED`).
 */
export const ARGON2_CONCURRENCY = { maxConcurrent: 4, maxQueue: 64 } as const;

const globalForArgon2 = globalThis as typeof globalThis & { __typioArgon2Semaphore?: Semaphore };

/**
 * Un seul sémaphore par processus, sur `globalThis` : si le module est instancié deux fois
 * (bundles distincts, rechargement à chaud), le plafond mémoire reste valable.
 */
function argon2Semaphore(): Semaphore {
  globalForArgon2.__typioArgon2Semaphore ??= createSemaphore(ARGON2_CONCURRENCY);
  return globalForArgon2.__typioArgon2Semaphore;
}

/**
 * Hash argon2id (mêmes paramètres) d'un mot de passe aléatoire jeté. Quand l'identifiant
 * n'existe pas, on vérifie le mot de passe saisi contre ce hash pour que la durée de la
 * réponse ne révèle pas l'existence du compte. Ce n'est le hash d'aucun compte.
 */
export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$P7EqBuYsHEyh7d+S5Po0rQ$nRMyWcch2CPuK7KwNycCiilU3aug0ALN1y7rl4pdfwE";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}

/** Lève `QueueFullError` si trop de calculs attendent déjà. */
export async function hashPassword(password: string): Promise<string> {
  return argon2Semaphore().run(() => hash(password, ARGON2_OPTIONS));
}

/**
 * Un hash illisible ou corrompu vaut un refus, jamais une exception. Passe par le même
 * sémaphore que `hashPassword`, y compris pour le hash factice. Lève `QueueFullError`
 * si trop de calculs attendent déjà (jamais une réponse « mot de passe faux »).
 */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return argon2Semaphore().run(async () => {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  });
}

export const argon2PasswordHasher: PasswordHasher = {
  hash: hashPassword,
  verify: verifyPassword,
};
