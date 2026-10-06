import { isOAuthNotice, type OAuthNotice } from "@/auth/oauth/providers";

/**
 * Message à afficher pour le paramètre `?oauth=` de la page de connexion, ou `null`. Toute
 * valeur inconnue (ou répétée, `?oauth=a&oauth=b`) est ignorée : le paramètre vient de l'URL,
 * il ne peut jamais servir à afficher un texte libre.
 */
export function parseOAuthNotice(value: string | string[] | undefined): OAuthNotice | null {
  return isOAuthNotice(value) ? value : null;
}
