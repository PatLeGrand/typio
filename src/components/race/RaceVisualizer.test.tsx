import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { RaceVisualizer } from "./RaceVisualizer";

const scene = vi.hoisted(() => ({
  dark: false,
  app: null as unknown as {
    ticker: { started: boolean; maxFPS: number; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };
    render: ReturnType<typeof vi.fn>;
    renderer: { on: ReturnType<typeof vi.fn>; background: { color: number } };
    destroy: ReturnType<typeof vi.fn>;
  },
}));
vi.mock("@/theme/useIsDarkTheme", () => ({ useIsDarkTheme: () => scene.dark }));
vi.mock("pixi.js", () => {
  class Container {
    addChild = vi.fn();
  }
  return {
    Container,
    TilingSprite: class {
      texture = { height: 100 };
      tilePosition = { x: 0 };
    },
    Assets: { add: vi.fn(), load: vi.fn(async () => {}), get: () => ({ height: 100 }) },
    Application: class {
      init = vi.fn(async () => {});
      canvas = document.createElement("canvas");
      stage = new Container();
      screen = { width: 800, height: 350 };
      renderer = { background: { color: 0 }, on: vi.fn() };
      render = vi.fn();
      destroy = vi.fn();
      ticker = {
        started: false, maxFPS: 0, add: vi.fn(),
        start: vi.fn(() => { this.ticker.started = true; }),
        stop: vi.fn(() => { this.ticker.started = false; }),
      };
      constructor() { scene.app = this; }
    },
  };
});

beforeEach(() => { scene.dark = false; });

it("keeps the default race running, pauses after drawing, and resumes at the requested FPS", async () => {
  const { rerender, unmount } = render(<RaceVisualizer racers={[]} />);
  await waitFor(() => expect(scene.app.ticker.started).toBe(true));
  expect(scene.app.ticker.maxFPS).toBe(0);
  scene.app.render.mockClear();
  scene.app.ticker.stop.mockClear();
  rerender(<RaceVisualizer racers={[]} paused maxFPS={30} />);
  expect(scene.app.render).toHaveBeenCalled();
  expect(scene.app.render.mock.invocationCallOrder[0]).toBeLessThan(scene.app.ticker.stop.mock.invocationCallOrder[0]);
  expect(scene.app.ticker.started).toBe(false);
  expect(scene.app.ticker.maxFPS).toBe(30);
  rerender(<RaceVisualizer racers={[]} maxFPS={30} />);
  expect(scene.app.ticker.started).toBe(true);
  unmount();
  expect(scene.app.destroy).toHaveBeenCalled();
});

it("redraws a paused scene on theme, resize and data changes", async () => {
  const racers: [] = [];
  const { rerender } = render(<RaceVisualizer racers={racers} paused />);
  await waitFor(() => expect(scene.app.ticker.stop).toHaveBeenCalled());
  expect(scene.app.ticker.started).toBe(false);
  scene.app.render.mockClear();
  scene.dark = true;
  rerender(<RaceVisualizer racers={racers} paused />);
  expect(scene.app.renderer.background.color).toBe(0x15122b);
  expect(scene.app.render).toHaveBeenCalled();
  scene.app.render.mockClear();
  act(() => scene.app.renderer.on.mock.calls[0][1]());
  expect(scene.app.render).toHaveBeenCalled();
  scene.app.render.mockClear();
  rerender(<RaceVisualizer racers={[]} paused trackLength={2000} />);
  expect(scene.app.render).toHaveBeenCalled();
  expect(scene.app.ticker.started).toBe(false);
  rerender(<RaceVisualizer racers={racers} />);
  expect(scene.app.ticker.started).toBe(true);
});
