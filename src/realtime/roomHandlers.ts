import type { Socket } from "socket.io";
import {
  parseRoomConfigPatch,
  parseJoinPayload,
  RECONNECT_GRACE_MS,
  type RoomState,
  type RoomErrorCode,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "./protocol";
import type { RealtimeServer } from "./server";
import type { createRoomStore } from "./roomStore";

export type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export interface RoomHandlerDeps {
  now: () => Date;
  store: ReturnType<typeof createRoomStore>;
}

const expirationTimers = new Map<string, NodeJS.Timeout>();

export function registerRoomHandlers(
  io: RealtimeServer,
  socket: RealtimeSocket,
  deps: RoomHandlerDeps
): void {
  const { store, now } = deps;

  const handleAction = (
    ack: unknown,
    action: () => { ok: boolean; state?: RoomState; error?: RoomErrorCode; data?: unknown }
  ) => {
    if (typeof ack !== "function") return;
    try {
      const res = action();
      if (res.ok) {
        if (res.data !== undefined) {
          ack({ ok: true, data: res.data });
        } else {
          ack({ ok: true });
        }
        if (res.state) {
          io.to(res.state.code).emit("room:state", res.state);
        }
      } else {
        ack({ ok: false, error: res.error });
      }
    } catch (e) {
      console.error(e);
      ack({ ok: false, error: "INTERNAL" });
    }
  };

  socket.on("room:create", (configInput, ack) => {
    handleAction(ack, () => {
      const patch = parseRoomConfigPatch(configInput);
      if (!patch) return { ok: false, error: "INVALID_PAYLOAD" };

      const res = store.create(socket.data.user, patch, now().getTime());
      if (res.ok) {
        const code = res.state.code;
        socket.join(code);
        socket.data.roomCode = code;
        return { ok: true, data: { code }, state: res.state };
      }
      return res;
    });
  });

  socket.on("room:join", (payloadInput, ack) => {
    handleAction(ack, () => {
      const payload = parseJoinPayload(payloadInput);
      if (payload === "INVALID_PAYLOAD" || payload === "INVALID_CODE") {
        return { ok: false, error: payload };
      }

      const { code, role } = payload;
      const res = store.join(socket.data.user, code, role, now().getTime());
      if (res.ok) {
        socket.join(code);
        socket.data.roomCode = code;

        const timerKey = `${code}:${socket.data.user.id}`;
        if (expirationTimers.has(timerKey)) {
          clearTimeout(expirationTimers.get(timerKey));
          expirationTimers.delete(timerKey);
        }

        return { ok: true, data: { code }, state: res.state };
      }
      return res;
    });
  });

  socket.on("room:updateConfig", (patchInput, ack) => {
    handleAction(ack, () => {
      const patch = parseRoomConfigPatch(patchInput);
      if (!patch) return { ok: false, error: "INVALID_PAYLOAD" };

      const code = socket.data.roomCode;
      if (!code) return { ok: false, error: "NOT_IN_ROOM" };

      const res = store.updateConfig(socket.data.user.id, code, patch);
      if (res.ok) {
        return { ok: true, state: res.state };
      }
      return res;
    });
  });

  socket.on("room:leave", (ack) => {
    handleAction(ack, () => {
      const code = socket.data.roomCode;
      if (!code) return { ok: false, error: "NOT_IN_ROOM" };

      const res = store.leave(socket.data.user.id, code);
      if (res.ok) {
        socket.leave(code);
        socket.data.roomCode = null;
        return { ok: true, state: res.state };
      }
      return res;
    });
  });

  socket.on("disconnect", async () => {
    const code = socket.data.roomCode;
    if (!code) return;

    try {
      const sockets = await io.in(code).fetchSockets();
      const stillConnected = sockets.some(
        (s) => s.data.user?.id === socket.data.user.id
      );

      if (!stillConnected) {
        const res = store.disconnect(socket.data.user.id, code);
        if (res.ok) {
          io.to(code).emit("room:state", res.state);

          const timerKey = `${code}:${socket.data.user.id}`;
          const timer = setTimeout(() => {
            const expRes = store.expire(socket.data.user.id, code);
            if (expRes.ok) {
              io.to(code).emit("room:state", expRes.state);
            }
            expirationTimers.delete(timerKey);
          }, RECONNECT_GRACE_MS);

          expirationTimers.set(timerKey, timer);
        }
      }
    } catch (e) {
      console.error("Erreur lors de la déconnexion", e);
    }
  });
}
