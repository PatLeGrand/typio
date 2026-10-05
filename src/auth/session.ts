import { generateToken, hashToken, isWellFormedToken } from "./token";
import type { CurrentUser, UserKind } from "./types";
import type { UserRepository } from "./userRepository";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Membre « rester connecté » : session et cookie de 30 jours. */
export const REMEMBERED_SESSION_MS = 30 * DAY_MS;
/** Membre sans « rester connecté » et invité (H-2) : 24 h en base, cookie de session. */
export const SHORT_SESSION_MS = DAY_MS;
/** Durée de vie d'un compte invité (colonne `users.expires_at`). */
export const GUEST_LIFETIME_MS = SHORT_SESSION_MS;

/** Taille maximale d'un lot de purge (sessions échues, invités échus) : borne la durée de la requête. */
export const PURGE_BATCH_SIZE = 500;

export interface NewSession {
  /** SHA-256 hexadécimal du jeton (jamais le jeton brut). */
  id: string;
  userId: string;
  expiresAt: Date;
}

export interface SessionWithUser {
  session: { expiresAt: Date };
  user: CurrentUser & { expiresAt: Date | null };
}

/** Accès aux sessions, injecté : la logique ci-dessous se teste sans base. */
export interface SessionRepository {
  insert(session: NewSession): Promise<void>;
  findWithUser(id: string): Promise<SessionWithUser | null>;
  delete(id: string): Promise<void>;
  /** Supprime au plus `limit` sessions échues ; renvoie le nombre de lignes supprimées. */
  deleteExpired(now: Date, limit: number): Promise<number>;
}

/** Ce que l'action pose dans le cookie. */
export interface SessionGrant {
  /** Jeton brut, à envoyer au navigateur et nulle part ailleurs. */
  token: string;
  expiresAt: Date;
  /** Durée du cookie en secondes ; absent pour un cookie de session. */
  maxAgeSeconds?: number;
}

export interface SessionPolicy {
  durationMs: number;
  /** Vrai : cookie avec `Max-Age`. Faux : cookie de session. */
  persistent: boolean;
}

/** Pas de prolongation glissante : la durée est fixée à la création. */
export function sessionPolicy(kind: UserKind, remember: boolean): SessionPolicy {
  if (kind === "member" && remember) {
    return { durationMs: REMEMBERED_SESSION_MS, persistent: true };
  }
  return { durationMs: SHORT_SESSION_MS, persistent: false };
}

export async function createSession(
  repository: SessionRepository,
  params: { userId: string; kind: UserKind; remember: boolean },
  now: Date,
): Promise<SessionGrant> {
  const policy = sessionPolicy(params.kind, params.remember);
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + policy.durationMs);

  await repository.insert({ id: hashToken(token), userId: params.userId, expiresAt });

  return {
    token,
    expiresAt,
    ...(policy.persistent ? { maxAgeSeconds: policy.durationMs / 1000 } : {}),
  };
}

/**
 * Utilisateur de la session désignée par `token`, ou `null` (jeton absent, mal formé,
 * inconnu ou échu). Une session échue est supprimée à la lecture. Le service temps
 * réel peut réutiliser cette fonction avec son propre dépôt.
 */
export async function validateSession(
  repository: SessionRepository,
  token: unknown,
  now: Date,
): Promise<CurrentUser | null> {
  if (!isWellFormedToken(token)) return null;

  const id = hashToken(token);
  const found = await repository.findWithUser(id);
  if (!found) return null;

  const { session, user } = found;
  const guestExpired = user.expiresAt !== null && user.expiresAt.getTime() <= now.getTime();
  if (session.expiresAt.getTime() <= now.getTime() || guestExpired) {
    await repository.delete(id);
    return null;
  }

  return {
    id: user.id,
    kind: user.kind,
    displayName: user.displayName,
    username: user.username,
    locale: user.locale,
  };
}

/** Supprime la session désignée par `token` ; sans effet si le jeton est invalide. */
export async function destroySession(repository: SessionRepository, token: unknown): Promise<void> {
  if (!isWellFormedToken(token)) return;
  await repository.delete(hashToken(token));
}

/**
 * Déconnexion : supprime la session désignée par `token`, et si elle appartenait à un INVITÉ,
 * supprime aussi son compte (H-2 : un invité n'existe que le temps de sa session ; ses autres
 * sessions suivent en cascade). Un membre garde son compte. Sans effet si le jeton est invalide.
 */
export async function endSession(
  sessions: SessionRepository,
  users: UserRepository,
  token: unknown,
): Promise<void> {
  if (!isWellFormedToken(token)) return;

  const id = hashToken(token);
  const found = await sessions.findWithUser(id);
  await sessions.delete(id);
  if (found?.user.kind === "guest") await users.deleteGuest(found.user.id);
}
