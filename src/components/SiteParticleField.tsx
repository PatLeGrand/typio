"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { REDUCED_MOTION_QUERY } from "@/theme/reducedMotion";
import { sampleParticleOrigins } from "./particleSampling";

type Pixi = typeof import("pixi.js");
type Particle = import("pixi.js").Particle;

const DESKTOP_QUERY = "(min-width: 768px) and (any-hover: hover) and (any-pointer: fine)";
const RACE_SCREEN = ".room-race-screen";
const HUES = ["--track-accent", "--key-mint", "--key-coral", "--key-yellow", "--accent-text"];
const COLOR_STEPS = 16;

type Grain = {
  sprite: Particle;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  hue: number;
};

// Bruit de valeur 1D : les points pseudo-aléatoires sont raccordés sans rupture de pente.
function drift(time: number) {
  const sample = (index: number) => {
    const value = Math.sin(index * 127.1) * 43758.5453;
    return (value - Math.floor(value)) * 2 - 1;
  };
  const index = Math.floor(time);
  const t = time - index;
  const start = sample(index);
  return start + (sample(index + 1) - start) * t * t * (3 - 2 * t);
}

async function createField({ Application, Color, Graphics, Particle, ParticleContainer }: Pixi, host: HTMLDivElement, isVisible: () => boolean) {
  const app = new Application();
  try {
    await app.init({
      backgroundAlpha: 0,
      width: host.clientWidth,
      height: host.clientHeight,
      resolution: Math.min(window.devicePixelRatio || 1, 1.5),
      autoDensity: true,
      autoStart: false,
      eventMode: "none",
      preference: "webgl",
    });
    if (!isVisible()) {
      app.destroy(true, { children: true });
      return null;
    }

    const stamp = new Graphics().roundRect(0, 0, 12, 12, 4).fill({ color: "white" });
    const texture = app.renderer.generateTexture(stamp);
    stamp.destroy();
    const batch = new ParticleContainer({ texture, dynamicProperties: { position: true, vertex: true, color: true } });
    app.stage.addChild(batch);
    app.ticker.maxFPS = 60;

    let grains: Grain[] = [];
    let palette: number[][] = [];
    let width = 0;
    let height = 0;
    let ringX = 0;
    let ringY = 0;
    let elapsed = 0;
    let pointer: { x: number; y: number; time: number } | null = null;

    function paint(grain: Grain, energy: number) {
      const { sprite } = grain;
      sprite.scaleX = sprite.scaleY = grain.size * (1 + 1.5 * energy) / texture.width;
      sprite.tint = palette[grain.hue][Math.round(energy * COLOR_STEPS)];
      sprite.alpha = grain.opacity * (1 + 1.2 * energy);
    }

    function rest() {
      for (const grain of grains) {
        grain.sprite.x = grain.x;
        grain.sprite.y = grain.y;
        grain.vx = grain.vy = 0;
        paint(grain, 0);
      }
      app.render();
    }

    function readPalette() {
      const css = getComputedStyle(document.documentElement);
      const shade = new Color(css.getPropertyValue("--muted-strong").trim()).toRgbArray();
      palette = HUES.map((token) => {
        const hue = new Color(css.getPropertyValue(token).trim()).toRgbArray();
        return Array.from({ length: COLOR_STEPS + 1 }, (_, step) => {
          const mix = 0.35 + 0.65 * step / COLOR_STEPS;
          return new Color(hue.map((channel, i) => shade[i] + (channel - shade[i]) * mix)).toNumber();
        });
      });
    }

    function resize() {
      const nextWidth = host.clientWidth;
      const nextHeight = host.clientHeight;
      const resolution = Math.min(window.devicePixelRatio || 1, 1.5);
      if (width === nextWidth && height === nextHeight && app.renderer.resolution === resolution) return;
      if (width === nextWidth && height === nextHeight) {
        app.renderer.resize(width, height, resolution);
        app.render();
        return;
      }
      width = nextWidth;
      height = nextHeight;
      ringX = width * 0.22;
      ringY = height * 0.56;
      app.renderer.resize(width, height, resolution);
      batch.removeParticles();
      grains = sampleParticleOrigins(width, height).map(({ x, y }) => {
        // Deux courbes en marge rappellent les couloirs, avec des carrés par touches alternées.
        const edge = Math.min(x, width - x) / width;
        const lane = 0.09 + 0.075 * (y / height - 0.3) ** 2;
        const band = Math.floor(y / 27) + (edge > lane ? 1 : 0);
        const tile = Math.abs(edge - lane) < 0.027 && band % 2 === 0;
        const gutter = Math.max(0, 1 - edge / 0.32);
        const sprite = new Particle({ texture, anchorX: 0.5, anchorY: 0.5 });
        batch.addParticle(sprite);
        return {
          sprite, x, y, vx: 0, vy: 0,
          size: tile ? 2.8 + Math.random() : 1.05 + Math.random() * 1.1,
          opacity: (tile ? 0.067 : 0.045) + gutter * 0.11,
          hue: tile && band % 4 === 0 ? HUES.length - 1 : Math.floor(Math.random() * HUES.length),
        };
      });
      rest();
    }

    app.ticker.add(({ deltaMS }) => {
      const frames = Math.min(deltaMS * 0.06, 2);
      elapsed += frames / 60;
      const active = pointer && performance.now() - pointer.time < 900;
      const noiseX = active ? 0 : drift(elapsed * 0.52) * (pointer ? 26 : width * 0.09);
      const noiseY = active ? 0 : drift(elapsed * 0.46 + 19) * (pointer ? 26 : height * 0.13);
      const follow = 1 - 0.962 ** frames;
      ringX += ((pointer?.x ?? width * 0.22) + noiseX - ringX) * follow;
      ringY += ((pointer?.y ?? height * 0.56) + noiseY - ringY) * follow;

      const radius = Math.max(78, Math.min(width * 0.108, 150));
      const halfBand = 42;
      const damping = 0.83 ** frames;
      for (const grain of grains) {
        const { sprite } = grain;
        const dx = sprite.x - ringX;
        const dy = sprite.y - ringY;
        const distanceSquared = dx * dx + dy * dy;
        let ax = (grain.x - sprite.x) * 0.052;
        let ay = (grain.y - sprite.y) * 0.052;
        if (distanceSquared > (radius - halfBand) ** 2 && distanceSquared < (radius + halfBand) ** 2) {
          const distance = Math.sqrt(distanceSquared);
          const edge = 1 - Math.abs(distance - radius) / halfBand;
          const push = edge * edge * (active ? 3.4 : 0.85) / distance;
          ax += dx * push;
          ay += dy * push;
        }
        grain.vx = (grain.vx + ax * frames) * damping;
        grain.vy = (grain.vy + ay * frames) * damping;
        sprite.x += grain.vx * frames;
        sprite.y += grain.vy * frames;
        paint(grain, Math.min(1, Math.hypot(grain.vx, grain.vy) / 5.6));
      }
    });

    function move(event: PointerEvent) {
      if (event.pointerType === "mouse") pointer = { x: event.clientX, y: event.clientY, time: performance.now() };
    }

    function setPlaying(playing: boolean) {
      if (playing === app.ticker.started) return;
      if (playing) {
        window.addEventListener("pointermove", move, { passive: true });
        app.ticker.start();
      } else {
        window.removeEventListener("pointermove", move);
        pointer = null;
        app.ticker.stop();
      }
    }

    app.canvas.className = "site-particle-canvas";
    app.canvas.setAttribute("aria-hidden", "true");
    host.appendChild(app.canvas);
    return {
      resize, readPalette, setPlaying, rest,
      destroy() {
        setPlaying(false);
        app.destroy(true, { children: true });
        texture.destroy(true);
      },
    };
  } catch (error) {
    if (app.renderer) app.destroy(true, { children: true, texture: true, textureSource: true });
    throw error;
  }
}

