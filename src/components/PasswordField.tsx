"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { TextField, type TextFieldProps } from "./TextField";

type PasswordFieldProps = Omit<TextFieldProps, "type" | "endSlot"> & {
  /** Nom accessible du bouton quand le mot de passe est masqué (texte traduit). */
  showLabel: string;
  /** Nom accessible du bouton quand le mot de passe est affiché (texte traduit). */
  hideLabel: string;
};

/**
 * `TextField` dont un bouton « œil » bascule l'affichage du mot de passe.
 * Composant client : `icon` doit être un élément (`<Lock />`), pas un composant.
 */
export function PasswordField({ showLabel, hideLabel, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const ToggleIcon = visible ? EyeOff : Eye;

  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      endSlot={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? hideLabel : showLabel}
          className="inline-flex size-11 items-center justify-center rounded-lg text-muted transition-colors hover:text-foreground"
        >
          <ToggleIcon aria-hidden="true" className="size-[18px]" />
        </button>
      }
    />
  );
}
