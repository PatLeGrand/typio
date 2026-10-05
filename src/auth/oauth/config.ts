import "server-only";
import { Discord, GitHub } from "arctic";
import {
  OAUTH_PROVIDERS,
  type OAuthProviderClient,
  type OAuthProviderName,
} from "./providers";
import { withDeadline } from "./timeout";

type Env = Readonly<Record<string, string | undefined>>;

/** GitHub : aucun scope, donc le profil public seulement. Discord : l'identité seulement. */
const GITHUB_SCOPES: string[] = [];
const DISCORD_SCOPES = ["identify"];

function readEnv(env: Env, name: string): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

/**
 * Origine publique de l'application (`APP_ORIGIN`), jamais déduite de l'en-tête `Host` :
 * un client pourrait le forger pour faire envoyer le code d'autorisation ailleurs. Seule
 * l'origine (schéma, hôte, port) est gardée ; une valeur absente ou invalide donne `null`.
 */
function readAppOrigin(env: Env): string | null {
  const raw = readEnv(env, "APP_ORIGIN");
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** Adresse à déclarer dans l'application OAuth du fournisseur. */
export function getRedirectUri(provider: OAuthProviderName, env: Env = process.env): string | null {
  const origin = readAppOrigin(env);
  return origin ? `${origin}/api/auth/${provider}/callback` : null;
}

/**
 * Client du fournisseur, ou `null` s'il n'est pas configuré (identifiant, secret ou
 * `APP_ORIGIN` manquant). Lu à chaque appel : aucune valeur n'est figée au build.
 */
export function getOAuthProvider(name: OAuthProviderName, env: Env = process.env): OAuthProviderClient | null {
  const redirectUri = getRedirectUri(name, env);
  if (!redirectUri) return null;

  if (name === "github") {
    const clientId = readEnv(env, "GITHUB_CLIENT_ID");
    const clientSecret = readEnv(env, "GITHUB_CLIENT_SECRET");
    if (!clientId || !clientSecret) return null;
    const client = new GitHub(clientId, clientSecret, redirectUri);
    return {
      name,
      usesPkce: false,
      createAuthorizationURL: (state) => client.createAuthorizationURL(state, GITHUB_SCOPES),
      exchangeCode: async (code) => (await withDeadline(client.validateAuthorizationCode(code))).accessToken(),
    };
  }

  const clientId = readEnv(env, "DISCORD_CLIENT_ID");
  const clientSecret = readEnv(env, "DISCORD_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const client = new Discord(clientId, clientSecret, redirectUri);
  return {
    name,
    usesPkce: true,
    createAuthorizationURL: (state, codeVerifier) => client.createAuthorizationURL(state, codeVerifier, DISCORD_SCOPES),
    exchangeCode: async (code, codeVerifier) =>
      (await withDeadline(client.validateAuthorizationCode(code, codeVerifier))).accessToken(),
  };
}

/** Fournisseurs utilisables : ceux dont les boutons sont actifs. */
export function getEnabledProviders(env: Env = process.env): OAuthProviderName[] {
  return OAUTH_PROVIDERS.filter((name) => getOAuthProvider(name, env) !== null);
}
