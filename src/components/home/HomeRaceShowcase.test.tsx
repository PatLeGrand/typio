import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { HomeRaceShowcase } from "./HomeRaceShowcase";

const { importVisualizer } = vi.hoisted(() => ({ importVisualizer: vi.fn() }));
vi.mock("next/dynamic", () => ({
  default: (loader: () => unknown) => (props: { paused: boolean; maxFPS: number; racers: { progress: number }[] }) => {
    importVisualizer();
    void loader();
    return <div data-testid="scene" data-paused={props.paused} data-fps={props.maxFPS} data-progress={JSON.stringify(props.racers.map((racer) => racer.progress))} />;
  },
}));
vi.mock("@/components/race/RaceVisualizer", () => ({ RaceVisualizer: () => null }));
let idle: IdleRequestCallback;

let intersect: (entries: { isIntersecting: boolean }[]) => void;
let desktop = true;
let reducedMotion = false;
const labels = getDictionary("fr").home.raceShowcase;
const playable = { ...getDictionary("fr").home.playableRace, keyboard: getDictionary("fr").room.race.keyboard, createRace: getDictionary("fr").home.createRace };
const visible = (inView: boolean) => act(() => intersect([{ isIntersecting: inView }]));
const DEMO_START = [58, 44, 71, 33];
/** Progression exposée par la légende (texte masqué pour les lecteurs d'écran) et état de la scène. */
const progress = () => Array.from(document.querySelectorAll<HTMLElement>("li[data-progress]")).map((racer) => Number(racer.dataset.progress));
const moving = () => document.querySelector<HTMLElement>("[data-moving]")!.dataset.moving;

beforeEach(() => {
  vi.useFakeTimers();
  desktop = true;
  reducedMotion = false;
  vi.spyOn(Math, "random").mockReturnValue(0);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
  importVisualizer.mockClear();
  vi.stubGlobal("requestIdleCallback", vi.fn((callback: IdleRequestCallback) => { idle = callback; return 1; }));
  vi.stubGlobal("cancelIdleCallback", vi.fn());
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width") ? desktop : reducedMotion,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: typeof intersect) { intersect = callback; }
    observe = vi.fn();
    disconnect = vi.fn();
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("runs the demo only in view and in a visible tab", () => {
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  expect(progress()).toEqual(DEMO_START);
  expect(moving()).toBe("false");
  act(() => vi.advanceTimersByTime(1000));
  expect(progress()).toEqual(DEMO_START);
  visible(true);
  expect(moving()).toBe("true");
  act(() => vi.advanceTimersByTime(200));
  progress().forEach((value, index) => expect(value).toBeGreaterThan(DEMO_START[index]));
  visible(false);
  const offscreen = progress();
  act(() => vi.advanceTimersByTime(1000));
  expect(progress()).toEqual(offscreen);
  expect(moving()).toBe("false");
  visible(true);
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(moving()).toBe("false");
});

it.each(["mobile", "reduced motion", "mobile reduced motion"])("keeps a still race without timers for %s", (mode) => {
  desktop = !mode.includes("mobile");
  reducedMotion = mode.includes("reduced motion");
  const { container } = render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  act(() => vi.advanceTimersByTime(200));
  expect(container.querySelectorAll("[data-scene-racer]")).toHaveLength(4);
  expect(progress()).toEqual(DEMO_START);
  expect(moving()).toBe("false");
  expect(vi.getTimerCount()).toBe(0);
  expect(screen.queryByTestId("scene")).toBeNull();
  expect(importVisualizer).not.toHaveBeenCalled();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  if (mode.includes("mobile")) {
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(playable.keyboard)).toBeVisible();
    expect(screen.queryByRole("link", { name: playable.createRace })).toBeNull();
  } else {
    expect(screen.getByRole("textbox", { name: playable.inputLabel })).toBeEnabled();
    expect(screen.getAllByRole("progressbar")).toHaveLength(4);
  }
});

it.each(["fr", "en"] as const)("renders the %s scene and a readable progress for every racer on the server", (locale) => {
  const dictionary = getDictionary(locale);
  const markup = renderToStaticMarkup(<HomeRaceShowcase labels={dictionary.home.raceShowcase} playable={{ ...dictionary.home.playableRace, keyboard: dictionary.room.race.keyboard }} locale={locale} />);
  const server = document.createElement("div");
  server.innerHTML = markup;
  expect(server.querySelector("[data-home-typing]")).toHaveClass("md:min-h-[204px]");
  expect(server.querySelector("[data-home-typing] > div")).toHaveClass("md:invisible");
  const legend = server.querySelector(`ul[aria-label="${dictionary.home.raceShowcase.gridLabel}"]`)!;
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  dictionary.home.raceShowcase.racers.forEach((name, index) => {
    expect(legend).toHaveTextContent(name);
    expect(legend).toHaveTextContent(percent.format(DEMO_START[index] / 100).replace(/\s/g, " "));
  });
  expect(legend.closest('[aria-hidden="true"]')).toBeNull();
  expect(server.querySelectorAll("[aria-hidden='true'] [data-scene-racer]")).toHaveLength(4);
});

it("draws four decorative racers, the bots recoloured", () => {
  const { container } = render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  const blobs = container.querySelectorAll("[data-scene-racer]");
  expect(blobs).toHaveLength(4);
  blobs.forEach((blob, index) => {
    expect(blob).toHaveAttribute("alt", "");
    expect(blob.closest('[aria-hidden="true"]')).not.toBeNull();
    if (index) expect(blob).toHaveStyle({ filter: `hue-rotate(${index * 47}deg)` });
  });
});

it("keeps the user's pause when the showcase re-enters the viewport", () => {
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  const control = screen.getByRole("button", { name: labels.pause });
  expect(control).toHaveClass("size-11", "absolute", "bottom-3", "right-3");
  expect(control.closest('[aria-hidden="true"]')).toBeNull();
  expect(control).toHaveTextContent("");
  fireEvent.click(control);
  expect(moving()).toBe("false");
  visible(false);
  visible(true);
  expect(moving()).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: labels.resume }));
  expect(moving()).toBe("true");
});

