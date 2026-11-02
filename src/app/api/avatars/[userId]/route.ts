import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/auth/currentUser";
import { describeError } from "@/auth/errors";
import { getDb } from "@/db/shared";
import { userAvatars, users } from "@/db/schema";

const paramsSchema = z.object({ userId: z.uuid() });
const versionSchema = z.string().regex(/^[1-9]\d*$/).pipe(z.coerce.number<string>().int().max(2_147_483_647)).nullable();

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    if (!await getCurrentUser()) return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });
    const parsed = paramsSchema.safeParse(await params);
    const version = versionSchema.safeParse(new URL(request.url).searchParams.get("v"));
    if (!parsed.success || !version.success) return new Response(null, { status: 400 });

    const [avatar] = await getDb().select({ image: userAvatars.image }).from(userAvatars)
      .innerJoin(users, eq(userAvatars.userId, users.id))
      .where(and(eq(userAvatars.userId, parsed.data.userId),
        version.data === null ? isNotNull(users.avatarVersion) : eq(users.avatarVersion, version.data)));
    if (!avatar) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    return new Response(new Uint8Array(avatar.image), {
      headers: {
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": version.data === null ? "no-store" : "private, max-age=31536000, immutable",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    console.error("[profile] avatar GET failed", describeError(error));
    return new Response(null, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
