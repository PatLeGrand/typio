/** Délai maximal de chaque requête sortante vers un fournisseur (jeton, profil). */
export const OAUTH_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Borne la durée d'une opération qui n'accepte pas de signal d'annulation (les requêtes de
 * jeton d'Arctic). Au bout du délai la promesse est rejetée ; la requête sous-jacente n'est
 * pas interrompue, mais plus personne n'attend son résultat.
 */
export function withDeadline<T>(operation: Promise<T>, ms: number = OAUTH_REQUEST_TIMEOUT_MS): Promise<T> {
  const signal = AbortSignal.timeout(ms);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}
