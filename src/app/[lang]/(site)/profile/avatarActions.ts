"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/auth/currentUser";
import { getAuthDeps } from "@/auth/deps";
import { describeError } from "@/auth/errors";
import { getDb } from "@/db/shared";
import { userAvatars, users } from "@/db/schema";
import { prefixWithLocale } from "@/i18n/paths";
import { MAX_AVATAR_BYTES, type AvatarResult } from "@/profile/avatar";
import { processAvatarImage } from "@/profile/avatarImage";

const avatarFileSchema = z.instanceof(File);

export async function uploadAvatar(formData: FormData): Promise<AvatarResult> {
  try {
    const user = await getCurrentUser();
    if (!user || user.kind !== "member") return { ok: false, code: "UNAUTHORIZED" };
    if (!getAuthDeps().limiters.avatarUploads.consume(user.id)) return { ok: false, code: "RATE_LIMITED" };

    const parsed = avatarFileSchema.safeParse(formData.get("avatar"));
    if (!parsed.success) return { ok: false, code: "INVALID_IMAGE" };
    // Avant lecture en mémoire et surtout avant décodage.
    if (parsed.data.size > MAX_AVATAR_BYTES) return { ok: false, code: "TOO_LARGE" };
    const processed = await processAvatarImage(Buffer.from(await parsed.data.arrayBuffer()));
    if (!processed.ok) return processed;

    const version = await getDb().transaction(async (tx) => {
      // Le verrou sur users sérialise téléversements et retraits concurrents.
      const [updated] = await tx.update(users).set({ avatarVersion: sql`nextval('avatar_version_seq')` })
        .where(eq(users.id, user.id)).returning({ version: users.avatarVersion });
      if (!updated) throw new Error("Missing avatar owner");
      await tx.insert(userAvatars).values({ userId: user.id, image: processed.image })
        .onConflictDoUpdate({ target: userAvatars.userId, set: { image: processed.image, updatedAt: new Date() } });
      return updated.version;
    });
    revalidatePath(prefixWithLocale("/profile", user.locale));
    return { ok: true, version };
  } catch (error) {
    console.error("[profile] uploadAvatar failed", describeError(error));
    return { ok: false, code: "UNKNOWN" };
  }
}

export async function removeAvatar(): Promise<AvatarResult> {
  try {
    const user = await getCurrentUser();
    if (!user || user.kind !== "member") return { ok: false, code: "UNAUTHORIZED" };
    if (!getAuthDeps().limiters.profileUpdates.consume(user.id)) return { ok: false, code: "RATE_LIMITED" };
    await getDb().transaction(async (tx) => {
      await tx.update(users).set({ avatarVersion: null }).where(eq(users.id, user.id));
      await tx.delete(userAvatars).where(eq(userAvatars.userId, user.id));
    });
    revalidatePath(prefixWithLocale("/profile", user.locale));
    return { ok: true, version: null };
  } catch (error) {
    console.error("[profile] removeAvatar failed", describeError(error));
    return { ok: false, code: "UNKNOWN" };
  }
}
