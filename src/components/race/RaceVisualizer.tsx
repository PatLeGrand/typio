"use client";

import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { useIsDarkTheme } from "@/theme/useIsDarkTheme";
import { AVATAR_COLOR_COUNT, avatarColorIndex, avatarColorVar, avatarInitial } from "@/components/avatar";

export interface Racer {
  id: string;
  name: string;
  progress: number; // 0 to 100
  isLocal?: boolean;
  /** Rotation de teinte du Blob en degrés (0 = bleu d'origine), pour distinguer les coureurs. */
  hue?: number;
  bonusLabel?: string;
  /** Graine de la couleur de l'avatar généré (H-39) ; `id` par défaut, le nom pour un bot. */
  seed?: string;
  /** Nom dont on tire l'initiale de l'avatar généré ; `name` par défaut. */
  avatarName?: string;
  /** URL versionnée de la photo (H-38), ou absente : avatar généré. */
  avatarUrl?: string | null;
}

interface RaceVisualizerProps {
  racers: Racer[];
  trackLength?: number;
  paused?: boolean;
  maxFPS?: number;
  /** Classes du conteneur ; par défaut une boîte de 350 px avec bordure (bac à sable). */
  className?: string;
}

/** État d'animation d'un coureur, vivant uniquement dans la boucle Pixi. */
interface RacerView {
  container: PIXI.Container;
  body: PIXI.Container;
  shadow: PIXI.Graphics;
  bonus: PIXI.Text;
  x: number; // position affichée (lissée), en px de piste
  vx: number; // vitesse affichée, en px/s
  phase: number; // phase du cycle de saut
  labelHalfWidth: number; // encombrement à gauche du nom et de son avatar
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
const LABEL_STAGGER = 10; // décalage vertical des étiquettes, en px
const AVATAR_SIZE = 22; // diamètre de l'avatar à côté du nom, en px

/** Vrai quand les décors sont déjà déclarés auprès de `PIXI.Assets` (partagé par toutes les scènes). */
let assetsRegistered = false;
// Un coureur très en avance ou en retard sur le joueur local reste visible, collé au bord de l'écran
// (la caméra suit le joueur local, la piste est bien plus longue que l'écran).
const EDGE_MARGIN = 70; // px entre le Blob et le bord de l'écran

// Couleurs de la scène par thème (DES-05, A11Y-01). Les décors sont des SVG clairs : en thème sombre on
// assombrit le fond et on teinte (multiplie) chaque calque.
const SCENE_COLORS = {
  light: { background: 0xdcf2fa, layers: { cloud: 0xffffff, "meadow-distant": 0xffffff, meadow: 0xffffff, track: 0xffffff } },
  dark: { background: 0x15122b, layers: { cloud: 0x6f7396, "meadow-distant": 0x4c5a7a, meadow: 0x48607a, track: 0x6a6480 } },
} as const;
type LayerAlias = keyof (typeof SCENE_COLORS)["light"]["layers"];

export function RaceVisualizer({
  racers,
  trackLength = 5000,
  paused = false,
  maxFPS = 0,
  className = "relative h-[350px] w-full overflow-hidden rounded-xl border border-border shadow-inner",
}: RaceVisualizerProps) {
  const reducedMotionRef = useRef(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { reducedMotionRef.current = query.matches; };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const playbackRef = useRef({ paused, maxFPS });
  const syncPlaybackRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    playbackRef.current = { paused, maxFPS };
    syncPlaybackRef.current?.();
  }, [paused, maxFPS]);
  const dark = useIsDarkTheme();
  const darkRef = useRef(dark);
  // Appliquée par la scène une fois prête ; rappelée à chaque changement de thème.
  const applyThemeRef = useRef<((isDark: boolean) => void) | null>(null);

  // Toujours la dernière valeur, lisible depuis le ticker sans le recréer.
  const racersRef = useRef(racers);
  useEffect(() => {
    racersRef.current = racers;
    syncPlaybackRef.current?.();
  }, [racers]);
  
  const trackLengthRef = useRef(trackLength);
  useEffect(() => {
    trackLengthRef.current = trackLength;
    syncPlaybackRef.current?.();
  }, [trackLength]);

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
    // Textures des photos chargées par cette scène : libérées au démontage.
    const photoTextures: PIXI.Texture[] = [];
    const hueTextures = new Map<number, PIXI.Texture>();
    let avatarPalette: { colors: string[]; foreground: string } | null = null;
    let cameraX = 0;
    let cameraReady = false;
    let elapsed = 0;
    let initialized = false;

    const applyTheme = (isDark: boolean) => {
      const colors = SCENE_COLORS[isDark ? "dark" : "light"];
      app.renderer.background.color = colors.background;
      for (const { alias, sprite } of layers) sprite.tint = colors.layers[alias];
      if (!app.ticker.started) app.render();
    };

    const layoutLayers = () => {
      for (const { sprite, yOffset } of layers) {
        sprite.width = app.screen.width;
        sprite.y = app.screen.height - sprite.texture.height - yOffset;
      }
    };

