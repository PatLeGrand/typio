import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { users } from "@/db/schema";
import { getDb } from "@/db/shared";
import { DEFAULT_BLOB_STYLE, parseBlobStyle, type BlobStyle } from "@/race/blobStyle";

export async function getBlobStyle(userId: string, db: PostgresJsDatabase = getDb()): Promise<BlobStyle> {
  const [row] = await db.select({ style: users.blobStyle }).from(users).where(eq(users.id, userId));
  return parseBlobStyle(row?.style) ?? DEFAULT_BLOB_STYLE;
}

export async function saveBlobStyle(userId: string, style: BlobStyle, db?: PostgresJsDatabase): Promise<void> {
  const parsed = parseBlobStyle(style);
  if (!parsed) throw new TypeError("Invalid blob style");

  // Les invités ont eux aussi une ligne users. Seuls les comptes démo sont en lecture seule.
  const updated = await (db ?? getDb()).update(users).set({ blobStyle: parsed })
    .where(and(eq(users.id, userId), eq(users.isDemo, false)))
    .returning({ id: users.id });
  if (updated.length === 0) throw new Error("Account not found or read-only");
}
