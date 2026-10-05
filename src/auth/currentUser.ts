import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getSessionCookieName } from "./cookie";
import { getAuthDeps } from "./deps";
import { validateSession } from "./session";
import type { CurrentUser } from "./types";

/**
 * Utilisateur de la requête en cours, ou `null` (pas de cookie, jeton inconnu, session
 * échue). À appeler depuis un Server Component, une Server Action ou un Route Handler.
 *
 * `cache()` de React : plusieurs composants d'un même rendu (en-tête, page, mise en page)
 * partagent un seul accès à la base. `import "server-only"` fait échouer la compilation
 * si un Client Component atteint ce module.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(getSessionCookieName())?.value;
  if (token === undefined) return null;
  return validateSession(getAuthDeps().sessions, token, new Date());
});
