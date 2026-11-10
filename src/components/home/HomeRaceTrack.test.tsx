import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HomeRaceTrack } from "./HomeRaceTrack";

const mocks = vi.hoisted(() => ({
  registerPlugin: vi.fn(), revert: vi.fn(), set: vi.fn(), wave: vi.fn(), veil: vi.fn(),
  timeline: vi.fn<(options: { scrollTrigger: { start: string; onUpdate: (trigger: { progress: number }) => void } }) => { fromTo: ReturnType<typeof vi.fn>; to: ReturnType<typeof vi.fn> }>(() => ({ fromTo: vi.fn(), to: vi.fn() })),
}));
vi.mock("gsap", () => ({ gsap: {
  registerPlugin: mocks.registerPlugin,
  context: () => ({ add: (callback: () => void) => callback(), revert: mocks.revert }),
  set: mocks.set, to: mocks.wave, fromTo: mocks.veil, timeline: mocks.timeline,
} }));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));
vi.mock("gsap/MotionPathPlugin", () => ({ MotionPathPlugin: {} }));

let desktop = true;
let reduced = false;
let resize: () => void;
let motionChange: () => void;
let pending: FrameRequestCallback | undefined;
const disconnect = vi.fn();
const removeListener = vi.fn();
const flushFrame = () => act(() => {
  const callback = pending;
  pending = undefined;
  callback?.(0);
});

