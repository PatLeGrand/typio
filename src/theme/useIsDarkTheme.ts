import { useSyncExternalStore } from "react";

/**
 * Thème effectif courant, lu sur la classe `dark` de `<html>` (posée par le script de thème
 * avant le premier rendu puis par `applyThemePreference`). Sert aux rendus hors CSS, comme
 * la scène Pixi, qui ne suivent pas les variables CSS d'elles-mêmes.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => false;

export function useIsDarkTheme(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
