import "server-only";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getCurrentUser } from "./currentUser";

/**
 * Pour les pages de connexion, d'inscription et d'invité : un utilisateur déjà connecté
 * (membre ou invité) n'a rien à y faire, il est renvoyé vers l'accueil de sa langue.
 * `redirect` lève une exception de contrôle ; à appeler hors de tout `try`.
 */
export async function redirectIfSignedIn(locale: Locale): Promise<void> {
  const user = await getCurrentUser();
  if (user) redirect(`/${locale}`);
}
