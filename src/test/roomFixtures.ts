import { DEFAULT_ROOM_CONFIG, MAX_RUNNERS, type Participant, type RoomState } from "@/realtime/protocol";
import type { UseRoom } from "@/realtime/useRoom";

export const ME = "11111111-1111-1111-1111-111111111111";
export const OTHER = "22222222-2222-2222-2222-222222222222";

export function makeParticipant(userId: string, overrides: Partial<Participant> = {}): Participant {
  return {
    userId,
    displayName: userId === ME ? "Alice" : "Bob",
    kind: "member",
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
    maxRunners: MAX_RUNNERS,
    ...overrides,
  };
}

/** Faux retour de `useRoom` : connecté, hors salle, actions espionnées (à surcharger au besoin). */
export function makeUseRoom(overrides: Partial<UseRoom> = {}): UseRoom {
  return {
    connection: "connected",
    room: null,
    error: null,
    create: async () => ({ ok: true, data: { code: "ABC234" } }),
    join: async () => ({ ok: true, data: { code: "ABC234" } }),
    updateConfig: async () => ({ ok: true, data: undefined }),
    leave: async () => ({ ok: true, data: undefined }),
    clearError: () => undefined,
    ...overrides,
  };
}
