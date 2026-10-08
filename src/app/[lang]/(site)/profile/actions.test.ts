// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthLimiters, type AuthLimiters } from "@/auth/rateLimit";
import type { CurrentUser } from "@/auth/types";

const mocks = vi.hoisted(() => {
  const where = vi.fn<(condition: unknown) => Promise<void>>();
  const set = vi.fn<(values: Record<string, unknown>) => { where: typeof where }>(() => ({ where }));
  return {
    getCurrentUser: vi.fn<() => Promise<CurrentUser | null>>(),
    memberUsernameExists: vi.fn<(username: string) => Promise<boolean>>(),
    deps: {} as { users: { memberUsernameExists: (username: string) => Promise<boolean> }; limiters: AuthLimiters },
    revalidatePath: vi.fn<(path: string) => void>(),
    where,
    set,
    update: vi.fn(() => ({ set })),
  };
});

vi.mock("@/auth/currentUser", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/auth/deps", () => ({ getAuthDeps: () => mocks.deps }));
vi.mock("@/db/shared", () => ({ getDb: () => ({ update: mocks.update }) }));
// `eq` est remplacé pour pouvoir vérifier QUELLE ligne est visée par la mise à jour.
vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  eq: (_column: unknown, value: unknown) => ({ targetId: value }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { updateProfile } from "./actions";

const member: CurrentUser = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "member",
  displayName: "alice",
  username: "alice",
  locale: "fr",
};
const guest: CurrentUser = {
  ...member,
  id: "22222222-2222-2222-2222-222222222222",
  kind: "guest",
  displayName: "Zoé",
  username: null,
};

function form(fields: Record<string, string | undefined>): FormData {
  const data = new FormData();
  const merged = { displayName: "Alice B", keyboardLayout: "azerty", locale: "fr", ...fields };
  for (const [name, value] of Object.entries(merged)) {
    if (value !== undefined) data.set(name, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deps = { users: { memberUsernameExists: mocks.memberUsernameExists }, limiters: createAuthLimiters() };
  mocks.getCurrentUser.mockResolvedValue(member);
  mocks.memberUsernameExists.mockResolvedValue(false);
  mocks.where.mockResolvedValue(undefined);
});

describe("updateProfile", () => {
  it("refuse une requête sans session, sans rien écrire", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    await expect(updateProfile(form({}))).resolves.toEqual({ ok: false, code: "UNAUTHORIZED" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("enregistre nom, disposition et langue d'un membre, et cible sa propre ligne", async () => {
    await expect(updateProfile(form({ displayName: "  Alice B  ", locale: "en" }))).resolves.toEqual({
      ok: true,
      locale: "en",
    });

    expect(mocks.set).toHaveBeenCalledWith({ displayName: "Alice B", keyboardLayout: "azerty", locale: "en" });
    expect(mocks.where).toHaveBeenCalledWith({ targetId: member.id });
  });

  it("accepte la disposition cmf (valeur de la base)", async () => {
    await expect(updateProfile(form({ keyboardLayout: "cmf" }))).resolves.toEqual({ ok: true, locale: "fr" });
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ keyboardLayout: "cmf" }));
  });

  it("permet à un invité de modifier son profil", async () => {
    mocks.getCurrentUser.mockResolvedValue(guest);

    await expect(updateProfile(form({ displayName: "Zoé Z" }))).resolves.toEqual({ ok: true, locale: "fr" });
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ displayName: "Zoé Z" }));
  });

  it.each(["", "a", "x".repeat(21), "<script>"])("refuse le nom affiché %j (INVALID_PSEUDO)", async (displayName) => {
    await expect(updateProfile(form({ displayName }))).resolves.toEqual({ ok: false, code: "INVALID_PSEUDO" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuse un nom affiché absent du formulaire", async () => {
    await expect(updateProfile(form({ displayName: undefined }))).resolves.toEqual({
      ok: false,
      code: "INVALID_PSEUDO",
    });
  });

  it.each(["canadian", "QWERTY", "", undefined])("refuse la disposition %j (INVALID_SETTINGS)", async (keyboardLayout) => {
    await expect(updateProfile(form({ keyboardLayout }))).resolves.toEqual({ ok: false, code: "INVALID_SETTINGS" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuse une langue inconnue", async () => {
    await expect(updateProfile(form({ locale: "de" }))).resolves.toEqual({ ok: false, code: "INVALID_SETTINGS" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuse un nom affiché qui usurpe l'identifiant d'un autre membre, sans casse", async () => {
    mocks.memberUsernameExists.mockResolvedValue(true);

    await expect(updateProfile(form({ displayName: "BOB" }))).resolves.toEqual({ ok: false, code: "PSEUDO_TAKEN" });
    expect(mocks.memberUsernameExists).toHaveBeenCalledWith("bob");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("laisse un membre garder son propre identifiant comme nom affiché", async () => {
    mocks.memberUsernameExists.mockResolvedValue(true);

    await expect(updateProfile(form({ displayName: "Alice" }))).resolves.toEqual({ ok: true, locale: "fr" });
    expect(mocks.memberUsernameExists).not.toHaveBeenCalled();
  });

  it("revalide la page du profil dans l'ancienne et la nouvelle langue", async () => {
    await updateProfile(form({ locale: "en" }));

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/fr/profile");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/profile");
  });

  it("ne revalide qu'une fois quand la langue ne change pas", async () => {
    await updateProfile(form({}));

    expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("limite à 20 modifications par fenêtre : la 21e est refusée sans requête en base", async () => {
    for (let i = 0; i < 20; i += 1) {
      await expect(updateProfile(form({}))).resolves.toEqual({ ok: true, locale: "fr" });
    }
    mocks.update.mockClear();
    mocks.memberUsernameExists.mockClear();

    await expect(updateProfile(form({}))).resolves.toEqual({ ok: false, code: "RATE_LIMITED" });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.memberUsernameExists).not.toHaveBeenCalled();
  });

  it("le plafond est propre à chaque utilisateur", async () => {
    for (let i = 0; i < 21; i += 1) await updateProfile(form({}));

    mocks.getCurrentUser.mockResolvedValue(guest);
    await expect(updateProfile(form({}))).resolves.toEqual({ ok: true, locale: "fr" });
  });

  it("une requête sans session ne consomme aucun essai", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    for (let i = 0; i < 25; i += 1) await updateProfile(form({}));

    mocks.getCurrentUser.mockResolvedValue(member);
    await expect(updateProfile(form({}))).resolves.toEqual({ ok: true, locale: "fr" });
  });

  it("renvoie UNKNOWN, sans fuite, quand la base échoue", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.where.mockRejectedValue(new Error("secret: connection string"));

    await expect(updateProfile(form({}))).resolves.toEqual({ ok: false, code: "UNKNOWN" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secret");
    spy.mockRestore();
  });
});
