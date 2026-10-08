import {
  RoomState,
  RoomErrorCode,
  RoomConfigPatch,
  ParticipantRole,
  DEFAULT_ROOM_CONFIG,
  MAX_RUNNERS,
} from "./protocol";
import { generateUniqueRoomCode } from "./roomCode";

export type RoomResult =
  | { ok: true; state: RoomState }
  | { ok: false; error: RoomErrorCode };

export interface UserContext {
  id: string;
  displayName: string;
  kind: "member" | "guest";
}

function cloneState(state: RoomState): RoomState {
  return {
    ...state,
    config: { ...state.config },
    participants: state.participants.map((p) => ({ ...p })),
  };
}

export function createRoomStore() {
  const rooms = new Map<string, RoomState>();

  function removeParticipant(roomCode: string, userId: string): RoomResult {
    const room = rooms.get(roomCode);
    if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };

    const index = room.participants.findIndex((p) => p.userId === userId);
    if (index === -1) return { ok: false, error: "NOT_IN_ROOM" };

    room.participants.splice(index, 1);

    if (room.participants.length === 0) {
      rooms.delete(roomCode);
      return { ok: true, state: cloneState({ ...room, status: "closed" }) };
    }

    if (room.hostId === userId) {
      const connected = room.participants.filter((p) => p.connected);
      let nextHost;
      if (connected.length > 0) {
        connected.sort((a, b) => a.joinedAt - b.joinedAt);
        nextHost = connected[0];
      } else {
        const all = [...room.participants].sort((a, b) => a.joinedAt - b.joinedAt);
        nextHost = all[0];
      }
      room.hostId = nextHost.userId;
    }

    return { ok: true, state: cloneState(room) };
  }

  return {
    create(
      user: UserContext,
      configPatch: RoomConfigPatch,
      now: number
    ): RoomResult {
      if (user.kind === "guest") {
        return { ok: false, error: "GUEST_CANNOT_CREATE" };
      }

      for (const room of rooms.values()) {
        if (room.participants.some((p) => p.userId === user.id)) {
          return { ok: false, error: "ALREADY_IN_ROOM" };
        }
      }

      const code = generateUniqueRoomCode((c) => rooms.has(c));
      const state: RoomState = {
        code,
        status: "waiting",
        hostId: user.id,
        config: { ...DEFAULT_ROOM_CONFIG, ...configPatch },
        participants: [
          {
            userId: user.id,
            displayName: user.displayName,
            kind: user.kind,
            role: "runner",
            connected: true,
            joinedAt: now,
          },
        ],
        maxRunners: MAX_RUNNERS,
      };

      rooms.set(code, cloneState(state));
      return { ok: true, state: cloneState(state) };
    },

    join(
      user: UserContext,
      code: string,
      role: ParticipantRole,
      now: number
    ): RoomResult {
      const currentRoomCode = this.roomOf(user.id);
      if (currentRoomCode && currentRoomCode !== code) {
        return { ok: false, error: "ALREADY_IN_ROOM" };
      }

      const room = rooms.get(code);
      if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };

      const existingParticipant = room.participants.find(
        (p) => p.userId === user.id
      );
      if (existingParticipant) {
        existingParticipant.connected = true;
        return { ok: true, state: cloneState(room) };
      }

      if (role === "runner") {
        const runnersCount = room.participants.filter(
          (p) => p.role === "runner"
        ).length;
        if (runnersCount >= room.maxRunners) {
          return { ok: false, error: "ROOM_FULL" };
        }
      }

      room.participants.push({
        userId: user.id,
        displayName: user.displayName,
        kind: user.kind,
        role,
        connected: true,
        joinedAt: now,
      });

      return { ok: true, state: cloneState(room) };
    },

    updateConfig(
      userId: string,
      code: string,
      patch: RoomConfigPatch
    ): RoomResult {
      const room = rooms.get(code);
      if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };

      const p = room.participants.find((p) => p.userId === userId);
      if (!p) return { ok: false, error: "NOT_IN_ROOM" };
      if (room.hostId !== userId) return { ok: false, error: "NOT_HOST" };

      room.config = { ...room.config, ...patch };
      return { ok: true, state: cloneState(room) };
    },

    leave(userId: string, code: string): RoomResult {
      return removeParticipant(code, userId);
    },

    disconnect(userId: string, code: string): RoomResult {
      const room = rooms.get(code);
      if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };

      const p = room.participants.find((p) => p.userId === userId);
      if (!p) return { ok: false, error: "NOT_IN_ROOM" };

      p.connected = false;
      return { ok: true, state: cloneState(room) };
    },

    reconnect(userId: string, code: string): RoomResult {
      const room = rooms.get(code);
      if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };

      const p = room.participants.find((p) => p.userId === userId);
      if (!p) return { ok: false, error: "NOT_IN_ROOM" };

      p.connected = true;
      return { ok: true, state: cloneState(room) };
    },

    expire(userId: string, code: string): RoomResult {
      return removeParticipant(code, userId);
    },

    get(code: string): RoomState | null {
      const room = rooms.get(code);
      return room ? cloneState(room) : null;
    },

    roomOf(userId: string): string | null {
      for (const [code, room] of rooms.entries()) {
        if (room.participants.some((p) => p.userId === userId)) {
          return code;
        }
      }
      return null;
    },
  };
}
