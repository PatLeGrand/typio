import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";
import { aggregatePersonalStats } from "@/race/personalStats";

const mocks = vi.hoisted(() => ({
  user: vi.fn<() => Promise<CurrentUser | null>>(),
  db: vi.fn(),
  getPersonalStats: vi.fn(),
}));

vi.mock("@/auth/currentUser", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/db/shared", () => ({ getDb: mocks.db }));
vi.mock("@/components/home/homeFonts", () => ({
  displayFont: { variable: "font-display-test" },
}));
vi.mock("@/race/drizzlePersonalStatsRepository", () => ({
  createDrizzlePersonalStatsRepository: () => ({ getPersonalStats: mocks.getPersonalStats }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string): never => {
    throw new Error(`REDIRECT ${path}`);
  },
}));

import StatsPage from "./page";

const member: CurrentUser = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "member",
  displayName: "Alice",
  username: "alice",
  locale: "fr",
  avatarVersion: null,
};

const emptyReport = {
  ...aggregatePersonalStats([]),
  keyboardLayout: "azerty" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue(member);
  mocks.getPersonalStats.mockResolvedValue(emptyReport);
});

describe("StatsPage", () => {
  it("redirige un visiteur non connecté vers la connexion sans toucher la base", async () => {
    mocks.user.mockResolvedValue(null);
    await expect(StatsPage({ params: Promise.resolve({ lang: "en" }) })).rejects.toThrow("REDIRECT /en/login");
    expect(mocks.db).not.toHaveBeenCalled();
  });

  it("affiche le message dédié aux invités avec un lien d’inscription sans toucher la base", async () => {
    mocks.user.mockResolvedValue({ ...member, kind: "guest", username: null });
    render(await StatsPage({ params: Promise.resolve({ lang: "fr" }) }));

    const { stats } = getDictionary("fr");
    expect(mocks.db).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: stats.guest.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: stats.guest.register })).toHaveAttribute("href", "/fr/register");
    expect(screen.getByRole("link", { name: stats.guest.play })).toHaveAttribute("href", "/fr/play");
  });

  it("interroge uniquement les statistiques du membre connecté et affiche l’état vide sans course", async () => {
    render(await StatsPage({ params: Promise.resolve({ lang: "en" }) }));

    const { stats } = getDictionary("en");
    expect(mocks.getPersonalStats).toHaveBeenCalledWith(member.id);
    expect(screen.getByRole("heading", { level: 1, name: stats.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: stats.empty.allTitle })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: stats.playCta })[0]).toHaveAttribute("href", "/en/play");
  });
});
