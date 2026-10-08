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
  it.each(["fr", "en"] as const)("affiche la page de présentation traduite et ses accès à la salle de jeu (%s)", async (lang) => {
    const { home } = getDictionary(lang);
    render(await Home(props(lang)));

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: `${home.hero.titleLine1} ${home.hero.titleLine2}` }),
    ).toBeVisible();
    expect(screen.getByText(home.why.title)).toBeVisible();
    expect(screen.getByText(home.video.title)).toBeVisible();
    const video = screen.getByLabelText(home.media.videoLabel);
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("loop");
    expect(video.querySelector("source")).toHaveAttribute("src", "/videos/typio-intro.mp4");
    expect(screen.getByText(home.approach.title)).toBeVisible();
    for (const link of screen.getAllByRole("link", { name: home.createRace })) {
      expect(link).toHaveAttribute("href", `/${lang}/play`);
    }
    for (const link of screen.getAllByRole("link", { name: home.joinWithCode })) {
      expect(link).toHaveAttribute("href", `/${lang}/play`);
    }
  });

  it.each(["fr", "en"] as const)("un visiteur peut créer un compte ou se connecter (%s)", async (lang) => {
    const { home } = getDictionary(lang);
    render(await Home(props(lang)));

    for (const link of screen.getAllByRole("link", { name: home.signIn })) {
      expect(link).toHaveAttribute("href", `/${lang}/login`);
    }
    for (const link of screen.getAllByRole("link", { name: home.signUp })) {
      expect(link).toHaveAttribute("href", `/${lang}/register`);
    }
  });

  it("un membre connecté ne voit pas les liens de connexion et d'inscription", async () => {
    mocks.getCurrentUserForDisplay.mockResolvedValue(member);
    const { home } = getDictionary("fr");
    render(await Home(props("fr")));

    expect(screen.queryByRole("link", { name: home.signIn })).toBeNull();
    expect(screen.queryByRole("link", { name: home.signUp })).toBeNull();
  });

  it.each(["fr", "en"] as const)("un invité peut convertir sa session en compte (%s)", async (lang) => {
    mocks.getCurrentUserForDisplay.mockResolvedValue({ ...member, kind: "guest", username: null });
    const { home } = getDictionary(lang);
    render(await Home(props(lang)));

    for (const link of screen.getAllByRole("link", { name: home.signUp })) {
      expect(link).toHaveAttribute("href", `/${lang}/register`);
    }
    expect(screen.queryByRole("link", { name: home.signIn })).toBeNull();
  });

  it("relie les renvois de page et la politique de confidentialité", async () => {
    const { home, footer } = getDictionary("fr");
    render(await Home(props("fr")));

    expect(screen.getByRole("link", { name: `${home.preview.videoLink} ↗` })).toHaveAttribute("href", "#video");
    expect(screen.getByRole("link", { name: footer.privacy })).toHaveAttribute("href", "/fr/privacy");
  });

  it("répond par une 404 pour une locale inconnue", async () => {
    await expect(Home(props("de"))).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});