    /** Couleurs des tokens `--avatar-*`, lues une fois (identiques en clair et en sombre). */
    const palette = () => {
      if (!avatarPalette) {
        const style = getComputedStyle(host);
        avatarPalette = {
          colors: Array.from({ length: AVATAR_COLOR_COUNT }, (_, i) => style.getPropertyValue(avatarColorVar(i)).trim() || "gray"),
          foreground: style.getPropertyValue("--avatar-foreground").trim() || "white",
        };
      }
      return avatarPalette;
    };

    /** Avatar rond : généré tout de suite, remplacé par la photo si elle charge (sinon il reste). */
    const createAvatar = (racer: Racer): PIXI.Container => {
      const radius = AVATAR_SIZE / 2;
      const { colors, foreground } = palette();
      const node = new PIXI.Container();
      const generated = new PIXI.Container();
      generated.addChild(new PIXI.Graphics().circle(0, 0, radius).fill(colors[avatarColorIndex(racer.seed ?? racer.id)]));
      const initial = new PIXI.Text({
        text: avatarInitial(racer.avatarName ?? racer.name),
        style: { fontFamily: "sans-serif", fontSize: 12, fontWeight: "700", fill: foreground },
      });
      initial.anchor.set(0.5);
      generated.addChild(initial);
      // Anneau : plus épais et jaune pour le joueur local, qui reste repérable.
      const ring = new PIXI.Graphics().circle(0, 0, radius).stroke(racer.isLocal ? { width: 3, color: 0xffda70 } : { width: 1.5, color: 0xffffff });
      node.addChild(generated, ring);

      if (racer.avatarUrl) {
        const image = new Image();
        image.onload = () => {
          if (!isMounted || node.destroyed) return;
          const canvas = document.createElement("canvas");
          const size = Math.ceil(AVATAR_SIZE * (window.devicePixelRatio || 1));
          canvas.width = canvas.height = size;
          const context = canvas.getContext("2d");
          if (!context) return;
          context.beginPath();
          context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
          context.clip();
          context.drawImage(image, 0, 0, size, size);
          const texture = PIXI.Texture.from(canvas);
          photoTextures.push(texture);
          const photo = new PIXI.Sprite(texture);
          photo.anchor.set(0.5);
          photo.width = AVATAR_SIZE;
          photo.height = AVATAR_SIZE;
          node.addChildAt(photo, 1);
          generated.visible = false;
          if (!app.ticker.started) app.render();
        };
        image.src = racer.avatarUrl; // repli sur l'avatar généré si le chargement échoue
      }
      return node;
    };

    const createView = (racer: Racer, blobTexture: PIXI.Texture, startX: number, world: PIXI.Container, labelIndex: number): RacerView => {
      const container = new PIXI.Container();
      const shadow = new PIXI.Graphics().ellipse(0, 0, 34, 8).fill({ color: 0x000000, alpha: 0.18 });
      const body = new PIXI.Container();
      let texture = blobTexture;
      if (racer.hue) {
        const cached = hueTextures.get(racer.hue);
        if (cached) {
          texture = cached;
        } else {
          const source = new PIXI.Sprite(blobTexture);
          const hueFilter = new PIXI.ColorMatrixFilter();
          hueFilter.hue(racer.hue, false);
          hueFilter.resolution = app.renderer.resolution;
          source.filters = [hueFilter];
          texture = app.renderer.generateTexture({
            target: source,
            frame: new PIXI.Rectangle(0, 0, blobTexture.width, blobTexture.height),
            resolution: app.renderer.resolution,
            antialias: true,
          });
          hueTextures.set(racer.hue, texture);
          source.destroy();
          hueFilter.destroy();
        }
      }
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5, 1); // pivot aux pieds : squash & stretch au sol
      body.addChild(sprite);

      const label = new PIXI.Text({
        text: racer.name,
        style: { fontFamily: "sans-serif", fontSize: 13, fontWeight: "700", fill: 0xffffff, stroke: { color: 0x293c49, width: 4 } },
      });
      label.anchor.set(0.5, 1);
      label.y = -blobTexture.height - 4 - Math.min(labelIndex, 3) * LABEL_STAGGER;
      body.addChild(label);

      const avatar = createAvatar(racer);
      avatar.x = -label.width / 2 - AVATAR_SIZE / 2 - 4;
      avatar.y = label.y - label.height / 2;
      body.addChild(avatar);

