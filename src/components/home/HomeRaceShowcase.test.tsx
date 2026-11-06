import { act, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { HomeRaceShowcase } from "./HomeRaceShowcase";

const { importVisualizer } = vi.hoisted(() => ({ importVisualizer: vi.fn() }));
vi.mock("next/dynamic", () => ({
  default: (loader: () => unknown) => (props: { paused: boolean; maxFPS: number }) => {
    importVisualizer();
    void loader();
    return <div data-testid="scene" data-paused={props.paused} data-fps={props.maxFPS} />;
  },
}));
vi.mock("@/components/race/RaceVisualizer", () => ({ RaceVisualizer: () => null }));
let intersect: (entries: { isIntersecting: boolean }[]) => void;
let idle: IdleRequestCallback;
let desktop = true;
let reducedMotion = false;
const labels = getDictionary("fr").home.raceShowcase;
const visible = (inView: boolean) => act(() => intersect([{ isIntersecting: inView }]));

beforeEach(() => {
  vi.useFakeTimers();
  desktop = true;
  reducedMotion = false;
  importVisualizer.mockClear();
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("waits for load, visibility and idle, then pauses offscreen and in a hidden tab", () => {
  vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
  render(<HomeRaceShowcase labels={labels} locale="fr" />);
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
  const { container } = render(<HomeRaceShowcase labels={labels} locale="fr" />);
  visible(true);
  expect(screen.queryByTestId("scene")).toBeNull();
  act(() => vi.advanceTimersByTime(200));
  expect(container.querySelectorAll("img")).toHaveLength(2);
  expect(screen.queryByTestId("scene")).toBeNull();
  expect(importVisualizer).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it.each(["fr", "en"] as const)("renders the %s light and dark images on the server and initially", (locale) => {
  const element = <HomeRaceShowcase labels={getDictionary(locale).home.raceShowcase} locale={locale} />;
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
    expect(image).toHaveClass("object-cover", theme === "light" ? "dark:hidden" : "dark:block");
    expect(image).toHaveClass(theme === "light" ? "block" : "hidden");
    expect(image).not.toHaveAttribute("fetchpriority", "high");
  }
  expect(screen.queryByTestId("scene")).toBeNull();
  expect(importVisualizer).not.toHaveBeenCalled();
});

it("loads the desktop visualizer with the timeout fallback", () => {
  Reflect.deleteProperty(window, "requestIdleCallback");
  render(<HomeRaceShowcase labels={labels} locale="fr" />);
  visible(true);
  expect(importVisualizer).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByTestId("scene")).toBeInTheDocument();
  expect(importVisualizer).toHaveBeenCalled();
});

it("cancels pending idle work when the showcase leaves the viewport", () => {
  render(<HomeRaceShowcase labels={labels} locale="fr" />);
  visible(true);
  visible(false);
  expect(window.cancelIdleCallback).toHaveBeenCalledWith(1);
  expect(screen.queryByTestId("scene")).toBeNull();
});
