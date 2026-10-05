import { NextResponse } from "next/server";
import type { OAuthRedirect } from "./cookies";

/**
 * Redirection 302 avec les cookies du flux. `Location` peut être relatif (retour vers le
 * site : le navigateur le résout contre l'adresse publique qu'il a utilisée, donc rien
 * ne dépend de l'en-tête `Host` vu par le serveur). Jamais mise en cache.
 */
export function toRedirectResponse(redirect: OAuthRedirect): NextResponse {
  const response = new NextResponse(null, {
    status: 302,
    headers: { Location: redirect.location, "Cache-Control": "no-store" },
  });
  for (const cookie of redirect.cookies) response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}

/** 404 sans corps : fournisseur inconnu. */
export function providerNotFound(): NextResponse {
  return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}
