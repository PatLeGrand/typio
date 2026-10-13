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

    // Même règle que le pseudo d'invité : un nom affiché dont le squelette (sans casse ni accents,
    // confusables ASCII pliés) égale celui d'un AUTRE membre l'usurperait. Un membre qui affiche
    // son propre identifiant, à la casse près, n'est pas contrôlé : c'est le nom affiché par
    // défaut. Sinon sa propre ligne est exclue de la recherche, mais pas les autres membres de
    // même squelette (le membre `a1ice` ne peut pas s'afficher « alice » à côté de `alice`).
    const isOwnUsername = user.username !== null && displayName.toLowerCase() === user.username;
    if (!isOwnUsername && (await deps.users.memberUsernameExists(pseudoSkeleton(displayName), { exceptUserId: user.id }))) {
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
