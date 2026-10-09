"use client";

import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { useIsDarkTheme } from "@/theme/useIsDarkTheme";

export interface Racer {
  id: string;
  name: string;
  progress: number; // 0 to 100
  isLocal?: boolean;
  /** Rotation de teinte du Blob en degrés (0 = bleu d'origine), pour distinguer les coureurs. */
  hue?: number;
}

interface RaceVisualizerProps {
  racers: Racer[];
  trackLength?: number;
  /** Classes du conteneur ; par défaut une boîte de 350 px avec bordure (bac à sable). */
  className?: string;
}

/** État d'animation d'un coureur, vivant uniquement dans la boucle Pixi. */
interface RacerView {
  container: PIXI.Container;
  body: PIXI.Container;
  shadow: PIXI.Graphics;
  x: number; // position affichée (lissée), en px de piste
  vx: number; // vitesse affichée, en px/s
  phase: number; // phase du cycle de saut
  intensity: number; // 0 (à l'arrêt) → 1 (pleine vitesse), lissée
}

interface Layer {
  alias: LayerAlias;
  sprite: PIXI.TilingSprite;
  speed: number;
  yOffset: number;
}

// Réglages de « feel » : à ajuster ici.
const MAX_SPEED = 260; // px/s : vitesse maximale d'un Blob à l'écran (plafond)
const FOLLOW_RATE = 3; // plus haut = le Blob rejoint sa cible plus vite (dans la limite de MAX_SPEED)
const ACCELERATION = 4; // douceur des démarrages/arrêts (plus haut = plus nerveux)
const CAMERA_RATE = 5; // la caméra est plus lente que le Blob → effet d'élan
const HOP_HEIGHT = 20; // hauteur max du saut en px
const CAMERA_ANCHOR = 0.22; // position du joueur local à l'écran (fraction de largeur)

/** Vrai quand les décors sont déjà déclarés auprès de `PIXI.Assets` (partagé par toutes les scènes). */
let assetsRegistered = false;
// Un coureur très en avance ou en retard sur le joueur local reste visible, collé au bord de l'écran
// (la caméra suit le joueur local, la piste est bien plus longue que l'écran).
const EDGE_MARGIN = 70; // px entre le Blob et le bord de l'écran

// Couleurs de la scène par thème (UI-3). Les décors sont des SVG clairs : en thème sombre on
// assombrit le fond et on teinte (multiplie) chaque calque.
const SCENE_COLORS = {
  light: { background: 0xdcf2fa, layers: { cloud: 0xffffff, "meadow-distant": 0xffffff, meadow: 0xffffff, track: 0xffffff } },
  dark: { background: 0x15122b, layers: { cloud: 0x6f7396, "meadow-distant": 0x4c5a7a, meadow: 0x48607a, track: 0x6a6480 } },
} as const;
type LayerAlias = keyof (typeof SCENE_COLORS)["light"]["layers"];

