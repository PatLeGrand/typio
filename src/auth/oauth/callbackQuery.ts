import { z } from "zod";

/** Plafond de longueur d'un paramètre de retour : très au-delà des vrais `code`, `state` et `error`. */
const MAX_QUERY_PARAM_LENGTH = 2048;

const queryParam = z.string().max(MAX_QUERY_PARAM_LENGTH).nullable();

/** Paramètres du retour OAuth (`null` s'ils sont absents) ; un paramètre démesuré invalide la requête. */
export const oauthCallbackQuerySchema = z.strictObject({ code: queryParam, state: queryParam, error: queryParam });

export type OAuthCallbackQuery = z.infer<typeof oauthCallbackQuerySchema>;

export function parseOAuthCallbackQuery(searchParams: URLSearchParams): OAuthCallbackQuery | null {
  const result = oauthCallbackQuerySchema.safeParse({
    code: searchParams.get("code"),
    state: searchParams.get("state"),
    error: searchParams.get("error"),
  });
  return result.success ? result.data : null;
}
