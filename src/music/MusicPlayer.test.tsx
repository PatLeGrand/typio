import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { MusicPlayer } from "./MusicPlayer";
import { playlist } from "./playlist";

const mocks = vi.hoisted(() => ({ pathname: "/fr" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));

const STORAGE_KEY = "typio:music";
const labels = getDictionary("fr").music;

type PlayBehavior = () => Promise<void>;

let pausedState = new WeakMap<HTMLMediaElement, boolean>();
let playSpy: ReturnType<typeof vi.fn<PlayBehavior>>;
let pauseSpy: ReturnType<typeof vi.fn<() => void>>;
let volumeAtPlay: number[];

const originalPlay = HTMLMediaElement.prototype.play;
const originalPause = HTMLMediaElement.prototype.pause;
const originalPausedDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "paused");

beforeEach(() => {
  mocks.pathname = "/fr";
  window.localStorage.clear();
  pausedState = new WeakMap();
  volumeAtPlay = [];

  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );

  playSpy = vi.fn<PlayBehavior>(function (this: HTMLMediaElement) {
    volumeAtPlay.push(this.volume);
    pausedState.set(this, false);
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });

  pauseSpy = vi.fn<() => void>(function (this: HTMLMediaElement) {
    pausedState.set(this, true);
    this.dispatchEvent(new Event("pause"));
  });

  HTMLMediaElement.prototype.play = playSpy;
  HTMLMediaElement.prototype.pause = pauseSpy;
  Object.defineProperty(HTMLMediaElement.prototype, "paused", {
    configurable: true,
    get(this: HTMLMediaElement) {
      return pausedState.get(this) ?? true;
    },
  });
});

afterEach(() => {
  HTMLMediaElement.prototype.play = originalPlay;
  HTMLMediaElement.prototype.pause = originalPause;
  if (originalPausedDescriptor) {
    Object.defineProperty(HTMLMediaElement.prototype, "paused", originalPausedDescriptor);
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MusicPlayer", () => {
  it("lance automatiquement la lecture par défaut à la première visite avec le volume cible", async () => {
    render(<MusicPlayer labels={labels} />);

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    expect(volumeAtPlay).toEqual([0.5]);
    expect(screen.getByRole("button", { name: labels.pause })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("initialise le volume cible (et muet) avant de lancer la lecture automatique", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ volume: 0.3, muted: true, collapsed: false, paused: false }),
    );

    render(<MusicPlayer labels={labels} />);

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    expect(volumeAtPlay).toEqual([0]);
  });

  it("ne lance pas la lecture automatiquement si paused vaut true dans localStorage", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ volume: 0.5, muted: false, collapsed: false, paused: true }),
    );

    render(<MusicPlayer labels={labels} />);

    await waitFor(() => expect(screen.getByRole("button", { name: labels.play })).toBeInTheDocument());
    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document, { key: "a" });
    expect(playSpy).not.toHaveBeenCalled();
  });

  it("persiste paused: true à la mise en pause et paused: false à la reprise", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ volume: 0.4, muted: false, collapsed: false, paused: false }),
    );

    render(<MusicPlayer labels={labels} />);

    await waitFor(() => expect(screen.getByRole("button", { name: labels.pause })).toBeInTheDocument());
    expect(volumeAtPlay).toEqual([0.4]);

    fireEvent.click(screen.getByRole("button", { name: labels.pause }));
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject({ paused: true });

    fireEvent.click(screen.getByRole("button", { name: labels.play }));
    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(2));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject({ paused: false });
  });

  it("n'affiche pas d'erreur sur NotAllowedError et reprend à la première interaction", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ volume: 0.5, muted: false, collapsed: false, paused: false }),
    );
    playSpy.mockRejectedValueOnce(new DOMException("Autoplay blocked", "NotAllowedError"));

    render(<MusicPlayer labels={labels} />);

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: labels.play })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: labels.pause })).toBeInTheDocument();

    // Les écouteurs sont nettoyés une fois la lecture démarrée.
    fireEvent.keyDown(document, { key: "Enter" });
    expect(playSpy).toHaveBeenCalledTimes(2);
  });

  it("ne crée pas de conflit si la première interaction après NotAllowedError est le bouton lecture", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ volume: 0.5, muted: false, collapsed: false, paused: false }),
    );
    playSpy.mockRejectedValueOnce(new DOMException("Autoplay blocked", "NotAllowedError"));

    render(<MusicPlayer labels={labels} />);

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    const playButton = screen.getByRole("button", { name: labels.play });

    fireEvent.pointerDown(playButton);
    expect(playSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(playButton);
    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(2));
    expect(pauseSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: labels.pause })).toBeInTheDocument();
  });

  it("nettoie les écouteurs d'interaction au démontage après NotAllowedError", async () => {
    playSpy.mockRejectedValueOnce(new DOMException("Autoplay blocked", "NotAllowedError"));

    const { unmount } = render(<MusicPlayer labels={labels} />);

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    unmount();

    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document, { key: "a" });
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it("reprend la lecture sur la piste suivante si la première interaction après NotAllowedError est next", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ volume: 0.5, muted: false, collapsed: false, paused: false }),
    );
    playSpy
      .mockRejectedValueOnce(new DOMException("Autoplay blocked", "NotAllowedError"))
      .mockRejectedValueOnce(new DOMException("Aborted by src change", "AbortError"));

    const { container } = render(<MusicPlayer labels={labels} />);

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    const nextButton = screen.getByRole("button", { name: labels.next });

    fireEvent.pointerDown(nextButton);
    fireEvent.click(nextButton);

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(3));
    expect(container.querySelector("audio")?.getAttribute("src")).toBe(`/music/${playlist[1].file}`);
    expect(screen.getByRole("button", { name: labels.pause })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject({ paused: false });
  });

  it("fonctionne sans erreur lorsque localStorage est bloqué", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("stockage bloqué");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("stockage bloqué");
    });

    render(<MusicPlayer labels={labels} />);

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    expect(volumeAtPlay).toEqual([0.5]);

    // Déplie le lecteur puis bascule pause / lecture sans exception.
    fireEvent.click(screen.getByRole("button", { name: labels.expand }));
    fireEvent.click(screen.getByRole("button", { name: labels.pause }));
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: labels.play }));
    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(2));
  });

  it("initialise un volume atténué pendant une course au lancement automatique", async () => {
    mocks.pathname = "/fr/race";
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ volume: 0.8, muted: false, collapsed: true, paused: false }),
    );

    render(<MusicPlayer labels={labels} />);

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    expect(volumeAtPlay[0]).toBeCloseTo(0.24);
  });

  it("reprend la lecture après NotAllowedError sur un événement keydown", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ volume: 0.5, muted: false, collapsed: false, paused: false }),
    );
    playSpy.mockRejectedValueOnce(new DOMException("Autoplay blocked", "NotAllowedError"));

    render(<MusicPlayer labels={labels} />);

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Enter" });
    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: labels.pause })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(playSpy).toHaveBeenCalledTimes(2);
  });

  it("affiche une alerte et désarme le déblocage sur une erreur d'autoplay autre que NotAllowedError", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ volume: 0.5, muted: false, collapsed: false, paused: false }),
    );
    playSpy.mockRejectedValueOnce(new DOMException("Unsupported", "NotSupportedError"));

    render(<MusicPlayer labels={labels} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(labels.error);
    expect(playSpy).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document, { key: "a" });
    expect(playSpy).toHaveBeenCalledTimes(1);
  });
});