export function RaceVisualizer({
  racers,
  trackLength = 5000,
  className = "relative h-[350px] w-full overflow-hidden rounded-xl border border-border shadow-inner",
}: RaceVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dark = useIsDarkTheme();
  const darkRef = useRef(dark);
  // Appliquée par la scène une fois prête ; rappelée à chaque changement de thème.
  const applyThemeRef = useRef<((isDark: boolean) => void) | null>(null);

  // Toujours la dernière valeur, lisible depuis le ticker sans le recréer.
  const racersRef = useRef(racers);
  useEffect(() => { racersRef.current = racers; }, [racers]);
  
  const trackLengthRef = useRef(trackLength);
  useEffect(() => { trackLengthRef.current = trackLength; }, [trackLength]);

  useEffect(() => {
    darkRef.current = dark;
    applyThemeRef.current?.(dark);
  }, [dark]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    let isMounted = true;
    const app = new PIXI.Application();
    const layers: Layer[] = [];
    const views = new Map<string, RacerView>();
    let cameraX = 0;
    let cameraReady = false;
    let elapsed = 0;
    let initialized = false;

    const applyTheme = (isDark: boolean) => {
      const colors = SCENE_COLORS[isDark ? "dark" : "light"];
      app.renderer.background.color = colors.background;
      for (const { alias, sprite } of layers) sprite.tint = colors.layers[alias];
    };

    const layoutLayers = () => {
      for (const { sprite, yOffset } of layers) {
        sprite.width = app.screen.width;
        sprite.y = app.screen.height - sprite.texture.height - yOffset;
      }
    };

    const createView = (racer: Racer, blobTexture: PIXI.Texture, startX: number, world: PIXI.Container): RacerView => {
      const container = new PIXI.Container();
      const shadow = new PIXI.Graphics().ellipse(0, 0, 34, 8).fill({ color: 0x000000, alpha: 0.18 });
      const body = new PIXI.Container();
      const sprite = new PIXI.Sprite(blobTexture);
      sprite.anchor.set(0.5, 1); // pivot aux pieds : squash & stretch au sol
      if (racer.hue) {
        const hueFilter = new PIXI.ColorMatrixFilter();
        hueFilter.hue(racer.hue, false);
        sprite.filters = [hueFilter];
      }
      body.addChild(sprite);

      const label = new PIXI.Text({
        text: racer.name,
        style: { fontFamily: "sans-serif", fontSize: 13, fontWeight: "700", fill: 0xffffff, stroke: { color: 0x293c49, width: 4 } },
      });
      label.anchor.set(0.5, 1);
      label.y = -blobTexture.height - 4;
      body.addChild(label);

      container.addChild(shadow, body);
      world.addChild(container);
      return { container, body, shadow, x: startX, vx: 0, phase: 0, intensity: 0 };
    };

    const init = async () => {
      await app.init({
        backgroundColor: SCENE_COLORS[darkRef.current ? "dark" : "light"].background,
        resizeTo: host,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true,
      });
      initialized = true;
      if (!isMounted) {
        app.destroy(true, { children: true });
        return;
      }
      host.appendChild(app.canvas);

      const assets = {
        blob: "/race/blob.svg",
        cloud: "/race/cloud.svg",
        "meadow-distant": "/race/meadow-distant.svg",
        meadow: "/race/meadow.svg",
        track: "/race/track.svg",
      };
      // Les alias ne s'enregistrent qu'une fois : « Rejouer » remonte la scène à chaque manche.
      if (!assetsRegistered) {
        for (const [alias, src] of Object.entries(assets)) PIXI.Assets.add({ alias, src });
        assetsRegistered = true;
      }
      await PIXI.Assets.load(Object.keys(assets));
      if (!isMounted) return;

      const addLayer = (alias: LayerAlias, speed: number, yOffset: number) => {
        const texture = PIXI.Assets.get<PIXI.Texture>(alias);
        const sprite = new PIXI.TilingSprite({ texture, width: app.screen.width, height: texture.height });
        app.stage.addChild(sprite);
        layers.push({ alias, sprite, speed, yOffset });
      };
      addLayer("cloud", 0.1, 300);
      addLayer("meadow-distant", 0.2, 100);
      addLayer("meadow", 0.5, 50);
      addLayer("track", 1, 0);
      layoutLayers();
      applyTheme(darkRef.current);
      applyThemeRef.current = applyTheme;

      const world = new PIXI.Container();
      world.sortableChildren = true; // les coureurs du bas passent devant
      app.stage.addChild(world);

      const blobTexture = PIXI.Assets.get<PIXI.Texture>("blob");
      app.renderer.on("resize", layoutLayers);

      app.ticker.add((ticker) => {
        const dt = Math.min(ticker.deltaMS / 1000, 0.05); // borne les gros sauts (onglet en veille)
        elapsed += dt;
        const list = racersRef.current;
        const length = trackLengthRef.current;

        // Distances aux autres coureurs, bornées à ce que l'écran peut montrer.
        const localRacer = list.find((r) => r.isLocal) ?? list[0];
        const localRaw = localRacer ? (localRacer.progress / 100) * length : 0;
        const localX = (localRacer && views.get(localRacer.id)?.x) ?? localRaw;
        const maxAhead = Math.max(0, app.screen.width * (1 - CAMERA_ANCHOR) - EDGE_MARGIN);
        const maxBehind = Math.max(0, app.screen.width * CAMERA_ANCHOR - EDGE_MARGIN / 2);

        list.forEach((racer, index) => {
          const raw = (racer.progress / 100) * length;
          const target = racer === localRacer
            ? raw
            : localX + Math.max(-maxBehind, Math.min(maxAhead, raw - localRaw));
          let view = views.get(racer.id);
          if (!view) {
            view = createView(racer, blobTexture, target, world);
            views.set(racer.id, view);
          }

          // 1. Position : le Blob rejoint sa cible, mais sa vitesse est plafonnée à
          // MAX_SPEED et varie progressivement (pas de démarrage ni d'arrêt brutal).
          // Un joueur très en avance ne « file » donc pas hors de l'écran.
          const gap = target - view.x;
          const desiredVx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, gap * FOLLOW_RATE));
          view.vx += (desiredVx - view.vx) * (1 - Math.exp(-ACCELERATION * dt));
          let step = view.vx * dt;
          if (Math.abs(step) > Math.abs(gap)) step = gap; // ne dépasse jamais la cible
          view.x += step;
          const speed = step / dt;

          // 2. Intensité de l'animation = vitesse réelle / vitesse max.
          const wanted = Math.min(1, Math.max(0, speed / MAX_SPEED));
          view.intensity += (wanted - view.intensity) * (1 - Math.exp(-10 * dt));
          const k = view.intensity;

          // 3. Cycle de saut : la cadence suit la vitesse.
          view.phase += dt * (5 + k * 7);
          const s = Math.abs(Math.sin(view.phase)); // 0 au sol, 1 à l'apogée

          const groundY = app.screen.height - 34 - index * 14;
          const hop = s * HOP_HEIGHT * k;
          const breathing = Math.sin(elapsed * 2.5 + index) * 0.02 * (1 - k);

          // Squash au sol, stretch en l'air, volume conservé.
          const scaleY = 1 - 0.14 * k * (1 - s) + 0.08 * k * s + breathing;
          view.body.scale.set(1 / scaleY, scaleY);
          view.body.rotation = 0.14 * k * Math.sin(view.phase); // petit balancement
          view.body.y = -hop;

          // Ombre : reste au sol, rétrécit quand le Blob monte.
          const lift = hop / HOP_HEIGHT || 0;
          view.shadow.scale.set(1 - 0.35 * lift);
          view.shadow.alpha = 1 - 0.4 * lift;

          view.container.x = view.x;
          view.container.y = groundY;
          view.container.zIndex = groundY;
        });

        // 4. Caméra : suit la position *affichée* du joueur local, en différé.
        const local = list.find((r) => r.isLocal) ?? list[0];
        const localView = local ? views.get(local.id) : undefined;
        if (localView) {
          if (!cameraReady) {
            cameraX = localView.x;
            cameraReady = true;
          }
          cameraX += (localView.x - cameraX) * (1 - Math.exp(-CAMERA_RATE * dt));
        }

        for (const { sprite, speed } of layers) sprite.tilePosition.x = -cameraX * speed;
        world.x = -cameraX + app.screen.width * CAMERA_ANCHOR;
      });
    };

    void init();

    return () => {
      isMounted = false;
      applyThemeRef.current = null;
      views.clear();
      if (initialized) app.destroy(true, { children: true });
    };
  }, []);

  return (
    <div className={className}>
      <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />
    </div>
  );
}
