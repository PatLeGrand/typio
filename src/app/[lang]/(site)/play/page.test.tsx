import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn<() => Promise<CurrentUser | null>>(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
  playClient: vi.fn(),
}));

vi.mock("@/auth/currentUser", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./PlayClient", () => ({
  PlayClient: (props: unknown) => {
    mocks.playClient(props);
    return <div data-testid="play-client" />;
  },
}));

import PlayPage, { generateMetadata } from "./page";

const member: CurrentUser = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "member",
  displayName: "Alice",
  username: "alice",
  locale: "fr",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(member);
});

describe("page /play", () => {
  it("sans session, redirige vers la connexion dans la langue courante", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(PlayPage({ params: Promise.resolve({ lang: "en" }) })).rejects.toThrow("NEXT_REDIRECT /en/login");
  });

  it.each(["fr", "en"] as const)("passe l'identifiant de session et les textes traduits au client (%s)", async (lang) => {
    const { room } = getDictionary(lang);
    render(await PlayPage({ params: Promise.resolve({ lang }) }));

    expect(screen.getByRole("heading", { level: 1, name: room.play.title })).toBeVisible();
    expect(mocks.playClient).toHaveBeenCalledWith({ locale: lang, userId: member.id, isGuest: false, labels: room });
  });

  it("signale un invité au client", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...member, kind: "guest", username: null });
    render(await PlayPage({ params: Promise.resolve({ lang: "fr" }) }));
    expect(mocks.playClient).toHaveBeenCalledWith(expect.objectContaining({ isGuest: true }));
  });

  it.each(["fr", "en"] as const)("titre de l'onglet traduit (%s)", async (lang) => {
    const { room, site } = getDictionary(lang);
    const metadata = await generateMetadata({ params: Promise.resolve({ lang }) });
    expect(metadata.title).toBe(`${room.play.metaTitle} | ${site.name}`);
  });
});
