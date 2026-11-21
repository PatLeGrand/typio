import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";
import type { BlobStyle } from "@/race/blobStyle";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn<() => Promise<CurrentUser | null>>(),
  getDb: vi.fn(),
  getBlobStyle: vi.fn<(userId: string) => Promise<BlobStyle>>(),
  getUserStats: vi.fn(),
  getWpmHistory: vi.fn(),
}));

vi.mock("@/auth/currentUser", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/db/shared", () => ({ getDb: mocks.getDb }));
vi.mock("@/profile/blobStyleRepository", () => ({ getBlobStyle: mocks.getBlobStyle }));
vi.mock("@/race/drizzleProfileStatsRepository", () => ({
  createDrizzleProfileStatsRepository: () => ({
    getUserStats: mocks.getUserStats,
    getWpmHistory: mocks.getWpmHistory,
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string): never => {
    throw new Error(`REDIRECT ${path}`);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import ProfilePage from "./page";

const member: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "member",
  displayName: "Alice",
  username: "alice",
  locale: "fr",
  avatarVersion: null,
};

function mockProfileDb() {
  let call = 0;
  mocks.getDb.mockReturnValue({
    select: () => ({
      from: () => ({
        where: async () => {
          call += 1;
          if (call === 1) {
            return [{
              id: member.id,
              passwordHash: "hash",
              avatarVersion: null,
              createdAt: new Date("2026-01-01T00:00:00Z"),
              keyboardLayout: "qwerty",
            }];
          }
          return [];
        },
      }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(member);
  mockProfileDb();
  mocks.getBlobStyle.mockResolvedValue({ color: "mint", glasses: "round", hat: "crown" });
  mocks.getUserStats.mockResolvedValue({
    bestWpm: null,
    averageWpm: null,
    averageAccuracy: null,
    raceCount: 0,
    wins: 0,
  });
  mocks.getWpmHistory.mockResolvedValue([]);
});

describe("ProfilePage", () => {
  it.each([
    ["membre", member, "fr"],
    ["invité", { ...member, kind: "guest", username: null }, "en"],
    ["démo", { ...member, isDemo: true }, "fr"],
  ] as const)("propose un lien vers la page blob sans dupliquer l'éditeur (%s, %s)", async (_label, user, locale) => {
    mocks.getCurrentUser.mockResolvedValue(user);
    render(await ProfilePage({ params: Promise.resolve({ lang: locale }) }));

    const { profile } = getDictionary(locale);
    expect(screen.getByRole("link", { name: profile.blob.customize })).toHaveAttribute(
      "href",
      `/${locale}/profile/blob`,
    );
    expect(screen.queryByRole("form", { name: profile.blob.title })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: profile.blob.save })).not.toBeInTheDocument();
  });

  it("affiche 4 onglets pour un membre et expose l'avatar hors de #profile-form", async () => {
    render(await ProfilePage({ params: Promise.resolve({ lang: "fr" }) }));
    const { profile } = getDictionary("fr");

    expect(screen.getAllByRole("tab")).toHaveLength(4);
    const profileForm = document.getElementById("profile-form");
    const avatarForm = screen.getByRole("form", { name: profile.avatar.title });
    expect(profileForm?.contains(avatarForm)).toBe(false);
  });

  it("affiche uniquement 2 onglets pour un invité", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...member, kind: "guest", username: null });
    render(await ProfilePage({ params: Promise.resolve({ lang: "en" }) }));

    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });
});
