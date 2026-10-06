/** Fournisseurs de connexion tiers : GitHub (AUTH-3) et Discord (AUTH-2). */
export const OAUTH_PROVIDERS = ["github", "discord"] as const;

export type OAuthProviderName = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProviderName(value: unknown): value is OAuthProviderName {
  return typeof value === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/** Valeurs de `?oauth=` que la page de connexion sait afficher. */
export const OAUTH_NOTICES = ["cancelled", "failed", "unavailable"] as const;

export type OAuthNotice = (typeof OAUTH_NOTICES)[number];

export function isOAuthNotice(value: unknown): value is OAuthNotice {
  return typeof value === "string" && (OAUTH_NOTICES as readonly string[]).includes(value);
}

/**
 * Ce que les routes attendent d'un fournisseur configuré : une fine couche au-dessus du
 * client Arctic, pour que les parcours se testent sans réseau ni classe Arctic.
 */
export interface OAuthProviderClient {
  name: OAuthProviderName;
  /** Discord utilise PKCE ; GitHub, via Arctic, non. */
  usesPkce: boolean;
  /** URL d'autorisation chez le fournisseur. `codeVerifier` est `null` sans PKCE. */
  createAuthorizationURL(state: string, codeVerifier: string | null): URL;
  /**
   * Échange le code contre un jeton d'accès, avec un délai maximal. Ce jeton ne sert qu'à lire
   * l'identifiant du compte : l'appelant ne le stocke ni ne le journalise.
   */
  exchangeCode(code: string, codeVerifier: string | null): Promise<string>;
}

/** Identité lue chez le fournisseur. Seul `accountId` est conservé en base. */
export interface OAuthProfile {
  /** Identifiant numérique stable du compte chez le fournisseur, en texte. */
  accountId: string;
  /**
   * Login GitHub ou nom d'utilisateur Discord : sert une seule fois, à proposer l'identifiant
   * (et le nom d'affichage, qui en est dérivé) à la création du compte. Le nom d'affichage du
   * fournisseur (`name`, `global_name`) n'est jamais lu.
   */
  login: string;
}
