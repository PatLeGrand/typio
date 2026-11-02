// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAuthLimiters } from "@/auth/rateLimit";
import { createDatabaseClient } from "@/db/client";
import { userAvatars, users } from "@/db/schema";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getDb: vi.fn() }));
vi.mock("@/auth/currentUser", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/auth/deps", () => ({ getAuthDeps: () => ({ limiters: createAuthLimiters() }) }));
vi.mock("@/db/shared", () => ({ getDb: mocks.getDb }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { uploadAvatar, removeAvatar } from "@/app/[lang]/(site)/profile/avatarActions";
import { GET } from "@/app/api/avatars/[userId]/route";

describe.skipIf(!process.env.DATABASE_URL)("avatar PostgreSQL lifecycle", () => {
  let client: ReturnType<typeof createDatabaseClient>;
  let created = false;
  const id = randomUUID();

  beforeAll(async () => {
    client = createDatabaseClient();
    await migrate(client.db, { migrationsFolder: "./drizzle" });
    await client.db.insert(users).values({ id, kind: "member", username: `av${id.replaceAll("-", "").slice(0, 12)}`, displayName: "Avatar" });
    created = true;
    mocks.getDb.mockReturnValue(client.db);
    mocks.getCurrentUser.mockResolvedValue({ id, kind: "member", locale: "fr" });
  });

  afterAll(async () => {
    try {
      if (created) await client.db.delete(users).where(eq(users.id, id));
    } finally {
      await client.close();
    }
  });

  const get = (version: number) => GET(new Request(`http://localhost/api/avatars/${id}?v=${version}`), {
    params: Promise.resolve({ userId: id }),
  });
  const upload = async (format: "png" | "jpeg") => {
    const bytes = await sharp({ create: { width: 300, height: 150, channels: 3, background: "blue" } }).toFormat(format).toBuffer();
    const data = new FormData();
    data.set("avatar", new File([new Uint8Array(bytes)], `photo.${format}`));
    const result = await uploadAvatar(data);
    expect(result.ok).toBe(true);
    if (!result.ok || result.version === null) throw new Error("Upload failed");
    return result.version;
  };

  it("téléverse, sert, remplace, retire et remet une photo sans réutiliser une URL", async () => {
    const first = await upload("png");
    const response = await get(first);
    expect(response.status).toBe(200);
    expect(await sharp(Buffer.from(await response.arrayBuffer())).metadata()).toMatchObject({ format: "webp", width: 256, height: 256 });
    const second = await upload("jpeg");
    expect(second).toBeGreaterThan(first);
    expect((await get(first)).status).toBe(404);
    expect((await get(second)).status).toBe(200);
    expect(await removeAvatar()).toEqual({ ok: true, version: null });
    expect(await client.db.select().from(userAvatars).where(eq(userAvatars.userId, id))).toHaveLength(0);
    expect((await client.db.select().from(users).where(eq(users.id, id)))[0].avatarVersion).toBeNull();
    expect((await get(second)).status).toBe(404);
    const third = await upload("png");
    expect(third).toBeGreaterThan(second);
    await client.db.delete(users).where(eq(users.id, id));
    expect(await client.db.select().from(userAvatars).where(eq(userAvatars.userId, id))).toHaveLength(0);
  });
});
