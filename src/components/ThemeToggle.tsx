"use client";

import { useId, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
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
  compact?: boolean;
};

/** Choix clair / sombre / système, mémorisé dans `localStorage`. */
export function ThemeToggle({ labels, compact = false }: ThemeToggleProps) {
  const groupName = useId();
  const preference = useSyncExternalStore(subscribeToTheme, getThemePreference, getServerThemePreference);

  if (compact) {
    const Icon = preference === "light" ? Sun : preference === "dark" ? Moon : Monitor;
    const index = THEME_PREFERENCES.indexOf(preference);
    const nextPreference = THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length];

    return (
      <button
        type="button"
        aria-label={`${labels.label}: ${labels[preference]}`}
        title={`${labels.label}: ${labels[preference]}`}
        onClick={() => setThemePreference(nextPreference)}
        className="inline-flex size-11 items-center justify-center rounded-field border border-border bg-surface text-foreground transition-colors hover:bg-accent-soft"
      >
        <Icon aria-hidden="true" className="size-[18px]" />
      </button>
    );
  }

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
