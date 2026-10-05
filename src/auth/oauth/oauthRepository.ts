import type { Locale } from "@/i18n/config";
import type { OAuthProviderName } from "./providers";

/** Le compte fournisseur est déjà relié à un membre (violation de la clé primaire d'`oauth_accounts`). */
export class OAuthAccountTakenError extends Error {
  constructor() {
    super("OAUTH_ACCOUNT_TAKEN");
    this.name = "OAuthAccountTakenError";
  }
}

export interface OAuthAccountRef {
  provider: OAuthProviderName;
  providerAccountId: string;
}

export interface NewOAuthMember extends OAuthAccountRef {
  username: string;
  displayName: string;
  locale: Locale;
}

/** Accès aux comptes GitHub et Discord reliés, injecté : le parcours se teste sans base. */
export interface OAuthAccountRepository {
  /** Membre auquel le compte fournisseur est relié, ou `null`. */
  findUserIdByAccount(account: OAuthAccountRef): Promise<string | null>;
  /** Relie le compte à `userId`. Faux, sans rien changer, si le compte est déjà relié (à n'importe qui). */
  linkAccount(account: OAuthAccountRef & { userId: string }): Promise<boolean>;
  /**
   * Crée un membre SANS mot de passe et son lien fournisseur dans UNE transaction : si le
   * lien échoue, le membre n'existe pas non plus. Lève `UsernameTakenError` si l'identifiant
   * (sans casse) est pris, `OAuthAccountTakenError` si le compte fournisseur est déjà relié.
   */
  createMemberWithAccount(member: NewOAuthMember): Promise<{ id: string }>;
}
