import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";
import { DEFAULT_BLOB_STYLE, type BlobStyle } from "@/race/blobStyle";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn<() => Promise<CurrentUser | null>>(),
  getDb: vi.fn(),
  getBlobStyle: vi.fn<(userId: string) => Promise<BlobStyle>>(),
  updateBlobStyle: vi.fn(),
}));

vi.mock("@/auth/currentUser", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/db/shared", () => ({ getDb: mocks.getDb }));
vi.mock("@/profile/blobStyleRepository", () => ({ getBlobStyle: mocks.getBlobStyle }));
vi.mock("../blobStyleActions", () => ({ updateBlobStyle: mocks.updateBlobStyle }));
vi.mock("next/navigation", () => ({
  redirect: (path: string): never => {
    throw new Error(`REDIRECT ${path}`);
  },
}));

import ProfileBlobPage, { generateMetadata } from "./page";

const member: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "member",
  displayName: "Alice",
  username: "alice",
  locale: "fr",
  avatarVersion: null,
};

function mockDbRows(rows: Array<{ id: string }>) {
  mocks.getDb.mockReturnValue({
    select: () => ({
      from: () => ({
        where: async () => rows,
      }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(member);
  mockDbRows([{ id: member.id }]);
  mocks.getBlobStyle.mockResolvedValue({ color: "coral", glasses: "shades", hat: "cap" });
});

describe("ProfileBlobPage", () => {
  it.each(["fr", "en"] as const)("génère le titre localisé (%s)", async (locale) => {
    const { profile, site } = getDictionary(locale);
    expect(await generateMetadata({ params: Promise.resolve({ lang: locale }) })).toEqual({
      title: `${profile.blob.title} | ${site.name}`,
    });
  });

  it("redirige un visiteur non connecté vers la connexion sans toucher la base", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(ProfileBlobPage({ params: Promise.resolve({ lang: "en" }) })).rejects.toThrow("REDIRECT /en/login");
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.getBlobStyle).not.toHaveBeenCalled();
  });

  it("redirige vers la connexion si le compte est introuvable en base", async () => {
    mockDbRows([]);
    await expect(ProfileBlobPage({ params: Promise.resolve({ lang: "fr" }) })).rejects.toThrow("REDIRECT /fr/login");
    expect(mocks.getBlobStyle).not.toHaveBeenCalled();
  });

  it.each(["fr", "en"] as const)("affiche l'éditeur et le retour vers le profil pour un membre (%s)", async (locale) => {
    render(await ProfileBlobPage({ params: Promise.resolve({ lang: locale }) }));

    const { profile } = getDictionary(locale);
    expect(mocks.getBlobStyle).toHaveBeenCalledWith(member.id);
    expect(screen.getByRole("heading", { level: 1, name: profile.blob.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: profile.blob.backToProfile })).toHaveAttribute("href", `/${locale}/profile`);

    const colorGroup = screen.getByRole("group", { name: profile.blob.colorLegend });
    expect(within(colorGroup).getByRole("radio", { name: profile.blob.colors.coral })).toBeChecked();
    expect(within(colorGroup).getByRole("radio", { name: profile.blob.colors.coral })).not.toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("permet à un invité de personnaliser son blob", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...member, kind: "guest", username: null });
    mocks.getBlobStyle.mockResolvedValue(DEFAULT_BLOB_STYLE);
    render(await ProfileBlobPage({ params: Promise.resolve({ lang: "fr" }) }));

    const { profile } = getDictionary("fr");
    expect(screen.getByRole("link", { name: profile.blob.backToProfile })).toHaveAttribute("href", "/fr/profile");
    expect(screen.getByRole("radio", { name: profile.blob.colors.sky })).not.toBeDisabled();
  });

  it("affiche l'avis lecture seule et verrouille l'éditeur pour le compte de démonstration", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...member, isDemo: true });
    render(await ProfileBlobPage({ params: Promise.resolve({ lang: "en" }) }));

    const { profile } = getDictionary("en");
    expect(screen.getByRole("status")).toHaveTextContent(profile.demoReadOnly);
    expect(screen.getByRole("radio", { name: profile.blob.colors.coral })).toBeDisabled();
    expect(screen.getByRole("button", { name: profile.blob.save })).toBeDisabled();
  });
});
