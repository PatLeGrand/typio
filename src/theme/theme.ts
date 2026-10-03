export const THEME_PREFERENCES = ["light", "dark", "system"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export type EffectiveTheme = "light" | "dark";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

/** Clé `localStorage` de la préférence de thème. */
export const THEME_STORAGE_KEY = "typio-theme";

export const DARK_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** Thème réellement affiché : « system » suit la préférence de l'OS. */
export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): EffectiveTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}
