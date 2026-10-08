import {
  DEFAULT_ROOM_CONFIG,
  MAX_RUNNERS,
  type ParticipantRole,
  type RoomConfigPatch,
  type RoomErrorCode,
  type RoomState,
  type RoomStatus,
} from "./protocol";
import { generateRoomCode, generateUniqueRoomCode } from "./roomCode";

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

/**
 * Plafond de spectateurs par salle. Le protocole ne plafonne que les coureurs (H-16) ; sans
 * borne, un client pourrait remplir la mémoire du service de spectateurs, et chaque
 * `room:state` grossirait avec eux. Règle du serveur, hors du contrat.
 */
export const MAX_SPECTATORS = 20;

export interface RoomStoreOptions {
  /** Tirage d'un code candidat ; injectable pour tester la collision (AC-10). */
  generateCode?: () => string;
}

export function createRoomStore(options: RoomStoreOptions = {}) {
  const generateCode = options.generateCode ?? generateRoomCode;
  const rooms = new Map<string, RoomState>();
  /** Index utilisateur → code de sa salle. Tenu à jour par `create`, `join` et `removeParticipant`, seuls à changer les participants. */
  const roomByUser = new Map<string, string>();

  /** Code de la salle où se trouve l'utilisateur, ou `null`. */
  function roomOf(userId: string): string | null {
    return roomByUser.get(userId) ?? null;
  }

  function removeParticipant(roomCode: string, userId: string): RoomResult {
    const room = rooms.get(roomCode);
    if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };

    const index = room.participants.findIndex((p) => p.userId === userId);
    if (index === -1) return { ok: false, error: "NOT_IN_ROOM" };

    room.participants.splice(index, 1);
    roomByUser.delete(userId);

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

      if (roomOf(user.id)) return { ok: false, error: "ALREADY_IN_ROOM" };

      const code = generateUniqueRoomCode((c) => rooms.has(c), generateCode);
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
      roomByUser.set(user.id, code);
      return { ok: true, state: cloneState(state) };
    },

    join(
      user: UserContext,
      code: string,
      role: ParticipantRole,
      now: number
    ): RoomResult {
      const currentRoomCode = roomOf(user.id);
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
      } else {
        const spectatorsCount = room.participants.filter((p) => p.role === "spectator").length;
        if (spectatorsCount >= MAX_SPECTATORS) return { ok: false, error: "ROOM_FULL" };
      }

      roomByUser.set(user.id, code);
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
      if (room.status !== "waiting") return { ok: false, error: "CONFIG_LOCKED" };

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

    roomOf,

    /**
     * Change le statut d'une salle. Au checkpoint 1 rien ne l'appelle hors tests : la course
     * (COURSE-*) s'en servira ; il permet déjà de vérifier que la config se verrouille.
     */
    setStatus(code: string, status: RoomStatus): RoomResult {
      const room = rooms.get(code);
      if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };
      room.status = status;
      return { ok: true, state: cloneState(room) };
    },
  };
}
