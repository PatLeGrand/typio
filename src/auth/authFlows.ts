import type { Locale } from "@/i18n/config";
import type { OAuthAccountRepository } from "./oauth/oauthRepository";
import { DUMMY_PASSWORD_HASH, type PasswordHasher } from "./password";
import { purgeExpired } from "./purge";
import { ipRateLimitKey, loginFailureKey, type AuthLimiters } from "./rateLimit";
import { QueueFullError } from "./semaphore";
import { createSession, GUEST_LIFETIME_MS, type SessionGrant, type SessionRepository } from "./session";
import type { AuthFailure } from "./types";
import { UsernameTakenError, type UserRepository } from "./userRepository";
import { pseudoSkeleton, validateNewPassword, validatePassword, validatePseudo, validateUsername } from "./validation";

/** Tout ce dont les parcours ont besoin, injecté pour les tester sans base ni horloge réelle. */
export interface AuthDeps {
  users: UserRepository;
  oauthAccounts: OAuthAccountRepository;
  sessions: SessionRepository;
  limiters: AuthLimiters;
  passwords: PasswordHasher;
  now: () => Date;
}

export type AuthFlowResult = { ok: true; grant: SessionGrant } | { ok: false; error: AuthFailure };

export interface Credentials {
  /** IP brute du client ; regroupée par `ipRateLimitKey` (IPv6 par /64) pour les compteurs. */
  ip: string;
  /** Valeurs brutes du formulaire : elles sont validées ici, jamais crues. */
  username: unknown;
  password: unknown;
  remember: boolean;
  locale: Locale;
}

/** Données du formulaire d'inscription : les identifiants, la confirmation et le consentement. */
export interface RegistrationInput extends Credentials {
  /** Valeur brute du champ de confirmation, comparée au mot de passe. */
  passwordConfirm: unknown;
  /** Case « j'accepte les conditions d'utilisation et la politique de confidentialité ». */
  termsAccepted: boolean;
}

const fail = (code: AuthFailure["code"], field?: AuthFailure["field"]): AuthFlowResult => ({
  ok: false,
  error: field ? { code, field } : { code },
});

/**
 * AUTH-1 : crée un membre puis ouvre sa session.
 *
 * Tous les contrôles de formulaire (identifiant, règle du mot de passe, confirmation,
 * consentement) passent AVANT le limiteur et avant tout hachage : ils ne coûtent rien, et
 * un envoi invalide ne doit pas consommer le budget d'inscriptions de l'IP.
 */
export async function registerMember(deps: AuthDeps, input: RegistrationInput): Promise<AuthFlowResult> {
  const username = validateUsername(input.username);
  if (!username.ok) return fail(username.code, "username");
  const password = validateNewPassword(input.password);
  if (!password.ok) return fail(password.code, "password");
  if (input.passwordConfirm !== password.value) return fail("PASSWORD_MISMATCH", "passwordConfirm");
  if (!input.termsAccepted) return fail("TERMS_REQUIRED", "terms");

  // Chaque tentative qui atteindrait le hachage argon2 (coûteux) compte, qu'elle aboutisse ou non.
  if (!deps.limiters.registrations.consume(ipRateLimitKey(input.ip))) return fail("RATE_LIMITED");

  let passwordHash: string;
  try {
    passwordHash = await deps.passwords.hash(password.value);
  } catch (error) {
    // Trop de calculs argon2 en attente (mémoire du serveur) : on refuse sans calcul.
    if (error instanceof QueueFullError) return fail("RATE_LIMITED");
    throw error;
  }

  let userId: string;
  try {
    ({ id: userId } = await deps.users.createMember({
      username: username.value.username,
      displayName: username.value.displayName,
      passwordHash,
      locale: input.locale,
    }));
  } catch (error) {
    if (error instanceof UsernameTakenError) return fail("USERNAME_TAKEN", "username");
    throw error;
  }

  const grant = await createSession(
    deps.sessions,
    { userId, kind: "member", remember: input.remember },
    deps.now(),
  );
  await purgeExpired(deps);
  return { ok: true, grant };
}

