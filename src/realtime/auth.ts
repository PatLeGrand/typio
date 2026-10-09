/**
 * Authentification des connexions Socket.IO (ADR-001) : le service temps réel lit le même
 * cookie de session que Next et le valide contre la table `sessions`. Aucun identifiant
 * n'est jamais pris dans une charge utile envoyée par le client.
 */

import { getSessionCookieName } from "@/auth/cookie";
import { validateSession, type SessionRepository, type SessionWithUser } from "@/auth/session";
import type { SocketData } from "./protocol";

/** Valeur du cookie `name` dans un en-tête `Cookie`, ou `null`. */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const raw = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Vrai si la poignée de main vient de l'origine du site. Défense contre le détournement
 * de WebSocket entre sites (CSWSH) : une page tierce ne doit pas ouvrir une connexion qui
 * porterait le cookie de l'élève. Une requête sans `Origin` (outil en ligne de commande)
 * n'a pas de cookie de navigateur à voler : elle passe, puis échoue à l'authentification.
 */
export function isAllowedOrigin(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  return origin === undefined || allowedOrigins.includes(origin);
}

export interface HandshakeIdentity {
  user: SocketData["user"];
  /** Fin de validité : la plus proche de l'échéance de la session et de celle du compte invité. */
  expiresAt: Date;
}

/** Utilisateur de la poignée de main et échéance de sa session, ou `null` si le cookie est absent, invalide ou échu. */
export async function authenticateHandshake(
  sessions: SessionRepository,
  cookieHeader: string | undefined,
  now: Date,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): Promise<HandshakeIdentity | null> {
  const token = readCookie(cookieHeader, getSessionCookieName(nodeEnv));

  // `validateSession` lit la session une seule fois : on garde cette lecture pour l'échéance.
  const captured: { record: SessionWithUser | null } = { record: null };
  const capturing: SessionRepository = {
    ...sessions,
    findWithUser: async (id) => {
      captured.record = await sessions.findWithUser(id);
      return captured.record;
    },
  };

  const user = await validateSession(capturing, token, now);
  const { record } = captured;
  if (!user || !record) return null;

  const accountExpiry = record.user.expiresAt;
  const sessionExpiry = record.session.expiresAt;
  const expiresAt = accountExpiry && accountExpiry < sessionExpiry ? accountExpiry : sessionExpiry;
  return { user: { id: user.id, kind: user.kind, displayName: user.displayName }, expiresAt };
}