      const bonus = new PIXI.Text({
        text: racer.bonusLabel ?? "",
        style: { fontFamily: "sans-serif", fontSize: 14, fontWeight: "700", fill: 0xffffff, stroke: { color: 0x293c49, width: 4 } },
      });
      bonus.anchor.set(0.5, 1);
      bonus.y = -blobTexture.height - 28;
      container.addChild(shadow, body, bonus);
      world.addChild(container);
      return { container, body, shadow, bonus, labelHalfWidth: label.width / 2 + AVATAR_SIZE + 6, x: startX, vx: 0, phase: 0, intensity: 0 };
    };

    const init = async () => {
      await app.init({
        backgroundColor: SCENE_COLORS[darkRef.current ? "dark" : "light"].background,
        resizeTo: host,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true,
        autoStart: false,
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
      const updateScene = (dt: number) => {
        const reducedMotion = reducedMotionRef.current;
        if (!reducedMotion) elapsed += dt;
        const list = racersRef.current;
        const length = trackLengthRef.current;
        const groundBottom = Math.max(0, app.screen.height - 34);
        // Garde une marge pour les étiquettes étagées, le saut, le stretch et le balancement.
        const groundTop = Math.min(groundBottom, Math.max((blobTexture.height + AVATAR_SIZE + 8 + Math.min(Math.max(0, list.length - 1), 3) * LABEL_STAGGER) * 1.08 + HOP_HEIGHT + AVATAR_SIZE,
          app.screen.height - PIXI.Assets.get<PIXI.Texture>("track").height));
        const laneGap = Math.min(14, (groundBottom - groundTop) / Math.max(1, list.length - 1));

        // Distances aux autres coureurs, bornées à ce que l'écran peut montrer.
        const localRacer = list.find((r) => r.isLocal) ?? list[0];
        const localRaw = localRacer ? (localRacer.progress / 100) * length : 0;
        const previousLocalX = (localRacer && views.get(localRacer.id)?.x) ?? localRaw;
        const localX = localRaw < previousLocalX - 50 ? localRaw : previousLocalX;
        const newViews = new Set<string>();
        list.forEach((racer, index) => {
          if (!views.has(racer.id)) {
            views.set(racer.id, createView(racer, blobTexture, localX, world, index));
            newViews.add(racer.id);
          }
        });
        // Le nom et l’avatar débordent du corps ; réserver aussi le retard de caméra.
        const labelHalfWidth = Math.max(0, ...list.map((racer) => views.get(racer.id)!.labelHalfWidth));
        const leftMargin = Math.min(app.screen.width * CAMERA_ANCHOR * 0.8,
          Math.max(EDGE_MARGIN, labelHalfWidth + MAX_SPEED / CAMERA_RATE));
        const maxAhead = Math.max(0, app.screen.width * (1 - CAMERA_ANCHOR) - EDGE_MARGIN);
        const maxBehind = Math.max(0, app.screen.width * CAMERA_ANCHOR - leftMargin);

        list.forEach((racer, index) => {
          const raw = (racer.progress / 100) * length;
          const target = racer === localRacer
            ? raw
            : localX + Math.max(-maxBehind, Math.min(maxAhead, raw - localRaw));
          const view = views.get(racer.id)!;
          if (newViews.has(racer.id)) view.x = target;

          view.bonus.text = racer.bonusLabel ?? "";

          // 1. Position : le Blob rejoint sa cible, mais sa vitesse est plafonnée à
          // MAX_SPEED et varie progressivement (pas de démarrage ni d'arrêt brutal).
          // Un joueur très en avance ne « file » donc pas hors de l'écran.
          if (target < view.x - 50) {
            view.x = target;
            view.vx = view.intensity = 0;
            if (racer === localRacer) cameraReady = false;
          }
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
          const k = reducedMotion ? 0 : view.intensity;

          // 3. Cycle de saut : la cadence suit la vitesse.
          if (!reducedMotion) view.phase += dt * (5 + k * 7);
          const s = Math.abs(Math.sin(view.phase)); // 0 au sol, 1 à l'apogée

          const groundY = groundBottom - index * laneGap;
          const hop = s * HOP_HEIGHT * k;
          const breathing = reducedMotion ? 0 : Math.sin(elapsed * 2.5 + index) * 0.02 * (1 - k);

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
      };
      const drawScene = () => {
        updateScene(1 / 60);
        app.render();
      };
      app.renderer.on("resize", () => {
        layoutLayers();
        if (!app.ticker.started) drawScene();
      });
      app.ticker.add((ticker) => {
        // Borne les gros sauts (onglet en veille).
        updateScene(Math.min(ticker.deltaMS / 1000, 0.05));
      });
      syncPlaybackRef.current = () => {
        app.ticker.maxFPS = playbackRef.current.maxFPS;
        if (playbackRef.current.paused) {
          drawScene();
          app.ticker.stop();
        } else {
          app.ticker.start();
        }
      };
      drawScene();
      syncPlaybackRef.current();
    };

    void init();

    return () => {
      isMounted = false;
      applyThemeRef.current = null;
      syncPlaybackRef.current = null;
      views.clear();
      if (initialized) app.destroy(true, { children: true });
      for (const texture of photoTextures) texture.destroy(true);
      photoTextures.length = 0;
      for (const texture of hueTextures.values()) texture.destroy(true);
      hueTextures.clear();
    };
  }, []);

  return (
    <div className={className}>
      <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />
    </div>
  );
}
