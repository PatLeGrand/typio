"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/auth/currentUser";
import { getAuthDeps } from "@/auth/deps";
import { describeError } from "@/auth/errors";
import { prefixWithLocale } from "@/i18n/paths";
import { saveBlobStyle } from "@/profile/blobStyleRepository";
import { parseBlobStyle, type BlobStyle } from "@/race/blobStyle";

export type BlobStyleErrorCode =
  | "UNAUTHORIZED"
  | "DEMO_READ_ONLY"
  | "RATE_LIMITED"
  | "INVALID_STYLE"
  | "UNKNOWN";

export type BlobStyleSaveResult =
  | { ok: true; style: BlobStyle }
  | { ok: false; code: BlobStyleErrorCode };

/**
 * Enregistre le style personnalisé du blob de course pour l'utilisateur connecté.
 * L'identité provient uniquement de la session, jamais du formulaire.
 */
export async function updateBlobStyle(formData: FormData): Promise<BlobStyleSaveResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, code: "UNAUTHORIZED" };
    if (user.isDemo) return { ok: false, code: "DEMO_READ_ONLY" };

    if (!getAuthDeps().limiters.profileUpdates.consume(user.id)) {
      return { ok: false, code: "RATE_LIMITED" };
    }

    const style = parseBlobStyle({
      color: formData.get("color"),
      glasses: formData.get("glasses"),
      hat: formData.get("hat"),
    });
    if (!style) return { ok: false, code: "INVALID_STYLE" };

    await saveBlobStyle(user.id, style);
    revalidatePath(prefixWithLocale("/profile", user.locale));

    return { ok: true, style };
  } catch (error) {
    console.error("[profile] updateBlobStyle failed", describeError(error));
    return { ok: false, code: "UNKNOWN" };
  }
}
