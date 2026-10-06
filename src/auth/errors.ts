/** Code SQLSTATE d'une erreur PostgreSQL, y compris enveloppée par Drizzle (`cause`). */
export function postgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && typeof current === "object" && current !== null; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export const UNIQUE_VIOLATION = "23505";

/**
 * Messages fixes des erreurs d'Arctic : ils ne contiennent jamais de donnée, contrairement à
 * ceux de Drizzle, et survivent à la minification qui peut renommer les classes en production.
 */
const SAFE_MESSAGES = new Set([
  "Failed to send request",
  "Unexpected error response",
  "Unexpected error response body",
  "Invalid error response",
  "Invalid data",
  "Missing or invalid 'token_type' field",
  "Missing or invalid 'access_token' field",
]);

/** Statut HTTP porté par une erreur (erreurs d'Arctic), entier entre 100 et 599. */
function httpStatus(error: unknown): number | undefined {
  const status = typeof error === "object" && error !== null ? (error as { status?: unknown }).status : undefined;
  return typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
}

/**
 * Résumé journalisable d'une erreur : nom, classe, code et statut HTTP seulement. Le message
 * est écarté exprès, car celui de Drizzle contient les paramètres de la requête (hash du mot
 * de passe, identifiant de session). La classe est utile parce que les erreurs d'Arctic
 * (`ArcticFetchError`, `UnexpectedResponseError`…) gardent toutes le nom générique `Error`.
 */
export function describeError(error: unknown): {
  name: string;
  kind?: string;
  message?: string;
  cause?: string;
  code?: string;
  status?: number;
} {
  const name = error instanceof Error ? error.name : typeof error;
  const kind = error instanceof Error ? error.constructor.name : undefined;
  const code = postgresErrorCode(error);
  const status = httpStatus(error);
  const message = error instanceof Error && SAFE_MESSAGES.has(error.message) ? error.message : undefined;
  // Cause d'un échec réseau (ArcticFetchError) : son nom seulement, jamais son message.
  const cause = message && error instanceof Error && error.cause instanceof Error ? error.cause.name : undefined;
  return {
    name,
    ...(kind && kind !== name ? { kind } : {}),
    ...(message ? { message } : {}),
    ...(cause ? { cause } : {}),
    ...(code ? { code } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}
