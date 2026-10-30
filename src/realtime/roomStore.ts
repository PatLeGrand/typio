import { randomBytes } from "node:crypto";
import type { NewRace, NewRaceResult } from "@/race/raceRepository";
import { startRace, applyInput, abandonRace, setRunnerConnected, expireRunner, tickRace, raceSnapshot, raceResults, raceResultRows, type RaceState } from "./raceEngine";
import {
  DEFAULT_ROOM_CONFIG,
  type ParticipantRole,
  type RoomConfigPatch,
  type RoomErrorCode,
  type RoomState,
  type RoomStatus,
} from "./protocol";
import { lobbyRooms, pickQuickJoin, toLobbyEntry, type LobbyEntry } from "./lobby";
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
    code: state.code,
    status: state.status,
    hostId: state.hostId,
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
  generateSeed?: () => number;
  now?: () => number;
}

export function createRoomStore(options: RoomStoreOptions = {}) {
  const generateCode = options.generateCode ?? generateRoomCode;
  const now = options.now ?? Date.now;
  const generateSeed = options.generateSeed ?? (() => randomBytes(4).readUInt32LE());
  const rooms = new Map<string, RoomState & { race: RaceState | null; createdAt: number }>();
  const recordings: { race: NewRace; rows: NewRaceResult[] }[] = [];

  function saveRace(room: RoomState & { race: RaceState | null; createdAt: number }, race: RaceState): void {
    if (race.status === "results" && room.race?.status !== "results" && race.endedAt !== null) {
      const rows = raceResultRows(race);
      if (rows.length > 0) recordings.push({
        race: { roomCode: room.code, hostId: race.hostId, config: { ...race.config }, text: race.text,
          participantCount: race.runners.length, startedAt: new Date(race.startAt), endedAt: new Date(race.endedAt) },
        rows,
      });
    }
    room.race = race;
    room.status = race.status;
  }
  /** Nombre de coureurs humains et de bots : ce que la capacité compte (SALLE-05). */
  function runnerSlots(room: RoomState): number {
    return room.participants.filter((p) => p.role === "runner").length + room.config.botCount;
  }

  /** Salles publiques non fermées avec leur ancienneté (JOIN-02, JOIN-03). */
  function lobbyEntries(): LobbyEntry[] {
    const entries: LobbyEntry[] = [];
    for (const room of rooms.values()) {
      const entry = toLobbyEntry(room, room.createdAt);
      if (entry) entries.push(entry);
    }
    return entries;
  }

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

    if (room.race) saveRace(room, abandonRace(room.race, userId, now()));
    room.participants.splice(index, 1);
    roomByUser.delete(userId);

    if (room.participants.length === 0) {
      if (room.race && room.race.status !== "results") {
        const endedAt = now();
        saveRace(room, { ...room.race, status: "results", endedAt,
          runners: room.race.runners.map((r) => r.kind === "human" && (r.status === "ready" || r.status === "typing")
            ? { ...r, status: "abandoned", abandonedAt: endedAt, lastActivityAt: endedAt } : r),
        });
      }
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
      role: ParticipantRole,
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
            role,
            connected: true,
            joinedAt: now,
          },
        ],
      };
      if (runnerSlots(state) > state.config.capacity) return { ok: false, error: "ROOM_FULL" };

      rooms.set(code, { ...cloneState(state), race: null, createdAt: now });
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
        if (room.race) saveRace(room, setRunnerConnected(room.race, user.id, true, now));
        existingParticipant.connected = true;
        return { ok: true, state: cloneState(room) };
      }

      // SALLE-03 : le code seul ne suffit pas pour une salle privée (les liens viendront avec SALLE-04).
      if (room.config.visibility === "private") return { ok: false, error: "INVITE_REQUIRED" };

      if (room.status === "countdown" || room.status === "racing") {
        return { ok: false, error: "RACE_IN_PROGRESS" };
      }

      if (role === "runner") {
        if (runnerSlots(room) >= room.config.capacity) {
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

      // SALLE-05 : ni la capacité sous les coureurs et bots présents, ni des bots au-delà de la capacité.
      const config = { ...room.config, ...patch };
      if (runnerSlots({ ...room, config }) > config.capacity) return { ok: false, error: "ROOM_FULL" };

      room.config = config;
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
      if (room.race) saveRace(room, setRunnerConnected(room.race, userId, false, now()));
      return { ok: true, state: cloneState(room) };
    },

    reconnect(userId: string, code: string): RoomResult {
      const room = rooms.get(code);
      if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };

      const p = room.participants.find((p) => p.userId === userId);
      if (!p) return { ok: false, error: "NOT_IN_ROOM" };

      p.connected = true;
      if (room.race) saveRace(room, setRunnerConnected(room.race, userId, true, now()));
      return { ok: true, state: cloneState(room) };
    },

    expire(userId: string, code: string): RoomResult {
      const room = rooms.get(code);
      if (room?.race) saveRace(room, expireRunner(room.race, userId, now()));
      return removeParticipant(code, userId);
    },

    get(code: string): RoomState | null {
      const room = rooms.get(code);
      return room ? cloneState(room) : null;
    },

    start(userId: string, code: string): RoomResult {
      const room = rooms.get(code);
      if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };
      const result = startRace(room, userId, now(), generateSeed());
      if (!result.ok) return result;
      saveRace(room, result.state);
      return { ok: true, state: cloneState(room) };
    },

    input(userId: string, code: string, ops: string[]): RoomResult {
      const room = rooms.get(code);
      if (!room?.race) return { ok: false, error: "RACE_NOT_RUNNING" };
      const result = applyInput(room.race, userId, ops, now());
      saveRace(room, result.state);
      return result.ok ? { ok: true, state: cloneState(room) } : { ok: false, error: result.error };
    },

    abandon(userId: string, code: string): RoomResult {
      const room = rooms.get(code);
      if (!room?.race || room.status === "results") return { ok: false, error: "RACE_NOT_RUNNING" };
      if (!room.race.runners.some((r) => r.id === userId && r.kind === "human")) {
        return { ok: false, error: "INPUT_REJECTED" };
      }
      saveRace(room, abandonRace(room.race, userId, now()));
      return { ok: true, state: cloneState(room) };
    },

    finish(userId: string, code: string, close: boolean): RoomResult {
      const room = rooms.get(code);
      if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };
      if (room.hostId !== userId) return { ok: false, error: "NOT_HOST" };
      if (room.status !== "results") return { ok: false, error: "RACE_NOT_ALLOWED" };
      room.race = null;
      room.status = close ? "closed" : "waiting";
      if (close) {
        for (const p of room.participants) roomByUser.delete(p.userId);
        rooms.delete(code);
      }
      return { ok: true, state: cloneState(room) };
    },

    tick(code: string): RoomState | null {
      const room = rooms.get(code);
      if (!room) return null;
      if (room.race) saveRace(room, tickRace(room.race, now()));
      return cloneState(room);
    },

    snapshot(code: string) {
      const room = rooms.get(code);
      if (!room?.race) return null;
      const at = now();
      const race = tickRace(room.race, at);
      saveRace(room, race);
      return raceSnapshot(race, at);
    },

    takeRecordings() {
      return recordings.splice(0);
    },

    results(code: string) {
      const race = rooms.get(code)?.race;
      return race ? raceResults(race) : null;
    },

    self(code: string, userId: string) {
      const runner = rooms.get(code)?.race?.runners.find((r) => r.id === userId && r.kind === "human");
      return runner ? { typed: runner.typed, keystrokes: { ...runner.keystrokes } } : null;
    },

    roomOf,

    /** Liste de l'explorateur (JOIN-02). */
    lobby() {
      return lobbyRooms(lobbyEntries());
    },

    /** Code de la salle que la partie rapide choisit (JOIN-03), ou `null` s'il n'y en a aucune. */
    quickJoinCode(): string | null {
      return pickQuickJoin(lobbyEntries())?.room.code ?? null;
    },

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