it("starts only in the input, resets the demo and throttles scenery without delaying typing", () => {
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  const input = screen.getByRole("textbox", { name: playable.inputLabel });
  expect(input).not.toHaveFocus();
  fireEvent.keyDown(document, { key: "L" });
  expect(input).toHaveValue("");
  act(() => vi.advanceTimersByTime(400));
  fireEvent.change(input, { target: { value: "L" } });
  expect(progress()).toEqual([0, 0, 0, 0]);
  fireEvent.change(input, { target: { value: "Le " } });
  expect(input).toHaveValue("Le ");
  expect(progress()[0]).toBe(0);
  act(() => vi.advanceTimersByTime(100));
  expect(progress()[0]).toBeCloseTo(3 / playable.texts[0].length * 100);
});

it("focuses the field from the panel and starts even after pausing the demo", () => {
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  fireEvent.click(screen.getByRole("button", { name: labels.pause }));
  fireEvent.click(screen.getByText(playable.prompt.replaceAll(" ", " ")));
  const input = screen.getByRole("textbox", { name: playable.inputLabel });
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: "L" } });
  expect(input).toHaveValue("L");
  expect(moving()).toBe("true");
});

it("focuses the field from the track, updates its prompt and keeps pause independent", () => {
  const { container } = render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  const input = screen.getByRole("textbox", { name: playable.inputLabel });
  expect(screen.getByText(playable.prompt)).toBeInTheDocument();
  fireEvent.click(container.querySelector("[data-home-race-track]")!);
  expect(input).toHaveFocus();
  expect(screen.getByText(playable.promptFocused.replaceAll("\u00a0", " "))).toBeInTheDocument();
  const pause = screen.getByRole("button", { name: labels.pause });
  expect(pause.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  act(() => pause.focus());
  fireEvent.click(pause);
  expect(pause).toHaveFocus();
  expect(screen.getByText(playable.prompt)).toBeInTheDocument();
});

it("shows real results once, focuses the result heading and starts a new round explicitly", () => {
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  const input = screen.getByRole("textbox", { name: playable.inputLabel });
  fireEvent.change(input, { target: { value: "L" } });
  act(() => vi.advanceTimersByTime(10_000));
  fireEvent.change(input, { target: { value: playable.texts[0] } });
  expect(progress()[0]).toBe(100);
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent(`${Math.round(playable.texts[0].length / 5 * 6)} MPM`);
  expect(status).toHaveTextContent("100 % de précision, place 1 sur 4");
  expect(screen.getByRole("list", { name: playable.place }).querySelectorAll("li")).toHaveLength(4);
  expect(screen.getByRole("link", { name: playable.challenge })).toHaveAttribute("href", "/fr/race/settings");
  const replay = screen.getByRole("button", { name: playable.replay });
  const heading = screen.getByRole("heading", { level: 2, name: /Place/ });
  expect(heading).toHaveAttribute("tabindex", "-1");
  expect(heading).toHaveFocus();
  expect(replay).not.toHaveFocus();
  fireEvent.keyDown(heading, { key: " " });
  fireEvent.keyDown(heading, { key: "Enter" });
  expect(screen.queryByRole("textbox")).toBeNull();
  const announcement = status.textContent;
  act(() => vi.advanceTimersByTime(60_000));
  expect(status.textContent).toBe(announcement);
  expect(heading).toHaveFocus();
  fireEvent.click(replay);
  act(() => vi.advanceTimersByTime(20));
  expect(screen.getByRole("textbox", { name: playable.inputLabel })).toHaveFocus();
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it("keeps the initial sentence on focus and first input, and only draws again on replay", () => {
  vi.mocked(Math.random).mockReturnValue(0.99);
  const { container } = render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  const sentence = () => container.querySelector("#home-race-sentence");
  const input = screen.getByRole("textbox", { name: playable.inputLabel });
  expect(sentence()).toHaveTextContent(playable.texts[0]);
  act(() => input.focus());
  expect(sentence()).toHaveTextContent(playable.texts[0]);
  fireEvent.change(input, { target: { value: playable.texts[0][0] } });
  expect(sentence()).toHaveTextContent(playable.texts[0]);
  expect(screen.getByText(playable.racing.replaceAll("\u00a0", " "))).toBeVisible();
  expect(screen.queryByText(playable.prompt.replaceAll("\u00a0", " "))).toBeNull();
  expect(Math.random).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: playable.texts[0] } });
  fireEvent.click(screen.getByRole("button", { name: playable.replay }));
  act(() => vi.advanceTimersByTime(20));
  expect(screen.getByRole("textbox", { name: playable.inputLabel })).toHaveFocus();
  expect(sentence()).toHaveTextContent(playable.texts.at(-1)!);
  expect(Math.random).toHaveBeenCalledTimes(1);
});

