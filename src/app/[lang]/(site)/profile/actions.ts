"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/auth/currentUser";
import { getAuthDeps } from "@/auth/deps";
import { describeError } from "@/auth/errors";
import { pseudoSkeleton } from "@/auth/validation";
import { getDb } from "@/db/shared";
import { users } from "@/db/schema";
import { prefixWithLocale } from "@/i18n/paths";
import { validateProfileUpdate, type ProfileUpdateResult } from "@/profile/profileSettings";

/**
 * Met à jour le nom affiché, la disposition du clavier et la langue de l'utilisateur de la
 * session (membre ou invité). L'identité vient de la session, jamais du formulaire : on ne
 * peut modifier que son propre profil. Les erreurs sont des codes, traduits côté client (UI-5).
 */
export async function updateProfile(formData: FormData): Promise<ProfileUpdateResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, code: "UNAUTHORIZED" };

    // Réservé avant toute requête en base : chaque appel valide écrit dans `users`.
    const deps = getAuthDeps();
    if (!deps.limiters.profileUpdates.consume(user.id)) return { ok: false, code: "RATE_LIMITED" };

    const parsed = validateProfileUpdate({
      displayName: formData.get("displayName"),
      keyboardLayout: formData.get("keyboardLayout"),
      locale: formData.get("locale"),
    });
    if (!parsed.ok) return parsed;
    const { displayName, keyboardLayout, locale } = parsed.value;

    // Même règle que le pseudo d'invité : un nom affiché dont le squelette (sans casse ni
    // accents) égale l'identifiant d'un AUTRE membre l'usurperait. Le sien reste permis :
    // c'est le nom affiché par défaut.
    const candidate = pseudoSkeleton(displayName);
    if (candidate !== user.username?.toLowerCase() && (await deps.users.memberUsernameExists(candidate))) {
      return { ok: false, code: "PSEUDO_TAKEN" };
    }

    await getDb().update(users).set({ displayName, keyboardLayout, locale }).where(eq(users.id, user.id));

    revalidatePath(prefixWithLocale("/profile", user.locale));
    if (user.locale !== locale) revalidatePath(prefixWithLocale("/profile", locale));

    return { ok: true, locale };
  } catch (error) {
    // Ni la saisie ni le message d'erreur Drizzle (il contient les paramètres) ne sont journalisés.
    console.error("[profile] updateProfile failed", describeError(error));
    return { ok: false, code: "UNKNOWN" };
  }
}
