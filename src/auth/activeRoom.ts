import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/shared";
import { roomMemberships } from "@/db/schema";
import { getCurrentUserForDisplay } from "./currentUser";
import { describeError } from "./errors";

/** Rappel d'affichage uniquement : ne lit que la réservation de la session courante. */
export async function getActiveRoomCode(): Promise<string | null> {
  const user = await getCurrentUserForDisplay();
  if (!user) return null;
  try {
    const [membership] = await getDb().select({ code: roomMemberships.roomCode })
      .from(roomMemberships).where(eq(roomMemberships.userId, user.id)).limit(1);
    return membership?.code ?? null;
  } catch (error) {
    console.error("[room] getActiveRoomCode failed", describeError(error));
    return null;
  }
}
