export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Abonnement `useSyncExternalStore` à la préférence « mouvement réduit » du navigateur. */
export function subscribeToReducedMotion(listener: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export const getReducedMotionSnapshot = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;
