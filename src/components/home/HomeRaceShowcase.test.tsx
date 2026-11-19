import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { HomeRaceShowcase } from "./HomeRaceShowcase";

let intersect: (entries: { isIntersecting: boolean }[]) => void;
let desktop = true;
let reducedMotion = false;
const labels = getDictionary("fr").home.raceShowcase;
const playable = { ...getDictionary("fr").home.playableRace, keyboard: getDictionary("fr").room.race.keyboard, createRace: getDictionary("fr").home.createRace };
const visible = (inView: boolean) => act(() => intersect([{ isIntersecting: inView }]));
const DEMO_START = [58, 44, 71, 33];
/** Coureurs de la piste DOM : position (`left` en %) et état de foulée. */
const runners = () => Array.from(document.querySelectorAll<HTMLElement>(".home-runner"));
const progress = () => runners().map((runner) => Number.parseFloat(runner.style.left));
const moving = () => runners().map((runner) => runner.dataset.moving);

beforeEach(() => {
  vi.useFakeTimers();
  desktop = true;
  reducedMotion = false;
  vi.spyOn(Math, "random").mockReturnValue(0);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
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
  expect(moving()).toEqual(["false", "false", "false", "false"]);
  act(() => vi.advanceTimersByTime(1000));
  expect(progress()).toEqual(DEMO_START);
  visible(true);
  expect(moving()).toEqual(["true", "true", "true", "true"]);
  act(() => vi.advanceTimersByTime(200));
  progress().forEach((value, index) => expect(value).toBeGreaterThan(DEMO_START[index]));
  visible(false);
  const offscreen = progress();
  act(() => vi.advanceTimersByTime(1000));
  expect(progress()).toEqual(offscreen);
  expect(moving()).toEqual(["false", "false", "false", "false"]);
  visible(true);
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(moving()).toEqual(["false", "false", "false", "false"]);
});

it.each(["mobile", "reduced motion", "mobile reduced motion"])("keeps a still race without timers for %s", (mode) => {
  desktop = !mode.includes("mobile");
  reducedMotion = mode.includes("reduced motion");
  const { container } = render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  visible(true);
  act(() => vi.advanceTimersByTime(200));
  expect(container.querySelectorAll('img[src*="blob.svg"]')).toHaveLength(4);
  expect(progress()).toEqual(DEMO_START);
  expect(moving()).toEqual(["false", "false", "false", "false"]);
  expect(vi.getTimerCount()).toBe(0);
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

it.each(["fr", "en"] as const)("renders the %s track with every racer on the server", (locale) => {
  const dictionary = getDictionary(locale);
  const markup = renderToStaticMarkup(<HomeRaceShowcase labels={dictionary.home.raceShowcase} playable={{ ...dictionary.home.playableRace, keyboard: dictionary.room.race.keyboard }} locale={locale} />);
  const server = document.createElement("div");
  server.innerHTML = markup;
  expect(server.querySelector("[data-home-typing]")).toHaveClass("md:min-h-[204px]");
  expect(server.querySelector("[data-home-typing] > div")).toHaveClass("md:invisible");
  const track = server.querySelector("[data-home-race-track] > [aria-hidden='true']")!;
  for (const name of dictionary.home.raceShowcase.racers) expect(track).toHaveTextContent(name);
  expect(track.querySelectorAll(".home-runner")).toHaveLength(4);
});

it("draws four decorative racers, the bots recoloured", () => {
  const { container } = render(<HomeRaceShowcase labels={labels} playable={playable} locale="fr" />);
  const blobs = container.querySelectorAll('img[src*="blob.svg"]');
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
  expect(moving()[0]).toBe("false");
  visible(false);
  visible(true);
  expect(moving()[0]).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: labels.resume }));
  expect(moving()[0]).toBe("true");
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
  expect(moving()[0]).toBe("true");
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
