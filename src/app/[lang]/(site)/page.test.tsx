import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";

const mocks = vi.hoisted(() => ({ visualizer: vi.fn(), getCurrentUserForDisplay: vi.fn<() => Promise<CurrentUser | null>>() }));
vi.mock("@/auth/currentUser", () => ({ getCurrentUserForDisplay: mocks.getCurrentUserForDisplay }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/race/RaceVisualizer", () => ({
  RaceVisualizer: (props: unknown) => { mocks.visualizer(props); return <div data-testid="visualizer" />; },
}));

import Home from "./page";

function props(lang: string) {
  return { params: Promise.resolve({ lang }), searchParams: Promise.resolve({}) };
}

const member: CurrentUser = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "member",
  displayName: "Alice",
  username: "alice",
  locale: "fr", avatarVersion: null,
};

beforeEach(() => {
  mocks.getCurrentUserForDisplay.mockResolvedValue(null);
  mocks.visualizer.mockClear();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: IntersectionObserverCallback) {}
    observe() { this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
    disconnect() {}
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Home", () => {
  it.each(["fr", "en"] as const)("affiche la page traduite avec la création de course et le champ pour rejoindre par code (%s)", async (lang) => {
    const { home } = getDictionary(lang);
    render(await Home(props(lang)));

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: `${home.hero.titleLine1} ${home.hero.titleLine2}` }),
    ).toBeVisible();
    expect(screen.getByText(home.why.title)).toBeVisible();
    expect(screen.getByText(home.video.title)).toBeVisible();
    const video = screen.getByLabelText(home.media.videoLabel);
    expect(video).not.toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("loop");
    expect(video.querySelector("source")).toHaveAttribute("src", "/videos/typio-intro.mp4");
    expect(screen.getByText(home.approach.title)).toBeVisible();
    for (const step of home.approach.steps) {
      expect(screen.getByRole("heading", { level: 3, name: step.title })).toBeVisible();
      expect(screen.getByText(step.description.replaceAll("\u00a0", " "))).toBeVisible();
    }
    for (const id of ["why", "video", "approach"]) {
      expect(document.getElementById(id)).toHaveAttribute("aria-labelledby", `${id}-title`);
    }
    expect(screen.getByRole("heading", { level: 2, name: home.about.title })).toBeVisible();
    expect(within(screen.getByRole("region", { name: home.about.title })).getByText(home.about.signature)).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: home.cta.title })).toBeVisible();
    for (const link of screen.getAllByRole("link", { name: home.createRace })) {
      expect(link).toHaveAttribute("href", `/${lang}/race/settings`);
    }
    expect(screen.getByRole("textbox", { name: home.joinByCode.label })).toBeVisible();
    expect(screen.getByRole("button", { name: home.joinByCode.button })).toBeEnabled();
    const trial = screen.getByRole("textbox", { name: home.playableRace.inputLabel });
    expect(trial).toBeVisible();
    expect(trial).not.toHaveFocus();
    const createRace = screen.getAllByRole("link", { name: home.createRace })[0];
    expect(trial.compareDocumentPosition(createRace) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it("un membre connecté retrouve « Créer une course » dans le hero et l'appel final, vers les paramètres", async () => {
    mocks.getCurrentUserForDisplay.mockResolvedValue(member);
    const { home } = getDictionary("fr");
    render(await Home(props("fr")));

    const links = screen.getAllByRole("link", { name: home.createRace });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute("href", "/fr/race/settings");
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

    expect(screen.getByRole("link", { name: home.navigation.preview })).toHaveAttribute("href", "#video");
    expect(screen.getByRole("link", { name: footer.privacy })).toHaveAttribute("href", "/fr/privacy");
  });

  it.each(["fr", "en"] as const)("garde les images localisées sans visualiseur en mouvement réduit (%s)", async (lang) => {
    const { container } = render(await Home(props(lang)));
    vi.useFakeTimers();
    act(() => { vi.advanceTimersByTime(5000); });
    const images = container.querySelectorAll("figure img");
    expect(images).toHaveLength(2);
    for (const [index, theme] of ["light", "dark"].entries()) {
      expect(images[index].getAttribute("src")).toContain(encodeURIComponent(`/home/race-showcase-${lang}-${theme}.webp`));
    }
    expect(screen.queryByTestId("visualizer")).toBeNull();
    expect(mocks.visualizer).not.toHaveBeenCalled();
  });

  it("anime une course serrée avec dépassements et conserve le visualiseur à la manche suivante", async () => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("min-width"), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    let enterView: (visible?: boolean) => void = () => {};
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) {
        enterView = (visible = true) => callback([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      observe() {}
      disconnect() {}
    });
    render(await Home(props("fr")));
    act(() => { enterView(); });
    const initialVisualizer = await screen.findByTestId("visualizer");
    const progress = () => (mocks.visualizer.mock.lastCall?.[0] as { racers: { progress: number }[] }).racers.map((racer) => racer.progress);
    expect(progress()).toEqual([0, 0, 0, 0]);
    expect(mocks.visualizer.mock.lastCall?.[0]).toMatchObject({ trackLength: 1500 });
    vi.useFakeTimers();
    act(() => { enterView(false); });
    act(() => { enterView(); });
    let elapsed = 0;
    const leaders = new Set<number>();
    while (Math.max(...progress()) < 100 && elapsed < 20000) {
      const previous = progress();
      act(() => { vi.advanceTimersByTime(200); });
      elapsed += 200;
      const current = progress();
      leaders.add(current.indexOf(Math.max(...current)));
      current.forEach((value, index) => {
        expect(value).toBeGreaterThanOrEqual(previous[index]);
        expect((value - previous[index]) * 1500 / 100 / 0.2).toBeLessThan(150);
      });
    }
    expect(elapsed).toBeGreaterThanOrEqual(15000);
    expect(elapsed).toBeLessThanOrEqual(20000);
    expect(Math.max(...progress())).toBe(100);
    expect(progress()[0]).toBeLessThan(100);
    expect(leaders.size).toBeGreaterThan(1);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(progress()).toEqual([0, 0, 0, 0]);
    expect(screen.getByTestId("visualizer")).toBe(initialVisualizer);
  });

  it("répond par une 404 pour une locale inconnue", async () => {
    await expect(Home(props("de"))).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});

it("focuses the room code field after an invalid submission", async () => {
  const labels = getDictionary("fr").home.joinByCode;
  render(await Home(props("fr")));
  fireEvent.click(screen.getByRole("button", { name: labels.button }));
  const input = screen.getByRole("textbox", { name: labels.label });
  expect(input).toHaveFocus();
  expect(input).toBeInvalid();
  expect(input).toHaveAccessibleDescription(labels.invalidCode);
});
