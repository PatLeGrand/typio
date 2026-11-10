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
let intersect: (entries: { isIntersecting: boolean }[]) => void;
let idle: IdleRequestCallback;
let desktop = true;
let reducedMotion = false;
const labels = getDictionary("fr").home.raceShowcase;
const playable = { ...getDictionary("fr").home.playableRace, keyboard: getDictionary("fr").room.race.keyboard, createRace: getDictionary("fr").home.createRace };
const visible = (inView: boolean) => act(() => intersect([{ isIntersecting: inView }]));

beforeEach(() => {
  vi.useFakeTimers();
  desktop = true;
  reducedMotion = false;
  importVisualizer.mockClear();
  vi.spyOn(Math, "random").mockReturnValue(0);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width") ? desktop : reducedMotion,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: typeof intersect) { intersect = callback; }
    observe = vi.fn();
    disconnect = vi.fn();
  });
  vi.stubGlobal("requestIdleCallback", vi.fn((callback: IdleRequestCallback) => { idle = callback; return 1; }));
  vi.stubGlobal("cancelIdleCallback", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("waits for load, visibility and idle, then pauses offscreen and in a hidden tab", () => {
  vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  expect(screen.queryByTestId("scene")).toBeNull();
  visible(true);
  expect(window.requestIdleCallback).not.toHaveBeenCalled();
  act(() => window.dispatchEvent(new Event("load")));
  expect(screen.queryByTestId("scene")).toBeNull();
  expect(importVisualizer).not.toHaveBeenCalled();
  act(() => idle({} as IdleDeadline));
  expect(importVisualizer).toHaveBeenCalled();
  expect(screen.getByTestId("scene")).toHaveAttribute("data-paused", "false");
  expect(screen.getByTestId("scene")).toHaveAttribute("data-fps", "30");
  visible(false);
  expect(screen.getByTestId("scene")).toHaveAttribute("data-paused", "true");
  visible(true);
  expect(screen.getByTestId("scene")).toHaveAttribute("data-paused", "false");
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(screen.getByTestId("scene")).toHaveAttribute("data-paused", "true");
});

it.each(["mobile", "reduced motion", "mobile reduced motion"])("keeps the image without importing the visualizer for %s", (mode) => {
  desktop = !mode.includes("mobile");
  reducedMotion = mode.includes("reduced motion");
  Reflect.deleteProperty(window, "requestIdleCallback");
  const { container } = render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  expect(screen.queryByTestId("scene")).toBeNull();
  act(() => vi.advanceTimersByTime(200));
  expect(container.querySelectorAll("img")).toHaveLength(2);
  expect(screen.queryByTestId("scene")).toBeNull();
  expect(importVisualizer).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  if (mode.includes("mobile")) {
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(playable.keyboard)).toBeVisible();
    expect(screen.getByRole("link", { name: playable.createRace })).toHaveAttribute("href", "/fr/race/settings");
  } else {
    expect(screen.getByRole("textbox", { name: playable.inputLabel })).toBeEnabled();
    expect(screen.getAllByRole("progressbar")).toHaveLength(4);
  }
});

it.each(["fr", "en"] as const)("renders the %s light and dark images on the server and initially", (locale) => {
  const dictionary = getDictionary(locale);
  const element = <HomeRaceShowcase labels={dictionary.home.raceShowcase} playable={{ ...dictionary.home.playableRace, keyboard: dictionary.room.race.keyboard, createRace: dictionary.home.createRace }} locale={locale} />;
  const markup = renderToStaticMarkup(element);
  const { container } = render(element);
  for (const [index, theme] of ["light", "dark"].entries()) {
    const source = encodeURIComponent(`/home/race-showcase-${locale}-${theme}.webp`);
    expect(markup).toContain(source);
    const image = container.querySelectorAll("img")[index];
    expect(image.getAttribute("src")).toContain(source);
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("width", "756");
    expect(image).toHaveAttribute("height", "518");
    expect(image).toHaveClass("object-cover", "md:hidden", theme === "light" ? "dark:hidden" : "dark:md:hidden");
    expect(image).toHaveClass(theme === "light" ? "block" : "hidden");
    expect(image).toHaveAttribute("fetchpriority", "high");
    expect(image).toHaveAttribute("loading", "lazy");
  }
  expect(screen.queryByTestId("scene")).toBeNull();
  expect(importVisualizer).not.toHaveBeenCalled();
});

