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
 * Résumé journalisable d'une erreur : nom et code seulement. Le message est écarté
 * exprès, car celui de Drizzle contient les paramètres de la requête (hash du mot de
 * passe, identifiant de session).
 */
export function describeError(error: unknown): { name: string; code?: string } {
  const name = error instanceof Error ? error.name : typeof error;
  const code = postgresErrorCode(error);
  return code ? { name, code } : { name };
}
