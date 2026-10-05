import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";

const mocks = vi.hoisted(() => ({ getCurrentUserForDisplay: vi.fn<() => Promise<CurrentUser | null>>() }));
vi.mock("@/auth/currentUser", () => ({ getCurrentUserForDisplay: mocks.getCurrentUserForDisplay }));

import Home from "./page";

function props(lang: string) {
  return { params: Promise.resolve({ lang }), searchParams: Promise.resolve({}) };
}

const member: CurrentUser = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "member",
  displayName: "Alice",
  username: "alice",
  locale: "fr",
};

beforeEach(() => {
  mocks.getCurrentUserForDisplay.mockResolvedValue(null);
});

describe("Home", () => {
  it.each(["fr", "en"] as const)("affiche titre, accroche et deux boutons désactivés traduits (%s)", async (lang) => {
    const { home, site } = getDictionary(lang);
    render(await Home(props(lang)));

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: site.name })).toBeVisible();
    expect(screen.getByText(home.tagline)).toBeVisible();
    expect(screen.getByRole("button", { name: home.createRace })).toBeDisabled();
    expect(screen.getByRole("button", { name: home.joinWithCode })).toBeDisabled();
  });

  it.each(["fr", "en"] as const)("un visiteur voit les liens de connexion et d'invité (%s)", async (lang) => {
    const { home } = getDictionary(lang);
    render(await Home(props(lang)));

    expect(screen.getByRole("link", { name: home.signIn })).toHaveAttribute("href", `/${lang}/login`);
    expect(screen.getByRole("link", { name: home.playAsGuest })).toHaveAttribute("href", `/${lang}/guest`);
  });

  it("un utilisateur connecté ne voit pas ces liens", async () => {
    mocks.getCurrentUserForDisplay.mockResolvedValue(member);
    const { home } = getDictionary("fr");
    render(await Home(props("fr")));

    expect(screen.queryByRole("link", { name: home.signIn })).toBeNull();
    expect(screen.queryByRole("link", { name: home.playAsGuest })).toBeNull();
  });

  it.each(["fr", "en"] as const)("un invité voit « Créer un compte » vers l'inscription, pas les liens de visiteur (%s)", async (lang) => {
    mocks.getCurrentUserForDisplay.mockResolvedValue({ ...member, kind: "guest", username: null });
    const { home } = getDictionary(lang);
    render(await Home(props(lang)));

    expect(screen.getByRole("link", { name: home.signUp })).toHaveAttribute("href", `/${lang}/register`);
    expect(screen.queryByRole("link", { name: home.signIn })).toBeNull();
    expect(screen.queryByRole("link", { name: home.playAsGuest })).toBeNull();
  });

  it("un membre ne voit pas « Créer un compte »", async () => {
    mocks.getCurrentUserForDisplay.mockResolvedValue(member);
    render(await Home(props("fr")));

    expect(screen.queryByRole("link", { name: getDictionary("fr").home.signUp })).toBeNull();
  });

  it("répond par une 404 pour une locale inconnue", async () => {
    await expect(Home(props("de"))).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});
