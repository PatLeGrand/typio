"use client";

import { useEffect } from "react";
import { syncRoomUser } from "./useRoom";

/**
 * Ferme la connexion temps réel de l'onglet quand l'utilisateur courant devient `null`
 * (déconnexion) ou change : sur un poste partagé, le socket ne doit pas rester ouvert avec
 * la session précédente. Ne rend rien.
 */
export function RoomSessionGuard({ userId }: { userId: string | null }) {
  useEffect(() => {
    syncRoomUser(userId);
  }, [userId]);
  return null;
}
