"use client";

import { useEffect } from "react";
import { syncRoomUser } from "./useRoom";

/**
 * Ferme la connexion temps réel de l'onglet quand l'utilisateur courant devient `null`
 * (déconnexion) ou change : sur un poste partagé, le socket ne doit pas rester ouvert avec
 * la session précédente. Ne rend rien.
 *
 * `userId` vient de `getCurrentUserForDisplay`, qui renvoie aussi `null` quand la base est
 * injoignable : la connexion est alors coupée, puis rétablie par la page de salle affichée
 * (`useRoom`) dès que la session se relit. Ce bref aller-retour est accepté plutôt que de faire
 * échouer toutes les pages avec la lecture stricte.
 */
export function RoomSessionGuard({ userId }: { userId: string | null }) {
  useEffect(() => {
    syncRoomUser(userId);
  }, [userId]);
  return null;
}
