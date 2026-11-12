"use client";

import { useSyncExternalStore } from "react";
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
};

/** Choix clair / sombre / système, mémorisé dans `localStorage`. */
export function ThemeToggle({ labels }: ThemeToggleProps) {
  const preference = useSyncExternalStore(subscribeToTheme, getThemePreference, getServerThemePreference);

  const Icon = preference === "light" ? Sun : preference === "dark" ? Moon : Monitor;
  const index = THEME_PREFERENCES.indexOf(preference);
  const nextPreference = THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length];

  return (
    <button
      type="button"
      aria-label={`${labels.label}: ${labels[preference]}`}
      title={`${labels.label}: ${labels[preference]}`}
      onClick={() => setThemePreference(nextPreference)}
      className="icon-enter inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:text-foreground"
    >
      <Icon aria-hidden="true" className="size-[18px]" />
    </button>
  );
}
