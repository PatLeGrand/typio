"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getSocket } from "./client";
import { createRoomConnection, type RoomConnection, type RoomSnapshot } from "./roomConnection";

/** Une seule connexion par onglet (D5) : toutes les pages lisent ce même store. */
const roomConnection = createRoomConnection(getSocket);

export type UseRoom = RoomSnapshot &
  Pick<RoomConnection, "create" | "join" | "updateConfig" | "leave" | "clearError">;

/**
 * Salle de l'utilisateur courant. `userId` vient de la session lue côté serveur : le client
 * s'en sert pour savoir s'il fait encore partie de l'état reçu, jamais pour s'identifier
 * auprès du serveur (celui-ci lit le cookie de session).
 */
export function useRoom(userId: string): UseRoom {
  const snapshot = useSyncExternalStore(
    roomConnection.subscribe,
    roomConnection.getSnapshot,
    roomConnection.getServerSnapshot,
  );

  useEffect(() => {
    roomConnection.start(userId);
  }, [userId]);

  return {
    ...snapshot,
    create: roomConnection.create,
    join: roomConnection.join,
    updateConfig: roomConnection.updateConfig,
    leave: roomConnection.leave,
    clearError: roomConnection.clearError,
  };
}
