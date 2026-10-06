/**
 * Gestionnaires des événements `room:*` : À IMPLÉMENTER, lot 2 de
 * docs/plan-salle-temps-reel.md. Ce bouchon refuse tout pour que le service démarre.
 *
 * Règle : ce fichier ne fait que valider la charge utile (`parse*` de protocol.ts), appeler
 * le registre des salles (`roomStore.ts`, fonctions pures) et diffuser `room:state`.
 * Aucune règle métier ici.
 */

import type { Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "./protocol";
import type { RealtimeServer } from "./server";

export type RealtimeSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface RoomHandlerDeps {
  now: () => Date;
}

export function registerRoomHandlers(_io: RealtimeServer, socket: RealtimeSocket, _deps: RoomHandlerDeps): void {
  socket.on("room:create", (_config, ack) => ack({ ok: false, error: "INTERNAL" }));
  socket.on("room:join", (_payload, ack) => ack({ ok: false, error: "INTERNAL" }));
  socket.on("room:updateConfig", (_patch, ack) => ack({ ok: false, error: "INTERNAL" }));
  socket.on("room:leave", (ack) => ack({ ok: false, error: "INTERNAL" }));
}
