import "server-only";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getCurrentUserForDisplay } from "./currentUser";

interface RedirectOptions {
  /**
   * Un invité connecté peut rester sur la page. Vrai pour la connexion et l'inscription : un
   * invité doit pouvoir s'y créer un compte. Faux (défaut) pour la page « invité ».
   */
  allowGuests?: boolean;
}

/**
 * Pour les pages de connexion, d'inscription et d'invité : un utilisateur déjà connecté
 * n'a rien à y faire, il est renvoyé vers l'accueil de sa langue. Un MEMBRE l'est toujours ;
 * un invité seulement si `allowGuests` est faux.
 *
 * Utilise la version d'affichage de l'utilisateur : si la base est en panne, la page
 * s'affiche comme pour un visiteur (la soumission échouera proprement, `UNKNOWN`) plutôt
 * qu'un 500. `redirect` lève une exception de contrôle ; à appeler hors de tout `try`.
 */
export async function redirectIfSignedIn(locale: Locale, { allowGuests = false }: RedirectOptions = {}): Promise<void> {
  const user = await getCurrentUserForDisplay();
  if (user && !(allowGuests && user.kind === "guest")) redirect(`/${locale}`);
}
