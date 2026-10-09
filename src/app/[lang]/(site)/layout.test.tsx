import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";

const mocks = vi.hoisted(() => ({
  getCurrentUserForDisplay: vi.fn<() => Promise<CurrentUser | null>>(),
  schedulePurge: vi.fn(),
  guard: vi.fn(),
}));
vi.mock("@/realtime/RoomSessionGuard", () => ({
  RoomSessionGuard: (props: { userId: string | null }) => {
    mocks.guard(props.userId);
    return null;
  },
}));
vi.mock("@/auth/currentUser", () => ({ getCurrentUserForDisplay: mocks.getCurrentUserForDisplay }));
vi.mock("@/auth/actions", () => ({ logout: vi.fn() }));
vi.mock("@/auth/schedulePurge", () => ({ schedulePurge: mocks.schedulePurge }));
// SiteHeader contient un composant client qui lit le chemin courant.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/fr",
}));

import SiteLayout from "./layout";

function layoutProps(lang: string) {
  return { children: <p>contenu</p>, params: Promise.resolve({ lang }) };
}

beforeEach(() => {
  mocks.guard.mockClear();
  mocks.getCurrentUserForDisplay.mockResolvedValue(null);
});

describe("SiteLayout", () => {
  it("rend l'en-tête du site puis le contenu", async () => {
    render(await SiteLayout(layoutProps("fr")));

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText("contenu")).toBeInTheDocument();
  });

  it("transmet l'utilisateur connecté à l'en-tête", async () => {
    mocks.getCurrentUserForDisplay.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      kind: "member",
      displayName: "Alice_B",
      username: "alice_b",
      locale: "fr",
    });
    render(await SiteLayout(layoutProps("fr")));

    expect(screen.getByText("Alice_B")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: getDictionary("fr").header.signOut })).toBeInTheDocument();
  });

  it("donne l'utilisateur courant (ou null) au garde de la connexion temps réel", async () => {
    render(await SiteLayout(layoutProps("fr")));
    expect(mocks.guard).toHaveBeenLastCalledWith(null);

    mocks.getCurrentUserForDisplay.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      kind: "member",
      displayName: "Alice_B",
      username: "alice_b",
      locale: "fr",
    });
    render(await SiteLayout(layoutProps("fr")));
    expect(mocks.guard).toHaveBeenLastCalledWith("11111111-1111-1111-1111-111111111111");
  });

  it("déclenche le nettoyage des sessions et invités échus pour tout visiteur", async () => {
    render(await SiteLayout(layoutProps("fr")));

    expect(mocks.schedulePurge).toHaveBeenCalledTimes(1);
  });

  it("un invité voit « Créer un compte » dans l'en-tête", async () => {
    mocks.getCurrentUserForDisplay.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      kind: "guest",
      displayName: "Zoé",
      username: null,
      locale: "fr",
    });
    render(await SiteLayout(layoutProps("fr")));

    expect(screen.getByRole("link", { name: getDictionary("fr").header.signUp })).toHaveAttribute("href", "/fr/register");
  });

  it("déclenche une 404 pour une locale inconnue", async () => {
    await expect(SiteLayout(layoutProps("de"))).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});
