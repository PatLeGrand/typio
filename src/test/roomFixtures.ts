import { DEFAULT_ROOM_CONFIG, type Participant, type RoomState } from "@/realtime/protocol";
import type { UseRoom } from "@/realtime/useRoom";

export const ME = "11111111-1111-1111-1111-111111111111";
export const OTHER = "22222222-2222-2222-2222-222222222222";

export function makeParticipant(userId: string, overrides: Partial<Participant> = {}): Participant {
  return {
    userId,
    displayName: userId === ME ? "Alice" : "Bob",
    kind: "member",
    avatarVersion: null,
    role: "runner",
    connected: true,
    joinedAt: 1,
    ...overrides,
  };
}

/** Salle d'attente de `ABC234`, hôte = premier de la liste. */
export function makeRoom(participants: Participant[], overrides: Partial<RoomState> = {}): RoomState {
  return {
    code: "ABC234",
    status: "waiting",
    hostId: participants[0]?.userId ?? ME,
    config: DEFAULT_ROOM_CONFIG,
    participants,
    ...overrides,
  };
}

/** Faux retour de `useRoom` : connecté, hors salle, actions espionnées (à surcharger au besoin). */
export function makeUseRoom(overrides: Partial<UseRoom> = {}): UseRoom {
  return {
    connection: "connected",
    room: null,
    race: null,
    results: null,
    self: null,
    raceReceivedAt: null,
    lobby: null,
    invites: [],
    kicked: false,
    error: null,
    create: async () => ({ ok: true, data: { code: "ABC234" } }),
    join: async () => ({ ok: true, data: { code: "ABC234" } }),
    joinInvite: async () => ({ ok: true, data: { code: "ABC234" } }),
    createInvite: async () => ({ ok: true, data: { id: "invite-1", token: "T".repeat(43) } }),
    kick: async () => ({ ok: true, data: undefined }),
    quickJoin: async () => ({ ok: true, data: { code: "ABC234" } }),
    subscribeLobby: () => undefined,
    unsubscribeLobby: () => undefined,
    updateConfig: async () => ({ ok: true, data: undefined }),
    startRace: async () => ({ ok: true, data: undefined }),
    abandonRace: async () => ({ ok: true, data: undefined }),
    restartRace: async () => ({ ok: true, data: undefined }),
    closeRoom: async () => ({ ok: true, data: undefined }),
    sendInput: () => undefined,
    leave: async () => ({ ok: true, data: undefined }),
    clearError: () => undefined,
    ...overrides,
  };
}
