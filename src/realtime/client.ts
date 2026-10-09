import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./protocol";

export type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: RoomSocket | null = null;

/**
 * Socket de l'onglet (D5) : un seul, créé à la première demande et jamais à l'import,
 * puisque ce module est aussi évalué pendant le rendu serveur. `autoConnect: false` : c'est
 * le store de salle qui décide quand se connecter. Renvoie `null` hors navigateur.
 */
export function getSocket(): RoomSocket | null {
  if (typeof window === "undefined") return null;
  socket ??= io(process.env.NEXT_PUBLIC_REALTIME_URL || undefined, {
    withCredentials: true,
    autoConnect: false,
  });
  return socket;
}