it("keeps reduced motion playable and excludes offscreen time from results", () => {
  reducedMotion = true;
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  const input = screen.getByRole("textbox", { name: playable.inputLabel });
  fireEvent.change(input, { target: { value: "L" } });
  act(() => vi.advanceTimersByTime(1000));
  visible(false);
  act(() => vi.advanceTimersByTime(30_000));
  visible(true);
  act(() => vi.advanceTimersByTime(1000));
  fireEvent.change(input, { target: { value: playable.texts[0] } });
  expect(screen.getByRole("status")).toHaveTextContent(`${Math.round(playable.texts[0].length / 5 * 30)} MPM`);
  expect(screen.getAllByRole("progressbar")).toHaveLength(4);
});

it("resets on Escape with input focus and preserves the race without input", () => {
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  const input = screen.getByRole("textbox", { name: playable.inputLabel });
  fireEvent.change(input, { target: { value: "L" } });
  fireEvent.keyDown(input, { key: "Escape" });
  act(() => vi.advanceTimersByTime(20));
  expect(input).toHaveValue("");
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: "L" } });
  act(() => vi.advanceTimersByTime(60_000));
  expect(input).toHaveValue("L");
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it("waits for composition to finish before counting input", () => {
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  const input = screen.getByRole("textbox", { name: playable.inputLabel });
  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: "^" } });
  act(() => vi.advanceTimersByTime(5000));
  fireEvent.compositionEnd(input, { data: "L", target: { value: "L" } });
  act(() => vi.advanceTimersByTime(1000));
  fireEvent.change(input, { target: { value: playable.texts[0] } });
  expect(screen.getByRole("status")).toHaveTextContent("100 % de précision");
});

it("loads the live scene after load and idle, on the same progress as the legend, and pauses it offscreen", () => {
  vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  for (const name of labels.racers) expect(screen.getByRole("list", { name: labels.gridLabel })).toHaveTextContent(name);
  visible(true);
  expect(window.requestIdleCallback).not.toHaveBeenCalled();
  act(() => window.dispatchEvent(new Event("load")));
  expect(screen.queryByTestId("scene")).toBeNull();
  act(() => idle({} as IdleDeadline));
  const scene = screen.getByTestId("scene");
  expect(scene.closest('[aria-hidden="true"]')).not.toBeNull();
  expect(scene).toHaveAttribute("data-fps", "30");
  act(() => vi.advanceTimersByTime(600));
  expect(JSON.parse(scene.getAttribute("data-progress")!)).toEqual(progress());
  const input = screen.getByRole("textbox", { name: playable.inputLabel });
  fireEvent.change(input, { target: { value: "Le " } });
  act(() => vi.advanceTimersByTime(100));
  expect(JSON.parse(screen.getByTestId("scene").getAttribute("data-progress")!)).toEqual(progress());
  visible(false);
  expect(screen.getByTestId("scene")).toHaveAttribute("data-paused", "true");
});

it("cancels pending idle work when the showcase leaves the viewport", () => {
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  visible(false);
  expect(window.cancelIdleCallback).toHaveBeenCalledWith(1);
  expect(screen.queryByTestId("scene")).toBeNull();
});
