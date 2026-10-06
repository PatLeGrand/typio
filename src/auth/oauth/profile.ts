import type { OAuthProfile, OAuthProviderName } from "./providers";
import { OAUTH_REQUEST_TIMEOUT_MS } from "./timeout";

/** Réponse inattendue du fournisseur. Ni le jeton ni le corps ne sont dans le message. */
export class OAuthProfileError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "OAuthProfileError";
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const GITHUB_USER_URL = "https://api.github.com/user";
const DISCORD_USER_URL = "https://discord.com/api/users/@me";

/** Identifiant Discord : « snowflake » numérique (64 bits, donc au plus 20 chiffres). */
const DISCORD_ID_PATTERN = /^\d{1,20}$/;

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new OAuthProfileError("profile is not an object");
  }
  return value as Record<string, unknown>;
}

function parseGithubProfile(body: unknown): OAuthProfile {
  const data = asRecord(body);
  const { id, login } = data;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
    throw new OAuthProfileError("invalid GitHub id");
  }
  if (typeof login !== "string" || login.length === 0) throw new OAuthProfileError("invalid GitHub login");
  // `name`, `email`, `avatar_url`… ne sont volontairement pas lus.
  return { accountId: String(id), login };
}

function parseDiscordProfile(body: unknown): OAuthProfile {
  const data = asRecord(body);
  const { id, username } = data;
  if (typeof id !== "string" || !DISCORD_ID_PATTERN.test(id)) throw new OAuthProfileError("invalid Discord id");
  if (typeof username !== "string" || username.length === 0) {
    throw new OAuthProfileError("invalid Discord username");
  }
  // `global_name`, `email`, `avatar`… ne sont volontairement pas lus.
  return { accountId: id, login: username };
}

/**
 * Lit l'identité du compte avec le jeton d'accès (une seule requête, délai de 10 s). Le
 * jeton n'est ni stocké ni journalisé ; GitHub (sans scope) ne renvoie que le profil public,
 * Discord (scope `identify`) que l'identité.
 */
export async function fetchOAuthProfile(
  provider: OAuthProviderName,
  accessToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<OAuthProfile> {
  const github = provider === "github";
  const response = await fetchImpl(github ? GITHUB_USER_URL : DISCORD_USER_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "Typio",
      Accept: github ? "application/vnd.github+json" : "application/json",
    },
    signal: AbortSignal.timeout(OAUTH_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new OAuthProfileError(`profile request failed with status ${response.status}`);
  }
  const body: unknown = await response.json();
  return github ? parseGithubProfile(body) : parseDiscordProfile(body);
}
