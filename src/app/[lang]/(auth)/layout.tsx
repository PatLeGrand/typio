import type { ReactNode } from "react";
import { schedulePurge } from "@/auth/schedulePurge";

/**
 * Pages de connexion, d'inscription et d'invité. Elles n'ont pas de `SiteHeader` (le cadre
 * `AuthLayout` fournit l'en-tête), mais déclenchent comme le reste du site le nettoyage
 * des sessions et des invités échus (H-2), sans retarder le rendu.
 */
export default function AuthRouteLayout({ children }: { children: ReactNode }) {
  schedulePurge();
  return children;
}
