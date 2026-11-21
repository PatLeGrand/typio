// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthLimiters } from "@/auth/rateLimit";
import type { CurrentUser } from "@/auth/types";
import type { BlobStyle } from "@/race/blobStyle";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn<() => Promise<CurrentUser | null>>(),
  getAuthDeps: vi.fn(),
  saveBlobStyle: vi.fn<(userId: string, style: BlobStyle) => Promise<void>>(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/auth/currentUser", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/auth/deps", () => ({ getAuthDeps: mocks.getAuthDeps }));
vi.mock("@/profile/blobStyleRepository", () => ({ saveBlobStyle: mocks.saveBlobStyle }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { updateBlobStyle } from "./blobStyleActions";

const member: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "member",
  displayName: "Alice",
  username: "alice",
  locale: "fr",
  avatarVersion: null,
};

let now = 0;
let limiters = createAuthLimiters(() => now);

function styleForm(color = "coral", glasses = "shades", hat = "cap") {
  const formData = new FormData();
  formData.set("color", color);
  formData.set("glasses", glasses);
  formData.set("hat", hat);
  formData.set("userId", "spoofed-user");
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  now = 0;
  limiters = createAuthLimiters(() => now);
  mocks.getCurrentUser.mockResolvedValue(member);
  mocks.getAuthDeps.mockReturnValue({ limiters });
  mocks.saveBlobStyle.mockResolvedValue(undefined);
});

describe("updateBlobStyle", () => {
  it("refuse les utilisateurs non connectés sans appeler le dépôt", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect(await updateBlobStyle(styleForm())).toEqual({ ok: false, code: "UNAUTHORIZED" });
    expect(mocks.saveBlobStyle).not.toHaveBeenCalled();
  });

  it("refuse le compte de démonstration sans consommer le quota", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...member, isDemo: true });
    expect(await updateBlobStyle(styleForm())).toEqual({ ok: false, code: "DEMO_READ_ONLY" });
    expect(mocks.getAuthDeps).not.toHaveBeenCalled();
    expect(mocks.saveBlobStyle).not.toHaveBeenCalled();
  });

  it("rejette un style invalide sans écrire en base", async () => {
    expect(await updateBlobStyle(styleForm("invalid-color", "round", "cap"))).toEqual({
      ok: false,
      code: "INVALID_STYLE",
    });
    expect(mocks.saveBlobStyle).not.toHaveBeenCalled();
  });

  it("enregistre le style validé pour l'utilisateur de la session et revalide la page profil", async () => {
    const result = await updateBlobStyle(styleForm("mint", "round", "crown"));
    expect(result).toEqual({ ok: true, style: { color: "mint", glasses: "round", hat: "crown" } });
    expect(mocks.saveBlobStyle).toHaveBeenCalledWith(member.id, {
      color: "mint",
      glasses: "round",
      hat: "crown",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/fr/profile");
  });

  it("applique la limite de débit", async () => {
    for (let i = 0; i < 30; i++) limiters.profileUpdates.consume(member.id);
    expect(await updateBlobStyle(styleForm())).toEqual({ ok: false, code: "RATE_LIMITED" });
    expect(mocks.saveBlobStyle).not.toHaveBeenCalled();
  });

  it("masque les erreurs internes du dépôt", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.saveBlobStyle.mockRejectedValue(new Error("sensitive db error"));
    expect(await updateBlobStyle(styleForm())).toEqual({ ok: false, code: "UNKNOWN" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("sensitive db error");
    spy.mockRestore();
  });
});