/**
 * AUTH-1 : connexion. Identifiant inconnu et mauvais mot de passe donnent la même réponse,
 * et un hash factice est vérifié dans le premier cas pour égaliser le temps de réponse.
 *
 * Les essais sont RÉSERVÉS de façon synchrone (`consume`) avant le premier `await` : si on
 * ne comptait les échecs qu'après la vérification, des requêtes parallèles passeraient
 * toutes le contrôle avant qu'aucune n'ait enregistré son échec. La réservation est rendue
 * (`release`) quand l'essai ne prouve rien contre le compte : succès (par identifiant) ou
 * file argon2 saturée. Le couple (IP, identifiant) est remis à zéro au succès.
 */
export async function loginMember(deps: AuthDeps, input: Credentials): Promise<AuthFlowResult> {
  const { limiters } = deps;
  const ipKey = ipRateLimitKey(input.ip);
  if (!limiters.loginAttempts.consume(ipKey)) return fail("RATE_LIMITED");

  const username = validateUsername(input.username);
  const password = validatePassword(input.password);
  // Une saisie hors format ne peut correspondre à aucun compte ; on ne la hache pas.
  if (!username.ok || !password.ok) return fail("INVALID_CREDENTIALS");

  const pairKey = loginFailureKey(ipKey, username.value.username);
  const usernameKey = username.value.username;
  if (!limiters.loginFailures.consume(pairKey)) return fail("RATE_LIMITED");
  if (!limiters.loginFailuresPerUsername.consume(usernameKey)) {
    limiters.loginFailures.release(pairKey);
    return fail("RATE_LIMITED");
  }

  let matches: boolean;
  let member: Awaited<ReturnType<UserRepository["findMemberByUsername"]>>;
  try {
    member = await deps.users.findMemberByUsername(usernameKey);
    matches = await deps.passwords.verify(member?.passwordHash ?? DUMMY_PASSWORD_HASH, password.value);
  } catch (error) {
    // Un essai qui n'a rien vérifié ne doit pas verrouiller le compte : on rend les réservations.
    limiters.loginFailures.release(pairKey);
    limiters.loginFailuresPerUsername.release(usernameKey);
    // Trop de calculs argon2 en attente : refus sans calcul.
    if (error instanceof QueueFullError) return fail("RATE_LIMITED");
    throw error;
  }

  if (!member || !matches) return fail("INVALID_CREDENTIALS");

  limiters.loginFailures.reset(pairKey);
  limiters.loginFailuresPerUsername.release(usernameKey);
  const grant = await createSession(
    deps.sessions,
    { userId: member.id, kind: "member", remember: input.remember },
    deps.now(),
  );
  await purgeExpired(deps);
  return { ok: true, grant };
}

/** AUTH-4 : invité avec pseudo, sans compte durable (H-2). */
export async function createGuest(
  deps: AuthDeps,
  input: { ip: string; pseudo: unknown; locale: Locale },
): Promise<AuthFlowResult> {
  if (!deps.limiters.guests.consume(ipRateLimitKey(input.ip))) return fail("RATE_LIMITED");

  const pseudo = validatePseudo(input.pseudo);
  if (!pseudo.ok) return fail(pseudo.code, "pseudo");

  // Un pseudo d'invité dont le squelette (sans casse ni accents, confusables ASCII pliés : « 1 »
  // et « I » pour « l », « rn » pour « m ») égale celui d'un membre usurperait ce membre dans une
  // partie. Contrôlé après le limiteur : c'est une lecture en base.
  if (await deps.users.memberUsernameExists(pseudoSkeleton(pseudo.value))) return fail("PSEUDO_TAKEN", "pseudo");

  const now = deps.now();
  const { id: userId } = await deps.users.createGuest({
    displayName: pseudo.value,
    locale: input.locale,
    expiresAt: new Date(now.getTime() + GUEST_LIFETIME_MS),
  });

  const grant = await createSession(deps.sessions, { userId, kind: "guest", remember: false }, now);
  await purgeExpired(deps);
  return { ok: true, grant };
}
