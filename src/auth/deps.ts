import "server-only";
import { createDatabaseClient } from "@/db/client";
import type { AuthDeps } from "./authFlows";
import { createDrizzleUserRepository } from "./drizzleUserRepository";
import { createDrizzleOAuthRepository } from "./oauth/drizzleOAuthRepository";
import { argon2PasswordHasher } from "./password";
import { createAuthLimiters } from "./rateLimit";
import { createDrizzleSessionRepository } from "./sessionRepository";

const globalForAuth = globalThis as typeof globalThis & { __typioAuthDeps?: AuthDeps };

/**
 * Dépendances réelles (PostgreSQL, argon2, limiteurs en mémoire), créées au premier usage
 * et non à l'import, pour que `next build` n'exige pas `DATABASE_URL`. Mises sur
 * `globalThis` : le rechargement à chaud en développement ne doit ni rouvrir de pool ni
 * remettre les compteurs de limitation à zéro.
 */
export function getAuthDeps(): AuthDeps {
  globalForAuth.__typioAuthDeps ??= createRealDeps();
  return globalForAuth.__typioAuthDeps;
}

function createRealDeps(): AuthDeps {
  const { db } = createDatabaseClient();
  return {
    users: createDrizzleUserRepository(db),
    oauthAccounts: createDrizzleOAuthRepository(db),
    sessions: createDrizzleSessionRepository(db),
    limiters: createAuthLimiters(),
    passwords: argon2PasswordHasher,
    now: () => new Date(),
  };
}