it("loads the desktop visualizer with the timeout fallback", () => {
  Reflect.deleteProperty(window, "requestIdleCallback");
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  expect(importVisualizer).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByTestId("scene")).toBeInTheDocument();
  expect(importVisualizer).toHaveBeenCalled();
});

it("cancels pending idle work when the showcase leaves the viewport", () => {
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  visible(false);
  expect(window.cancelIdleCallback).toHaveBeenCalledWith(1);
  expect(screen.queryByTestId("scene")).toBeNull();
});

it("keeps the user's pause when the showcase re-enters the viewport", () => {
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  act(() => idle({} as IdleDeadline));
  const control = screen.getByRole("button", { name: labels.pause });
  expect(control).toHaveClass("size-11", "absolute", "bottom-3", "right-3");
  expect(control.closest('[aria-hidden="true"]')).toBeNull();
  expect(control).toHaveTextContent("");
  fireEvent.click(control);
  expect(screen.getByTestId("scene")).toHaveAttribute("data-paused", "true");
  visible(false);
  visible(true);
  expect(screen.getByTestId("scene")).toHaveAttribute("data-paused", "true");
  fireEvent.click(screen.getByRole("button", { name: labels.resume }));
  expect(screen.getByTestId("scene")).toHaveAttribute("data-paused", "false");
});

it("starts only in the input, resets the demo and throttles scenery without delaying typing", () => {
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  act(() => idle({} as IdleDeadline));
  const input = screen.getByRole("textbox", { name: playable.inputLabel });
  expect(input).not.toHaveFocus();
  fireEvent.keyDown(document, { key: "L" });
  expect(input).toHaveValue("");
  act(() => vi.advanceTimersByTime(400));
  fireEvent.change(input, { target: { value: "L" } });
  expect(screen.getByTestId("scene")).toHaveAttribute("data-progress", "[0,0,0,0]");
  const renders = importVisualizer.mock.calls.length;
  fireEvent.change(input, { target: { value: "Le " } });
  expect(input).toHaveValue("Le ");
  expect(importVisualizer.mock.calls.length).toBe(renders);
  act(() => vi.advanceTimersByTime(100));
  expect(importVisualizer.mock.calls.length).toBe(renders + 1);
  const progress = JSON.parse(screen.getByTestId("scene").getAttribute("data-progress")!);
  expect(progress[0]).toBeCloseTo(3 / playable.texts[0].length * 100);
});

it("focuses the field from the panel and starts even after pausing the demo", () => {
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  act(() => idle({} as IdleDeadline));
  fireEvent.click(screen.getByRole("button", { name: labels.pause }));
  fireEvent.click(screen.getByText(playable.prompt.replaceAll("\u00a0", " ")));
  const input = screen.getByRole("textbox", { name: playable.inputLabel });
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: "L" } });
  expect(input).toHaveValue("L");
  expect(screen.getByTestId("scene")).toHaveAttribute("data-paused", "false");
});

it("shows real results once, focuses replay and starts a new round", () => {
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  const input = screen.getByRole("textbox", { name: playable.inputLabel });
  fireEvent.change(input, { target: { value: "L" } });
  act(() => vi.advanceTimersByTime(10_000));
  fireEvent.change(input, { target: { value: playable.texts[0] } });
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent(`${Math.round(playable.texts[0].length / 5 * 6)} MPM`);
  expect(status).toHaveTextContent("100 % de précision, place 1 sur 4");
  expect(screen.getByRole("list", { name: playable.place }).querySelectorAll("li")).toHaveLength(4);
  expect(screen.getByRole("link", { name: playable.challenge })).toHaveAttribute("href", "/fr/race/settings");
  const replay = screen.getByRole("button", { name: playable.replay });
  expect(replay).toHaveFocus();
  const announcement = status.textContent;
  act(() => vi.advanceTimersByTime(500));
  expect(status.textContent).toBe(announcement);
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
  expect(importVisualizer).not.toHaveBeenCalled();
});

it("leaves on Escape and resets after 15 seconds without input", () => {
  render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  const input = screen.getByRole("textbox", { name: playable.inputLabel });
  fireEvent.change(input, { target: { value: "L" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input).toHaveValue("");
  fireEvent.change(input, { target: { value: "L" } });
  act(() => vi.advanceTimersByTime(14_900));
  expect(input).toHaveValue("L");
  act(() => vi.advanceTimersByTime(100));
  expect(input).toHaveValue("");
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
