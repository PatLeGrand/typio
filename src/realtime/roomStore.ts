import { randomBytes } from "node:crypto";
import { generateToken, hashToken } from "@/auth/token";
import type { NewRace, NewRaceResult } from "@/race/raceRepository";
import { startRace, applyInput, abandonRace, setRunnerConnected, expireRunner, tickRace, raceSnapshot, raceResults, raceResultRows, type RaceState } from "./raceEngine";
import {
  DEFAULT_ROOM_CONFIG,
  MAX_INVITES_PER_ROOM,
  type InviteInfo,
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
 * Lien d'invitation en mémoire (SALLE-04) : indexé par le SHA-256 du jeton, qui n'est jamais
 * gardé. Disparaît avec la salle.
 */
interface Invite {
  id: string;
  createdAt: number;
  /** Première personne à l'avoir utilisé, avec la clé de son IP ; `null` tant qu'il est neuf. */
  usedBy: { userId: string; displayName: string; ip: string } | null;
  revoked: boolean;
}

/** Salle telle que le registre la garde : `RoomState` plus ce qui ne doit jamais être diffusé. */
interface StoredRoom extends RoomState {
  race: RaceState | null;
  createdAt: number;
  /** Hachage du jeton → lien (SALLE-04). */
  invites: Map<string, Invite>;
  /** Expulsés de cette salle, sans retour possible (SALLE-07). Pas de bannissement par IP. */
  banned: Set<string>;
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
  /** Tirage d'un jeton d'invitation ; injectable pour les tests (SALLE-04). */
  generateInviteToken?: () => string;
  now?: () => number;
}

export function createRoomStore(options: RoomStoreOptions = {}) {
  const generateCode = options.generateCode ?? generateRoomCode;
  const now = options.now ?? Date.now;
  const generateSeed = options.generateSeed ?? (() => randomBytes(4).readUInt32LE());
  const generateInviteToken = options.generateInviteToken ?? generateToken;
  const rooms = new Map<string, StoredRoom>();
  /** Hachage du jeton → code de la salle ; le jeton seul retrouve sa salle (SALLE-04). */
  const inviteRooms = new Map<string, string>();
  const recordings: { race: NewRace; rows: NewRaceResult[] }[] = [];

  function saveRace(room: StoredRoom, race: RaceState): void {
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

  /** Supprime la salle : tous ses liens d'invitation deviennent invalides (SALLE-04). */
  function dropRoom(room: StoredRoom): void {
    for (const hash of room.invites.keys()) inviteRooms.delete(hash);
    rooms.delete(room.code);
  }

  function toInfo(invite: Invite): InviteInfo {
    return {
      id: invite.id,
      createdAt: invite.createdAt,
      status: invite.revoked ? "revoked" : invite.usedBy ? "used" : "unused",
      usedBy: invite.usedBy?.displayName ?? null,
    };
  }

  /**
   * Entrée dans une salle, par code (`invited` faux) ou par lien (`invited` vrai : la
   * visibilité privée ne bloque plus). SALLE-06, SALLE-09, SALLE-05 et SALLE-07 s'appliquent aux deux.
   */
  function enter(user: UserContext, code: string, role: ParticipantRole, now: number, invited: boolean): RoomResult {
    const currentRoomCode = roomOf(user.id);
    if (currentRoomCode && currentRoomCode !== code) {
      return { ok: false, error: "ALREADY_IN_ROOM" };
    }

    const room = rooms.get(code);
    if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };

    // SALLE-07 : un expulsé ne revient pas, ni par code, ni par lien.
    if (room.banned.has(user.id)) return { ok: false, error: "KICKED" };

    const existingParticipant = room.participants.find(
      (p) => p.userId === user.id
    );
    if (existingParticipant) {
      if (room.race) saveRace(room, setRunnerConnected(room.race, user.id, true, now));
      existingParticipant.connected = true;
      return { ok: true, state: cloneState(room) };
    }

    // SALLE-03 : le code seul ne suffit pas pour une salle privée, il faut un lien (SALLE-04).
    if (room.config.visibility === "private" && !invited) return { ok: false, error: "INVITE_REQUIRED" };

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
      dropRoom(room);
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

      rooms.set(code, { ...cloneState(state), race: null, createdAt: now, invites: new Map(), banned: new Set() });
      roomByUser.set(user.id, code);
      return { ok: true, state: cloneState(state) };
    },

    join(
      user: UserContext,
      code: string,
      role: ParticipantRole,
      now: number
    ): RoomResult {
      return enter(user, code, role, now, false);
    },

    /**
     * Crée un lien (SALLE-04), hôte seulement. Le jeton en clair n'est renvoyé qu'ici ; le registre
     * ne garde que son hachage.
     */
    createInvite(userId: string, code: string): { ok: true; id: string; token: string } | { ok: false; error: RoomErrorCode } {
      const room = rooms.get(code);
      if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };
      if (!room.participants.some((p) => p.userId === userId)) return { ok: false, error: "NOT_IN_ROOM" };
      if (room.hostId !== userId) return { ok: false, error: "NOT_HOST" };
      if (room.invites.size >= MAX_INVITES_PER_ROOM) return { ok: false, error: "INVITE_LIMIT" };

      const token = generateInviteToken();
      const hash = hashToken(token);
      const invite: Invite = { id: randomBytes(8).toString("hex"), createdAt: now(), usedBy: null, revoked: false };
      room.invites.set(hash, invite);
      inviteRooms.set(hash, code);
      return { ok: true, id: invite.id, token };
    },

    /** Liens de la salle pour son hôte, ou `null` si `userId` n'est pas l'hôte (SALLE-04, SALLE-08). */
    invites(userId: string, code: string): InviteInfo[] | null {
      const room = rooms.get(code);
      if (!room || room.hostId !== userId) return null;
      return [...room.invites.values()].map(toInfo);
    },

    /**
     * Entrée par lien (SALLE-04). Un seul refus, `INVITE_INVALID`, pour jeton inconnu, révoqué ou
     * pris par quelqu'un d'autre ou depuis une autre IP : aucun oracle. À la première utilisation
     * réussie, le lien est lié à la personne et à son IP.
     */
    joinInvite(user: UserContext, token: string, role: ParticipantRole, ip: string, now: number): RoomResult {
      const hash = hashToken(token);
      const code = inviteRooms.get(hash);
      const room = code === undefined ? undefined : rooms.get(code);
      const invite = room?.invites.get(hash);
      if (!room || !invite) return { ok: false, error: "INVITE_INVALID" };
      if (room.banned.has(user.id)) return { ok: false, error: "KICKED" };
      if (invite.revoked) return { ok: false, error: "INVITE_INVALID" };
      if (invite.usedBy && (invite.usedBy.userId !== user.id || invite.usedBy.ip !== ip)) {
        return { ok: false, error: "INVITE_INVALID" };
      }

      const res = enter(user, room.code, role, now, true);
      if (res.ok && !invite.usedBy) invite.usedBy = { userId: user.id, displayName: user.displayName, ip };
      return res;
    },

    /**
     * Expulsion (SALLE-07), hôte seulement, en attente, au décompte, en course ou aux résultats : la
     * personne est retirée comme si elle partait (abandon en course), bannie de la salle, et son
     * lien est révoqué (SALLE-04).
     */
    kick(hostId: string, code: string, targetId: string): RoomResult {
      const room = rooms.get(code);
      if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };
      if (!room.participants.some((p) => p.userId === hostId)) return { ok: false, error: "NOT_IN_ROOM" };
      if (room.hostId !== hostId) return { ok: false, error: "NOT_HOST" };
      if (targetId === hostId) return { ok: false, error: "INVALID_PAYLOAD" };
      if (!room.participants.some((p) => p.userId === targetId)) return { ok: false, error: "NOT_IN_ROOM" };

      const res = removeParticipant(code, targetId);
      if (!res.ok) return res;
      room.banned.add(targetId);
      for (const invite of room.invites.values()) {
        if (invite.usedBy?.userId === targetId) invite.revoked = true;
      }
      return res;
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
        dropRoom(room);
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
    quickJoinCode(userId: string): string | null {
      // SALLE-07 : une salle qui a expulsé cette personne n'est jamais son choix.
      const entries = lobbyEntries().filter((entry) => !rooms.get(entry.room.code)?.banned.has(userId));
      return pickQuickJoin(entries)?.room.code ?? null;
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
