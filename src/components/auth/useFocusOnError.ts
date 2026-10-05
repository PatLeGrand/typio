"use client";

import { useEffect } from "react";
import type { AuthField, AuthFormState } from "@/auth/types";

/**
 * Après une erreur de champ, place le focus sur ce champ : un lecteur d'écran annonce alors
 * son libellé et son message (relié par `aria-describedby`), et le clavier reprend au bon
 * endroit. `fieldIds` associe chaque champ du formulaire à l'`id` de son élément ; il doit
 * être une constante de module (référence stable). `state` change d'identité à chaque
 * réponse du serveur : le focus revient donc au champ à chaque nouvel essai.
 */
export function useFocusOnError(state: AuthFormState, fieldIds: Partial<Record<AuthField, string>>): void {
  useEffect(() => {
    if (state.status !== "error" || state.field === undefined) return;
    const id = fieldIds[state.field];
    if (id !== undefined) document.getElementById(id)?.focus();
  }, [state, fieldIds]);
}
