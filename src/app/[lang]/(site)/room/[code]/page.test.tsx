import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn<() => Promise<CurrentUser | null>>(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
  roomClient: vi.fn(),
}));

vi.mock("@/auth/currentUser", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./RoomClient", () => ({
  RoomClient: (props: unknown) => {
    mocks.roomClient(props);
    return <div data-testid="room-client" />;
  },
}));

import RoomPage, { generateMetadata } from "./page";

const member: CurrentUser = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "member",
  displayName: "Alice",
  username: "alice",
  locale: "fr",
};

function props(lang: string, code: string, search: Record<string, string | string[] | undefined> = {}) {
  return { params: Promise.resolve({ lang, code }), searchParams: Promise.resolve(search) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(member);
});

describe("page /room/[code]", () => {
  it("sans session, redirige vers la connexion dans la langue courante", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(RoomPage(props("en", "ABC234"))).rejects.toThrow("NEXT_REDIRECT /en/login");
  });

  it.each(["fr", "en"] as const)("passe code normalisé, rôle, session et textes au client (%s)", async (lang) => {
    render(await RoomPage(props(lang, "abc234", { role: "spectator" })));

    expect(screen.getByTestId("room-client")).toBeInTheDocument();
    expect(mocks.roomClient).toHaveBeenCalledWith({
      code: "ABC234",
      role: "spectator",
      locale: lang,
      userId: member.id,
      labels: getDictionary(lang).room,
      settingsLabels: getDictionary(lang).raceSettings,
    });
  });

  it("rôle absent ou inconnu : coureur", async () => {
    render(await RoomPage(props("fr", "ABC234", { role: "admin" })));
    expect(mocks.roomClient).toHaveBeenLastCalledWith(expect.objectContaining({ role: "runner" }));
  });

  it("titre de l'onglet traduit", async () => {
    const { room, site } = getDictionary("en");
    const metadata = await generateMetadata({ params: Promise.resolve({ lang: "en" }) });
    expect(metadata.title).toBe(`${room.metaTitle} | ${site.name}`);
  });
});
