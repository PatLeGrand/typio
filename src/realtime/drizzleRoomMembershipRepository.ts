import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { roomMemberships } from "@/db/schema";
import type { RoomMembershipRepository } from "./roomMembershipRepository";

export function createDrizzleRoomMembershipRepository(db: PostgresJsDatabase): RoomMembershipRepository {
  return {
    async reserve(userId, roomCode, joinedAt) {
      const rows = await db.insert(roomMemberships).values({ userId, roomCode, joinedAt })
        .onConflictDoNothing({ target: roomMemberships.userId }).returning({ userId: roomMemberships.userId });
      return rows.length === 1;
    },
    async release(userId, roomCode) {
      await db.delete(roomMemberships).where(and(eq(roomMemberships.userId, userId), eq(roomMemberships.roomCode, roomCode)));
    },
    async releaseAny(userId) {
      await db.delete(roomMemberships).where(eq(roomMemberships.userId, userId));
    },
    async clear() { await db.delete(roomMemberships); },
  };
}
