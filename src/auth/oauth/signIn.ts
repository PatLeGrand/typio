import type { Locale } from "@/i18n/config";
import type { AuthDeps } from "../authFlows";
import { purgeExpired } from "../purge";
import { createSession, type SessionGrant } from "../session";
import { UsernameTakenError } from "../userRepository";
import { deriveUsernameBase, USERNAME_ATTEMPTS, usernameForAttempt } from "./identity";
import { OAuthAccountTakenError, type OAuthAccountRef } from "./oauthRepository";
import type { OAuthProfile, OAuthProviderName } from "./providers";

/**
 * AUTH-2, AUTH-3 : connexion par GitHub ou Discord.
 *
 * Deux issues seulement : le compte fournisseur est déjà relié à un membre, on ouvre une session
 * sur CE membre ; sinon on crée un nouveau membre (sans mot de passe) et son lien, puis une
 * session. AUCUN chemin ne relie un compte fournisseur à un membre qui existe déjà.
 *
 * Pourquoi pas de liaison : lier le compte fournisseur de qui se présente au membre actuellement
 * connecté se déclenche par une simple navigation (GET), donc un lien piégé ou un onglet ouvert
 * suffirait à une prise de contrôle silencieuse du compte (l'attaquant lie SON compte GitHub à la
 * victime, puis se connecte en tant qu'elle). La liaison reviendra avec une page « Mon compte » :
 * action POST explicite et confirmée, liste des comptes reliés et déliaison. Tant qu'elle n'existe
 * pas, un membre connecté ne peut pas lancer le flux (voir `startOAuth`).
 *
 * Session : même règle qu'une connexion sans « Rester connecté » (cookie de session, 24 h en base).
 * Il n'y a pas de case à cocher ici, et GitHub ou Discord reste souvent ouvert sur les postes
 * partagés : la durée courte est le choix sûr.
 *
 * Données : le login du fournisseur sert une seule fois, à proposer l'identifiant ; le nom d'affichage
 * en est dérivé (jamais le `name` ou `global_name` du fournisseur). Seul l'identifiant numérique du
 * compte est conservé.
 *
 * Le remplacement de la session précédente du navigateur (invité compris) est fait par l'appelant,
 * qui détient le cookie.
 */
export interface OAuthSignInInput {
  provider: OAuthProviderName;
  profile: OAuthProfile;
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

async function openMemberSession(deps: AuthDeps, userId: string): Promise<SessionGrant> {
  const grant = await createSession(deps.sessions, { userId, kind: "member", remember: false }, deps.now());
  await purgeExpired(deps);
  return grant;
}

export async function completeOAuthSignIn(deps: AuthDeps, input: OAuthSignInInput): Promise<SessionGrant> {
  const account: OAuthAccountRef = { provider: input.provider, providerAccountId: input.profile.accountId };

  const ownerId = await deps.oauthAccounts.findUserIdByAccount(account);
  if (ownerId !== null) return openMemberSession(deps, ownerId);

  const base = deriveUsernameBase(input.profile.login);
  for (let attempt = 0; attempt < USERNAME_ATTEMPTS; attempt += 1) {
    const username = usernameForAttempt(base, attempt, input.randomThreeDigits);
    try {
      const { id } = await deps.oauthAccounts.createMemberWithAccount({
        ...account,
        username,
        // Le nom d'affichage est l'identifiant : rien du profil du fournisseur n'est repris.
        displayName: username,
        locale: input.locale,
      });
      return await openMemberSession(deps, id);
    } catch (error) {
      if (error instanceof UsernameTakenError) continue;
      if (error instanceof OAuthAccountTakenError) {
        // Deux retours simultanés pour le même nouveau compte : l'autre a gagné, on s'y connecte.
        const winnerId = await deps.oauthAccounts.findUserIdByAccount(account);
        if (winnerId !== null) return openMemberSession(deps, winnerId);
      }
      throw error;
    }
  }
  throw new UsernameExhaustedError();
}
