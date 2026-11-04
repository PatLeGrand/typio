/** SALLE-06 : la clé primaire user_id réserve une seule salle par personne. */
export interface RoomMembershipRepository {
  reserve(userId: string, roomCode: string, joinedAt: Date): Promise<boolean>;
  release(userId: string, roomCode: string): Promise<void>;
  releaseAny(userId: string): Promise<void>;
  clear(): Promise<void>;
}

export function createMemoryRoomMembershipRepository(): RoomMembershipRepository {
  const memberships = new Map<string, string>();
  return {
    async reserve(userId, roomCode) {
      if (memberships.has(userId)) return false;
      memberships.set(userId, roomCode);
      return true;
    },
    async release(userId, roomCode) {
      if (memberships.get(userId) === roomCode) memberships.delete(userId);
    },
    async releaseAny(userId) { memberships.delete(userId); },
    async clear() { memberships.clear(); },
  };
}
