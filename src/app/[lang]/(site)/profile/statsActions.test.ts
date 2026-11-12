// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/types";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn<() => Promise<CurrentUser | null>>(),
  getDb: vi.fn(),
  getUserStats: vi.fn(),
}));
vi.mock("@/auth/currentUser", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/db/shared", () => ({ getDb: mocks.getDb }));
vi.mock("@/race/drizzleProfileStatsRepository", () => ({
  createDrizzleProfileStatsRepository: () => ({ getUserStats: mocks.getUserStats }),
}));

import { getProfileSummary } from "./statsActions";

const member: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111", kind: "member", displayName: "Alice", username: "alice", locale: "fr", avatarVersion: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCurrentUser.mockResolvedValue(member);
});

describe("getProfileSummary", () => {
  it.each([null, { ...member, kind: "guest" as const, username: null }])("refuse %j avant de consulter les statistiques", async (user) => {
    mocks.getCurrentUser.mockResolvedValue(user);
    expect(await getProfileSummary()).toEqual({ ok: false });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.getUserStats).not.toHaveBeenCalled();
  });

  it("renvoie uniquement les statistiques du membre de la session", async () => {
    const stats = { raceCount: 0, wins: 0, bestWpm: null, averageWpm: null, averageAccuracy: null };
    mocks.getUserStats.mockResolvedValue(stats);
    expect(await getProfileSummary()).toEqual({ ok: true, stats });
    expect(mocks.getUserStats).toHaveBeenCalledExactlyOnceWith(member.id);
  });

  it.each(["session", "stats"])("masque les erreurs de base (%s)", async (stage) => {
    const target = stage === "session" ? mocks.getCurrentUser : mocks.getUserStats;
    target.mockRejectedValue(new Error("sensitive database error"));
    expect(await getProfileSummary()).toEqual({ ok: false });
  });
});