export function SiteParticleField() {
  const pathname = usePathname();
  const excluded = !pathname || /^\/[^/]+\/race\/?$/.test(pathname);
  const inRoom = /^\/[^/]+\/room\//.test(pathname ?? "");
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = hostRef.current;
    if (!element || excluded || typeof window.matchMedia !== "function" || typeof ResizeObserver === "undefined" || typeof IntersectionObserver === "undefined") return;
    const host = element;

    const desktop = window.matchMedia(DESKTOP_QUERY);
    const reduced = window.matchMedia(REDUCED_MOTION_QUERY);
    let intersecting = false;
    let racing = inRoom && !!document.querySelector(RACE_SCREEN);
    let disposed = false;
    let loading = false;
    let failed = false;
    let paletteDirty = true;
    let field: Awaited<ReturnType<typeof createField>> = null;
    const isVisible = () => !disposed && desktop.matches && intersecting && !document.hidden && !racing;

    function sync() {
      if (!isVisible()) {
        field?.setPlaying(false);
        return;
      }
      if (field) {
        if (paletteDirty) {
          field.readPalette();
          paletteDirty = false;
        }
        field.resize();
        field.setPlaying(!reduced.matches);
        if (reduced.matches) field.rest();
      } else if (!loading && !failed) {
        loading = true;
        void import("pixi.js")
          .then((pixi) => isVisible() ? createField(pixi, host, isVisible) : null)
          .then((created) => {
            if (disposed) {
              created?.destroy();
              return;
            }
            field = created;
            // La première palette et la première image sont appliquées avant le prochain paint.
            if (field) sync();
          })
          .catch(() => {
            // Le décor est facultatif si le navigateur ne peut pas initialiser WebGL.
            failed = true;
            field?.destroy();
            field = null;
          })
          .finally(() => {
            loading = false;
            if (!field && !failed && isVisible()) sync();
          });
      }
    }

    const viewport = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      sync();
    });
    viewport.observe(host);

    const size = new ResizeObserver(sync);
    size.observe(host);

    const theme = new MutationObserver(() => {
      paletteDirty = true;
      sync();
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const room = inRoom ? new MutationObserver((records) => {
      // Les frappes et le chrono modifient aussi le DOM. Seule l'arrivée ou la sortie
      // de l'écran de course intéresse le décor.
      const screenChanged = records.some(({ addedNodes, removedNodes }) =>
        [...addedNodes, ...removedNodes].some((node) =>
          node instanceof Element && (node.matches(RACE_SCREEN) || node.querySelector(RACE_SCREEN))));
      if (!screenChanged) return;
      racing = !!document.querySelector(RACE_SCREEN);
      sync();
    }) : null;
    room?.observe(document.body, { childList: true, subtree: true });

    const events = new AbortController();
    desktop.addEventListener("change", sync, { signal: events.signal });
    reduced.addEventListener("change", sync, { signal: events.signal });
    document.addEventListener("visibilitychange", sync, { signal: events.signal });
    window.addEventListener("resize", sync, { signal: events.signal });

    return () => {
      disposed = true;
      events.abort();
      viewport.disconnect();
      size.disconnect();
      theme.disconnect();
      room?.disconnect();
      field?.destroy();
    };
  }, [excluded, inRoom]);

  return excluded ? null : <div ref={hostRef} className="site-particle-field" aria-hidden="true" />;
}
