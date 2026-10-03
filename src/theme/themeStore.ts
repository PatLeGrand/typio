import {
  DARK_COLOR_SCHEME_QUERY,
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
  isThemePreference,
  resolveEffectiveTheme,
  type ThemePreference,
} from "./theme";

// Garde le choix de la session quand `localStorage` est indisponible
// (navigation privée, stockage bloqué) : le contrôle reste fonctionnel.
let sessionPreference: ThemePreference | null = null;

const listeners = new Set<() => void>();

function readStoredPreference(): ThemePreference | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStoredPreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Stockage indisponible : le choix ne vit que le temps de la session.
  }
}

function getSystemMedia(): MediaQueryList | null {
  return typeof window.matchMedia === "function" ? window.matchMedia(DARK_COLOR_SCHEME_QUERY) : null;
}

/** Préférence courante : valeur stockée, sinon choix de la session, sinon « system ». */
export function getThemePreference(): ThemePreference {
  return readStoredPreference() ?? sessionPreference ?? DEFAULT_THEME_PREFERENCE;
}

/** Instantané serveur : le serveur ne connaît pas la préférence stockée. */
export function getServerThemePreference(): ThemePreference {
  return DEFAULT_THEME_PREFERENCE;
}

/** Applique le thème effectif sur `<html>` (classe `dark`). */
export function applyThemePreference(preference: ThemePreference): void {
  const systemPrefersDark = getSystemMedia()?.matches ?? false;
  const theme = resolveEffectiveTheme(preference, systemPrefersDark);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Mémorise le choix, l'applique et prévient les abonnés. */
export function setThemePreference(preference: ThemePreference): void {
  sessionPreference = preference;
  writeStoredPreference(preference);
  applyThemePreference(preference);
  listeners.forEach((listener) => listener());
}

/**
 * Abonnement pour `useSyncExternalStore`. Suit aussi, en direct, les
 * changements de `prefers-color-scheme` (utile en mode « system ») et ceux de
 * la préférence faits dans un autre onglet.
 */
export function subscribeToTheme(onChange: () => void): () => void {
  const onSystemChange = () => applyThemePreference(getThemePreference());
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    applyThemePreference(getThemePreference());
    onChange();
  };

  const media = getSystemMedia();
  media?.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorage);
  listeners.add(onChange);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
    media?.removeEventListener("change", onSystemChange);
  };
}
