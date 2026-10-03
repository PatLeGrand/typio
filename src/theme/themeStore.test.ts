import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY } from "./theme";
import {
  applyThemePreference,
  getServerThemePreference,
  getThemePreference,
  setThemePreference,
  subscribeToTheme,
} from "./themeStore";

type ChangeListener = () => void;

/** matchMedia contrôlable : permet de simuler un changement de thème de l'OS. */
function mockSystemTheme(initialDark: boolean) {
  const listeners = new Set<ChangeListener>();
  const media = {
    matches: initialDark,
    addEventListener: (_: string, listener: ChangeListener) => listeners.add(listener),
    removeEventListener: (_: string, listener: ChangeListener) => listeners.delete(listener),
  };
  vi.stubGlobal("matchMedia", () => media);
  return {
    setDark(dark: boolean) {
      media.matches = dark;
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
}

const isDark = () => document.documentElement.classList.contains("dark");

beforeEach(() => {
  window.localStorage.clear();
  setThemePreference("system");
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.classList.remove("dark");
});

describe("themeStore", () => {
  it("vaut « system » par défaut, côté client comme côté serveur", () => {
    expect(getServerThemePreference()).toBe("system");
    window.localStorage.clear();
    expect(getThemePreference()).toBe("system");
  });

  it("mémorise le choix, l'applique et le relit", () => {
    mockSystemTheme(false);
    setThemePreference("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(getThemePreference()).toBe("dark");
    expect(isDark()).toBe(true);

    setThemePreference("light");
    expect(isDark()).toBe(false);
  });

  it("ignore une valeur stockée invalide", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "neon");
    expect(getThemePreference()).toBe("system");
  });

  it("applique « system » selon l'OS", () => {
    mockSystemTheme(true);
    applyThemePreference("system");
    expect(isDark()).toBe(true);
  });

  it("garde le choix de la session si localStorage est inaccessible", () => {
    mockSystemTheme(false);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => setThemePreference("dark")).not.toThrow();
    expect(getThemePreference()).toBe("dark");
    expect(isDark()).toBe(true);
  });

  it("prévient les abonnés quand le choix change, pas après désabonnement", () => {
    mockSystemTheme(false);
    const onChange = vi.fn();
    const unsubscribe = subscribeToTheme(onChange);

    setThemePreference("dark");
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    setThemePreference("light");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("suit en direct l'OS en mode « system » seulement", () => {
    const system = mockSystemTheme(false);
    const unsubscribe = subscribeToTheme(() => {});

    setThemePreference("system");
    system.setDark(true);
    expect(isDark()).toBe(true);
    system.setDark(false);
    expect(isDark()).toBe(false);

    setThemePreference("light");
    system.setDark(true);
    expect(isDark()).toBe(false);

    unsubscribe();
    expect(system.listenerCount()).toBe(0);
  });

  it("se resynchronise quand la préférence change dans un autre onglet", () => {
    mockSystemTheme(false);
    const onChange = vi.fn();
    const unsubscribe = subscribeToTheme(onChange);

    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY }));
    expect(isDark()).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new StorageEvent("storage", { key: "autre-cle" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("fonctionne sans matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    const unsubscribe = subscribeToTheme(() => {});
    expect(() => setThemePreference("system")).not.toThrow();
    expect(isDark()).toBe(false);
    unsubscribe();
  });
});
