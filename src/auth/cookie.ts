/**
 * Nom du cookie de session. En production, le préfixe `__Host-` oblige le navigateur à
 * n'accepter le cookie que s'il est `Secure`, `Path=/` et sans `Domain` : un sous-domaine
 * ou une connexion http ne peut ni le poser ni l'écraser. En développement (http), le
 * préfixe serait refusé : nom simple. Le service temps réel lit le même nom (ADR-001).
 */
export function getSessionCookieName(nodeEnv: string | undefined = process.env.NODE_ENV): string {
  return nodeEnv === "production" ? "__Host-typio_session" : "typio_session";
}

interface SessionCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  /** Absent : cookie de session, effacé à la fermeture du navigateur. */
  maxAge?: number;
}

/**
 * Attributs du cookie de session. `Secure` en production seulement, pour que le
 * développement en http://localhost fonctionne ; jamais de `Domain` (exigé par `__Host-`).
 */
export function sessionCookieOptions(
  maxAgeSeconds: number | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: nodeEnv === "production",
    ...(maxAgeSeconds === undefined ? {} : { maxAge: maxAgeSeconds }),
  };
}
