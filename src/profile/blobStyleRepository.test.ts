// @vitest-environment node
import { drizzle } from "drizzle-orm/postgres-js";
import { beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_BLOB_STYLE, type BlobStyle } from "@/race/blobStyle";
import { getBlobStyle, saveBlobStyle } from "./blobStyleRepository";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/db/shared", () => ({ getDb }));

const db = drizzle.mock();
const query = vi.fn();
Object.assign(db.$client, { unsafe: query });

beforeEach(() => {
  getDb.mockReturnValue(db);
  query.mockReset();
});

it.each([[], [[null]], [[{ color: "invalid" }]]])("utilise le style par défaut pour une ancienne valeur %#", async (...rows) => {
  query.mockReturnValue({ values: async () => rows });
  expect(await getBlobStyle("alice")).toEqual(DEFAULT_BLOB_STYLE);
  expect(query).toHaveBeenCalledWith(expect.stringContaining('where "users"."id" = $1'), ["alice"]);
});

it("enregistre le style validé du seul compte demandé et le restitue", async () => {
  query.mockReturnValueOnce({ values: async () => [["alice"]] });
  await saveBlobStyle("alice", DEFAULT_BLOB_STYLE);
  expect(query).toHaveBeenCalledWith(expect.stringContaining('where ("users"."id" = $2 and "users"."is_demo" = $3)'), [
    JSON.stringify(DEFAULT_BLOB_STYLE), "alice", false,
  ]);
  query.mockReturnValueOnce({ values: async () => [[DEFAULT_BLOB_STYLE]] });
  expect(await getBlobStyle("alice")).toEqual(DEFAULT_BLOB_STYLE);
});

it("interdit l’écriture sur un compte démo dans la requête elle-même", async () => {
  query.mockReturnValueOnce({ values: async () => [] });
  await expect(saveBlobStyle("demo", DEFAULT_BLOB_STYLE, db)).rejects.toThrow("read-only");
  expect(query).toHaveBeenCalledWith(expect.stringContaining('"users"."is_demo" = $3'), [
    JSON.stringify(DEFAULT_BLOB_STYLE), "demo", false,
  ]);
});

it("rejette un style invalide avant écriture et signale un compte disparu", async () => {
  await expect(saveBlobStyle("alice", {} as BlobStyle)).rejects.toThrow(TypeError);
  expect(query).not.toHaveBeenCalled();
  query.mockReturnValueOnce({ values: async () => [] });
  await expect(saveBlobStyle("absent", DEFAULT_BLOB_STYLE)).rejects.toThrow("Account not found");
});
