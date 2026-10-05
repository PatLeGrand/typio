import type { Locale } from "@/i18n/config";
import type { AuthDeps } from "../authFlows";
import { purgeExpired } from "../purge";
import { createSession, type SessionGrant } from "../session";
import type { CurrentUser } from "../types";
import { UsernameTakenError } from "../userRepository";
import { deriveDisplayName, deriveUsernameBase, USERNAME_ATTEMPTS, usernameForAttempt } from "./identity";
import { OAuthAccountTakenError, type OAuthAccountRef } from "./oauthRepository";
import type { OAuthProfile, OAuthProviderName } from "./providers";

export type OAuthSignInResult =
  /** Nouvelle session membre à poser dans le cookie. */
  | { status: "signed-in"; grant: SessionGrant }
  /** Compte relié au membre déjà connecté ; sa session est conservée. */
  | { status: "linked" }
  /** Compte déjà relié à un AUTRE membre : rien n'a changé. */
  | { status: "already-linked" };

export interface OAuthSignInInput {
  provider: OAuthProviderName;
  profile: OAuthProfile;
  /** Utilisateur de la session en cours (membre ou invité), `null` pour un visiteur. */
  currentUser: CurrentUser | null;
  locale: Locale;
  /** Injectable pour les tests ; trois chiffres du suffixe d'identifiant. */
  randomThreeDigits?: () => string;
}

/** Aucun identifiant libre trouvé après `USERNAME_ATTEMPTS` essais. */
export class UsernameExhaustedError extends Error {
  constructor() {
    super("USERNAME_EXHAUSTED");
    this.name = "UsernameExhaustedError";
  }
}

/**
 * Session d'un membre ouverte par un fournisseur tiers : 30 jours, comme « Rester connecté ».
 * L'utilisateur a choisi de s'authentifier chez GitHub ou Discord, il n'y a pas de case à
 * cocher ; un poste partagé se protège en se déconnectant.
 */
async function openMemberSession(deps: AuthDeps, userId: string): Promise<OAuthSignInResult> {
  const grant = await createSession(deps.sessions, { userId, kind: "member", remember: true }, deps.now());
  await purgeExpired(deps);
  return { status: "signed-in", grant };
}

/**
 * AUTH-2, AUTH-3 : applique l'identité lue chez le fournisseur.
 *
 * 1. Compte déjà relié : session de ce membre (sauf si un AUTRE membre est connecté : on ne
 *    change rien, `already-linked`).
 * 2. Compte libre et un MEMBRE connecté : on le relie à ce membre.
 * 3. Compte libre, visiteur ou invité : création d'un membre sans mot de passe, puis session.
 *    Le login et le nom d'affichage du fournisseur ne servent qu'à proposer l'identifiant et
 *    le nom d'affichage ; rien d'autre n'est conservé.
 *
 * Le remplacement de la session précédente du navigateur (invité compris) est fait par
 * l'appelant, qui détient le cookie.
 */
export async function completeOAuthSignIn(deps: AuthDeps, input: OAuthSignInInput): Promise<OAuthSignInResult> {
  const account: OAuthAccountRef = { provider: input.provider, providerAccountId: input.profile.accountId };
  const member = input.currentUser?.kind === "member" ? input.currentUser : null;

  const ownerId = await deps.oauthAccounts.findUserIdByAccount(account);
  if (ownerId !== null) return signInToOwner(deps, ownerId, member);

  if (member) {
    if (await deps.oauthAccounts.linkAccount({ ...account, userId: member.id })) return { status: "linked" };
    // Lié entre-temps (requête concurrente) : même membre, c'est fait ; autre membre, on refuse.
    const concurrentOwner = await deps.oauthAccounts.findUserIdByAccount(account);
    return concurrentOwner === member.id ? { status: "linked" } : { status: "already-linked" };
  }

  return createMember(deps, input, account);
}

async function signInToOwner(
  deps: AuthDeps,
  ownerId: string,
  member: CurrentUser | null,
): Promise<OAuthSignInResult> {
  if (member && member.id !== ownerId) return { status: "already-linked" };
  return openMemberSession(deps, ownerId);
}

async function createMember(
  deps: AuthDeps,
  input: OAuthSignInInput,
  account: OAuthAccountRef,
): Promise<OAuthSignInResult> {
  // Ici aucun membre n'est connecté : visiteur ou invité.
  const base = deriveUsernameBase(input.profile.login);
  const displayName = deriveDisplayName(input.profile.displayName, base);

  for (let attempt = 0; attempt < USERNAME_ATTEMPTS; attempt += 1) {
    try {
      const { id } = await deps.oauthAccounts.createMemberWithAccount({
        ...account,
        username: usernameForAttempt(base, attempt, input.randomThreeDigits),
        displayName,
        locale: input.locale,
      });
      return openMemberSession(deps, id);
    } catch (error) {
      if (error instanceof UsernameTakenError) continue;
      if (error instanceof OAuthAccountTakenError) {
        // Deux retours simultanés pour le même nouveau compte : l'autre a gagné, on s'y connecte.
        const ownerId = await deps.oauthAccounts.findUserIdByAccount(account);
        if (ownerId !== null) return openMemberSession(deps, ownerId);
      }
      throw error;
    }
  }
  throw new UsernameExhaustedError();
}
