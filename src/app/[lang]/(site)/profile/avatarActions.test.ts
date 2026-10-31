// @vitest-environment node
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthLimiters } from "@/auth/rateLimit";
import type { CurrentUser } from "@/auth/types";
import { MAX_AVATAR_BYTES } from "@/profile/avatar";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn<() => Promise<CurrentUser | null>>(),
  getAuthDeps: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/auth/currentUser", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/auth/deps", () => ({ getAuthDeps: mocks.getAuthDeps }));
vi.mock("@/db/shared", () => ({ getDb: () => ({ transaction: mocks.transaction }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  eq: (_column: unknown, value: unknown) => ({ targetId: value }),
}));

import { uploadAvatar, removeAvatar } from "./avatarActions";

const member: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111", kind: "member", displayName: "Alice", username: "alice", locale: "fr", avatarVersion: null,
};
let now = 0;
let limiters = createAuthLimiters(() => now);
const conflict = vi.fn();
const values = vi.fn<(input: { userId: string; image: Buffer }) => { onConflictDoUpdate: typeof conflict }>(() => ({ onConflictDoUpdate: conflict }));
const returning = vi.fn();
const where = vi.fn(() => ({ returning }));
const set = vi.fn(() => ({ where }));
const tx = { update: vi.fn(() => ({ set })), insert: vi.fn(() => ({ values })), delete: vi.fn(() => ({ where })) };

function form(data: BlobPart | string, filename = "photo.png", type = "image/png") {
  const result = new FormData();
  result.set("avatar", new File([data], filename, { type }));
  result.set("userId", "another-user");
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  now = 0;
  limiters = createAuthLimiters(() => now);
  mocks.getCurrentUser.mockResolvedValue(member);
  mocks.getAuthDeps.mockReturnValue({ limiters });
  mocks.transaction.mockImplementation(async (callback: (db: typeof tx) => Promise<unknown>) => callback(tx));
  returning.mockResolvedValue([{ version: 42 }]);
  conflict.mockResolvedValue(undefined);
});

describe("avatar actions", () => {
  it.each([null, { ...member, kind: "guest" as const, username: null }])("refuse %j sans écriture ni consommation", async (user) => {
    mocks.getCurrentUser.mockResolvedValue(user);
    expect(await uploadAvatar(form("text"))).toEqual({ ok: false, code: "UNAUTHORIZED" });
    expect(await removeAvatar()).toEqual({ ok: false, code: "UNAUTHORIZED" });
    expect(mocks.getAuthDeps).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("valide le champ fichier, sa taille et son contenu avant d'écrire", async () => {
    const textForm = new FormData();
    textForm.set("avatar", "not a file");
    expect(await uploadAvatar(textForm)).toEqual({ ok: false, code: "INVALID_IMAGE" });
    expect(await uploadAvatar(form(new Uint8Array(MAX_AVATAR_BYTES + 1)))).toEqual({ ok: false, code: "TOO_LARGE" });
    expect(await uploadAvatar(form("text"))).toEqual({ ok: false, code: "INVALID_IMAGE" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("ignore extension et MIME, stocke seulement le WebP traité pour le membre de la session", async () => {
    const png = await sharp({ create: { width: 20, height: 10, channels: 3, background: "red" } }).png().toBuffer();
    expect(await uploadAvatar(form(new Uint8Array(png), "wrong.gif", "image/gif"))).toEqual({ ok: true, version: 42 });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(where).toHaveBeenCalledWith({ targetId: member.id });
    const stored = values.mock.calls[0][0];
    expect(stored.userId).toBe(member.id);
    expect(await sharp(stored.image).metadata()).toMatchObject({ format: "webp", width: 256, height: 256 });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/fr/profile");
  });

  it("réserve 10 tentatives par heure et par utilisateur, avant le décodage", async () => {
    for (let i = 0; i < 10; i++) expect((await uploadAvatar(form("text"))).ok).toBe(false);
    expect(await uploadAvatar(form("text"))).toEqual({ ok: false, code: "RATE_LIMITED" });
    mocks.getCurrentUser.mockResolvedValue({ ...member, id: "another-member" });
    expect(await uploadAvatar(form("text"))).toEqual({ ok: false, code: "INVALID_IMAGE" });
    mocks.getCurrentUser.mockResolvedValue(member);
    now += 3600_000;
    expect(await uploadAvatar(form("text"))).toEqual({ ok: false, code: "INVALID_IMAGE" });
  });

  it("retire la photo et annule la version dans une transaction, même après épuisement des uploads", async () => {
    for (let i = 0; i < 10; i++) limiters.avatarUploads.consume(member.id);
    expect(await removeAvatar()).toEqual({ ok: true, version: null });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith({ avatarVersion: null });
    expect(tx.delete).toHaveBeenCalledOnce();
    expect(where).toHaveBeenCalledWith({ targetId: member.id });
  });

  it("ne divulgue pas les paramètres d'une erreur de base", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.transaction.mockRejectedValue(new Error("private image contents"));
    expect(await removeAvatar()).toEqual({ ok: false, code: "UNKNOWN" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("private image contents");
    spy.mockRestore();
  });
});
