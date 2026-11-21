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
    children: unknown[] = [];
    destroyed = false;
    sortableChildren = false;
    x = 0;
    y = 0;
    zIndex = 0;
    rotation = 0;
    scale = { set: vi.fn() };
    position = { set: vi.fn() };
    addChild = vi.fn((...items: unknown[]) => {
      this.children.push(...items);
    });
    addChildAt = vi.fn();
    getChildIndex = vi.fn(() => 0);
  }
  class Graphics extends Container {
    alpha = 1;
    circle = vi.fn(() => this);
    ellipse = vi.fn(() => this);
    rect = vi.fn(() => this);
    roundRect = vi.fn(() => this);
    moveTo = vi.fn(() => this);
    lineTo = vi.fn(() => this);
    fill = vi.fn(() => this);
    stroke = vi.fn(() => this);
    cut = vi.fn(() => this);
  }
  class Sprite extends Container {
    texture: unknown;
    width = 94;
    height = 94;
    anchor = { set: vi.fn() };
    constructor(texture?: unknown) {
      super();
      this.texture = texture;
    }
  }
  class Text extends Container {
    text: string;
    width = 40;
    height = 16;
    anchor = { set: vi.fn() };
    constructor(opts?: { text?: string }) {
      super();
      this.text = opts?.text ?? "";
    }
  }
  const textureDestroy = vi.fn();
  return {
    Container,
    Graphics,
    Sprite,
    Text,
    Texture: {
      from: vi.fn((source: unknown) => ({ source, destroy: textureDestroy })),
    },
    TilingSprite: class {
      texture = { height: 100 };
      tilePosition = { x: 0 };
    },
    Assets: { add: vi.fn(), load: vi.fn(async () => {}), get: () => ({ width: 94, height: 100 }) },
    Application: class {
      init = vi.fn(async () => {});
      canvas = document.createElement("canvas");
      stage = new Container();
      screen = { width: 800, height: 350 };
      renderer = { background: { color: 0 }, on: vi.fn(), resolution: 1 };
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

beforeEach(() => {
  scene.dark = false;
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

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

it("charge le SVG personnalisé du blobStyle dans Pixi et libère les textures au démontage", async () => {
  const loadedImages: Array<{ src: string; onload: (() => void) | null }> = [];
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private _src = "";
    get src() { return this._src; }
    set src(value: string) {
      this._src = value;
      loadedImages.push(this);
    }
  }
  vi.stubGlobal("Image", FakeImage);
  const drawImage = vi.fn();
  const scale = vi.fn();
  const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    (() => ({ scale, drawImage })) as unknown as typeof HTMLCanvasElement.prototype.getContext,
  );

  const { rerender, unmount } = render(
    <RaceVisualizer
      paused
      racers={[
        {
          id: "u1",
          name: "Alice",
          progress: 25,
          isLocal: true,
          blobStyle: {
            color: "coral",
            expression: "smile",
            glasses: "shades",
            hat: "cap",
            accessory: "cape",
          },
        },
      ]}
    />,
  );

  await waitFor(() => expect(loadedImages.length).toBe(1));
  expect(decodeURIComponent(loadedImages[0].src)).toContain('id="Glasses-shades"');
  expect(decodeURIComponent(loadedImages[0].src)).toContain('id="Hat-cap"');
  expect(decodeURIComponent(loadedImages[0].src)).toContain('id="Accessory-cape"');

  act(() => { loadedImages[0].onload?.(); });
  expect(drawImage).toHaveBeenCalledTimes(1);

  rerender(
    <RaceVisualizer
      paused
      racers={[
        {
          id: "u1",
          name: "Alice",
          progress: 30,
          isLocal: true,
          blobStyle: {
            color: "mint",
            expression: "wink",
            glasses: "round",
            hat: "crown",
            accessory: "none",
          },
        },
      ]}
    />,
  );

  await waitFor(() => expect(loadedImages.length).toBe(2));
  expect(decodeURIComponent(loadedImages[1].src)).toContain('id="Expression-wink"');
  expect(decodeURIComponent(loadedImages[1].src)).toContain('id="Glasses-round"');
  expect(decodeURIComponent(loadedImages[1].src)).toContain('id="Hat-crown"');
  act(() => { loadedImages[1].onload?.(); });

  unmount();
  expect(scene.app.destroy).toHaveBeenCalled();
  getContextSpy.mockRestore();
});
