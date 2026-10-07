"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/auth/currentUser";
import { getDb } from "@/db/shared";
import { users } from "@/db/schema";
import { prefixWithLocale } from "@/i18n/paths";
import { z } from "zod";
import type { Locale } from "@/i18n/config";

const profileSchema = z.object({
  displayName: z.string().min(1).max(40),
  keyboardLayout: z.enum(["qwerty", "azerty", "canadian"]),
  locale: z.enum(["fr", "en"]),
});

export async function updateProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", code: "UNAUTHORIZED" };
  }

  const result = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    keyboardLayout: formData.get("keyboardLayout"),
    locale: formData.get("locale"),
  });

  if (!result.success) {
    return { status: "error", code: "INVALID_DATA" };
  }

  const { displayName, keyboardLayout, locale } = result.data;

  await getDb().update(users)
    .set({ 
      displayName, 
      keyboardLayout, 
      locale: locale as Locale 
    })
    .where(eq(users.id, user.id));

  revalidatePath(prefixWithLocale("/profile", user.locale));
  if (user.locale !== locale) {
    revalidatePath(prefixWithLocale("/profile", locale as Locale));
  }

  return { status: "success", data: { locale } };
}