beforeEach(() => {
  vi.clearAllMocks();
  desktop = true;
  reduced = false;
  pending = undefined;
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() { return query.includes("min-width") ? desktop : reduced; },
    addEventListener: (_event: string, listener: () => void) => { if (query.includes("reduced-motion")) motionChange = listener; },
    removeEventListener: removeListener,
  }));
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect = disconnect;
  });
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { pending = callback; return 1; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 2000, width: 1000, height: 2000, toJSON: () => ({}),
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function track() {
  const rendered = render(<><section><div data-home-race-track /><div data-home-typing /></section><div><HomeRaceTrack /><section><span data-track-point /></section><span data-track-point="finish" /><span data-track-flag /><div data-finish-veil /></div></>);
  const path = rendered.container.querySelector<SVGPathElement>("defs path")!;
  path.getTotalLength = vi.fn(() => 2042);
  path.getPointAtLength = vi.fn((length) => ({ y: (length / 2000) ** 2 * 1758 }) as DOMPoint);
  rendered.container.querySelector<HTMLElement>("[data-home-race-track]")!.getBoundingClientRect = () => new DOMRect(0, -300, 1000, 100);
  rendered.container.querySelector<HTMLElement>("[data-home-typing]")!.getBoundingClientRect = () => new DOMRect(200, -200, 600, 204);
  return rendered;
}

it.each(["mobile", "reduced motion"])("keeps GSAP inactive for %s", async (mode) => {
  desktop = mode !== "mobile";
  reduced = mode === "reduced motion";
  track();
  flushFrame();
  await act(() => vi.dynamicImportSettled());
  expect(mocks.registerPlugin).not.toHaveBeenCalled();
  expect(mocks.timeline).not.toHaveBeenCalled();
  expect(mocks.veil).not.toHaveBeenCalled();
});

it.each([false, true])("stops the runner before the finish stripe (reduced motion: %s)", async (reduceMotion) => {
  reduced = reduceMotion;
  const { container } = track();
  const finish = container.querySelector<HTMLElement>("[data-track-point='finish']")!;
  container.querySelector<HTMLElement>("[data-home-typing]")!.getBoundingClientRect = () => new DOMRect(200, -200, 600, 204);
  container.querySelector<HTMLElement>("[data-track-point]")!.getBoundingClientRect = () => new DOMRect(950, 64, 0, 0);
  finish.getBoundingClientRect = () => new DOMRect(500, 1800, 0, 0);
  await act(() => vi.dynamicImportSettled());
  flushFrame();
  const road = container.querySelector("defs path")!;
  expect(road.getAttribute("d")).toMatch(/L 500 1800$/);
  expect(road.getAttribute("d")).toMatch(/^M 760 -98 /);
  expect(container.querySelector("svg > g")).toHaveAttribute("transform", "translate(500 1758)");
  if (!reduceMotion) {
    expect(mocks.set).toHaveBeenLastCalledWith(expect.anything(), {
      opacity: 0,
      motionPath: { path: expect.stringMatching(/500 1758$/), start: 0, end: 0 },
    });
  }
});

it.each([768, 1280, 2560])("starts inside the typing panel at %s px, even when the next anchor is outside it", async (width) => {
  const { container } = track();
  const panel = container.querySelector<HTMLElement>("[data-home-typing]")!;
  const anchor = container.querySelector<HTMLElement>("[data-track-point]")!;
  const panelWidth = Math.min(width, 960) - 64;
  const left = (width - panelWidth) / 2;
  panel.getBoundingClientRect = () => new DOMRect(left, -200, panelWidth, 204);
  await act(() => vi.dynamicImportSettled());
  for (const x of [0, width]) {
    anchor.getBoundingClientRect = () => new DOMRect(x, 64, 0, 0);
    act(() => resize());
    flushFrame();
    const start = container.querySelector("defs path")!.getAttribute("d")!.match(/^M ([\d.]+) (-?[\d.]+)/)!;
    expect(Number(start[1])).toBeGreaterThanOrEqual(left + 40);
    expect(Number(start[1])).toBeLessThanOrEqual(left + panelWidth - 40);
    expect(Number(start[2])).toBe(-98);
  }
});

it("reveals the runner only below the panel and scrubs the decorative veil independently", async () => {
  const { container, unmount } = track();
  container.querySelector<HTMLElement>("[data-track-point='finish']")!.getBoundingClientRect = () => new DOMRect(500, 1800, 0, 0);
  await act(() => vi.dynamicImportSettled());
  flushFrame();
  const timeline = mocks.timeline.mock.results[0].value;
  const fade = timeline.to.mock.calls[1];
  // Le centre atteint le bas du panneau à y=4, soit 102 px après le départ.
  expect(fade[1]).toEqual({ opacity: 1, duration: 24 / 1856 });
  expect(fade[2]).toBeCloseTo(102 / 1856);
  expect(mocks.veil).toHaveBeenCalledWith(container.querySelector("[data-finish-veil]"), { opacity: 0.65 }, {
    opacity: 0, ease: "none",
    scrollTrigger: { trigger: container.querySelector("[data-track-point='finish']"), start: "top bottom", end: "top center", scrub: true },
  });
  unmount();
  expect(mocks.revert).toHaveBeenCalledOnce();
});

it("maps scroll height to arc length for both tweens and resamples on resize", async () => {
  const { container } = track();
  const path = container.querySelector<SVGPathElement>("defs path")!;
  // Courbe monotone non linéaire, avec le départ au-dessus du conteneur.
  path.getPointAtLength = vi.fn((length) => ({ y: -98 + (length / 2000) ** 2 * 1856 }) as DOMPoint);
  container.querySelector<HTMLElement>("[data-track-point='finish']")!.getBoundingClientRect = () => new DOMRect(500, 1800, 0, 0);
  await act(() => vi.dynamicImportSettled());
  flushFrame();
  expect(mocks.timeline.mock.lastCall?.[0].scrollTrigger.start).toBe("top+=-98 center");
  const timeline = mocks.timeline.mock.results[0].value;
  const ease = timeline.to.mock.calls[0][1].ease as (value: number) => number;
  expect(timeline.fromTo.mock.calls[0][2].ease).toBe(ease);
  expect(ease(0)).toBe(0);
  expect(ease(0.25)).toBeCloseTo(0.5, 3);
  expect(ease(0.5)).toBeCloseTo(Math.sqrt(0.5), 3);
  expect(ease(1)).toBe(1);
  path.getPointAtLength = vi.fn((length) => ({ y: -98 + (length / 2000) ** 3 * 1856 }) as DOMPoint);
  act(() => resize());
  flushFrame();
  const resized = mocks.timeline.mock.results[1].value.to.mock.calls[0][1].ease as (value: number) => number;
  expect(resized).not.toBe(ease);
  expect(resized(0.125)).toBeCloseTo(0.5, 3);
});

it("batches resize work, waves once, and reverts animation when motion changes and on unmount", async () => {
  const { unmount } = track();
  await act(() => vi.dynamicImportSettled());
  flushFrame();
  expect(mocks.registerPlugin).toHaveBeenCalledOnce();
  expect(mocks.timeline).toHaveBeenCalledOnce();
  const update = mocks.timeline.mock.calls[0][0].scrollTrigger.onUpdate;
  act(() => { update({ progress: 1 }); update({ progress: 0.5 }); update({ progress: 1 }); });
  expect(mocks.wave).toHaveBeenCalledOnce();
  vi.mocked(requestAnimationFrame).mockClear();
  act(() => { resize(); resize(); resize(); });
  expect(requestAnimationFrame).toHaveBeenCalledOnce();
  flushFrame();
  expect(mocks.revert).toHaveBeenCalledOnce();
  reduced = true;
  act(() => motionChange());
  flushFrame();
  expect(mocks.revert).toHaveBeenCalledTimes(2);
  reduced = false;
  act(() => motionChange());
  flushFrame();
  unmount();
  expect(mocks.revert).toHaveBeenCalledTimes(3);
  expect(disconnect).toHaveBeenCalledOnce();
  expect(removeListener).toHaveBeenCalled();
  expect(cancelAnimationFrame).toHaveBeenCalled();
});

it("does not create animation if unmounted during the dynamic import", async () => {
  const { unmount } = track();
  unmount();
  await act(() => vi.dynamicImportSettled());
  expect(mocks.registerPlugin).not.toHaveBeenCalled();
  expect(mocks.timeline).not.toHaveBeenCalled();
});
