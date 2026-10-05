import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getSessionCookieName } from "./cookie";
import { getAuthDeps } from "./deps";
import { describeError } from "./errors";
import { validateSession } from "./session";
import type { CurrentUser } from "./types";

/**
 * Le cookie se lit HORS de tout `try` : `cookies()` signale à Next que la page dépend de la
 * requête (rendu dynamique) en levant, à la génération statique, une exception de contrôle
 * qu'il faut laisser remonter.
 */
async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(getSessionCookieName())?.value;
}

async function loadUser(token: string | undefined): Promise<CurrentUser | null> {
  if (token === undefined) return null;
  return validateSession(getAuthDeps().sessions, token, new Date());
}

/**
 * Utilisateur de la requête en cours, ou `null` (pas de cookie, jeton inconnu, session
 * échue). Version STRICTE : si la base est injoignable, elle LÈVE. À utiliser pour toute
 * décision d'accès (futures routes protégées, actions) : ne jamais traiter une panne comme
 * « visiteur » quand l'identité sert à autoriser quelque chose.
 *
 * `cache()` de React : plusieurs composants d'un même rendu (en-tête, page, mise en page)
 * partagent un seul accès à la base. `import "server-only"` fait échouer la compilation
 * si un Client Component atteint ce module.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  return loadUser(await readSessionToken());
});

/**
 * Version d'AFFICHAGE : en cas d'erreur (base injoignable), renvoie `null` et journalise
 * (nom et code seulement, via `describeError`). Le site se dégrade en « visiteur » (liens
 * « Se connecter », « Jouer en invité ») au lieu d'un 500 sur toutes les pages. Réservée à
 * l'en-tête, à l'accueil et à la redirection des pages d'authentification, qui n'accordent
 * aucun droit : les futures routes protégées doivent utiliser `getCurrentUser`.
 */
export const getCurrentUserForDisplay = cache(async (): Promise<CurrentUser | null> => {
  const token = await readSessionToken();
  try {
    return await loadUser(token);
  } catch (error) {
    console.error("[auth] getCurrentUserForDisplay failed", describeError(error));
    return null;
  }
});
