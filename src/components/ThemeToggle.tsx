"use client";

import { useId, useSyncExternalStore } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { THEME_PREFERENCES } from "@/theme/theme";
import {
  getServerThemePreference,
  getThemePreference,
  setThemePreference,
  subscribeToTheme,
} from "@/theme/themeStore";

type ThemeToggleProps = {
  labels: Dictionary["theme"];
};

/** Choix clair / sombre / système, mémorisé dans `localStorage`. */
export function ThemeToggle({ labels }: ThemeToggleProps) {
  const groupName = useId();
  const preference = useSyncExternalStore(subscribeToTheme, getThemePreference, getServerThemePreference);

  return (
    <fieldset className="m-0 flex min-w-0 rounded-field border border-border bg-surface p-0.5">
      <legend className="sr-only">{labels.label}</legend>
      {THEME_PREFERENCES.map((option) => (
        <label key={option} className="cursor-pointer">
          <input
            type="radio"
            name={groupName}
            value={option}
            checked={preference === option}
            onChange={() => setThemePreference(option)}
            className="peer sr-only"
          />
          <span className="flex min-h-10 items-center rounded-[10px] px-3 text-sm font-semibold text-muted transition-colors hover:text-foreground peer-checked:bg-accent peer-checked:text-accent-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-text">
            {labels[option]}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
