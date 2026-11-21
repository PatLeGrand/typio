"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { autoCollapseDelay, isFirstVisit, nextTrackIndex, playbackVolume, readMusicPreferences, type MusicPreferences } from "./playerLogic";
import { playlist } from "./playlist";

const STORAGE_KEY = "typio:music";
const RACE_SELECTOR = ".room-race-screen";
const FADE_MS = 600;
const DOCKED_QUERY = "(min-width: 768px)";
const FOOTER_GAP = 12;

type Props = { labels: Dictionary["music"] };

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-current">
      {children}
    </svg>
  );
}

const controlClass =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-transparent text-accent-text hover:bg-accent-soft disabled:opacity-50";

export function MusicPlayer({ labels }: Props) {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const panelId = useId();
  const [prefs, setPrefs] = useState<MusicPreferences>({ volume: 0.5, muted: false, collapsed: true, paused: false });
  const [loaded, setLoaded] = useState(false);
  const [shouldAutoplay, setShouldAutoplay] = useState(false);
  // Accueil de la première visite : lecteur déplié 4 s, en pause tant qu'on le survole ou le focalise.
  const [welcoming, setWelcoming] = useState(false);
  const [holding, setHolding] = useState(false);
  const [activity, setActivity] = useState(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [raceInDom, setRaceInDom] = useState(false);
  const [widgetHeight, setWidgetHeight] = useState(0);
  const racing = raceInDom || /^\/[^/]+\/race\/?$/.test(pathname);
  const track = playlist[index];

  // Préférences : lues après le montage (le rendu serveur ne connaît pas localStorage).
  useEffect(() => {
    const read = () => window.localStorage.getItem(STORAGE_KEY);
    const stored = readMusicPreferences(read);
    setPrefs(stored);
    if (!stored.paused) setShouldAutoplay(true);
    if (isFirstVisit(read)) {
      setWelcoming(true);
      try {
        // Mémorise que l'accueil a eu lieu, même si l'onglet se ferme avant la fin des 4 s.
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      } catch {
        // Sans stockage, l'accueil se rejouerait : on s'en passe.
        setWelcoming(false);
      }
    }
    setLoaded(true);
  }, []);

  function updatePrefs(patch: Partial<MusicPreferences>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Stockage indisponible : les préférences ne durent que pour cette visite.
      }
      return next;
    });
  }

  // Course en cours (salle) et widget de salle active : observés sans toucher à ces composants.
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      setRaceInDom(document.querySelector(RACE_SELECTOR) !== null);
      const widget = document.querySelector("[data-active-room-widget]");
      setWidgetHeight(widget ? widget.getBoundingClientRect().height : 0);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Volume : initialisé directement avant la lecture, puis transition douce vers la cible (baissée pendant la course).
  const target = prefs.muted ? 0 : playbackVolume(prefs.volume, racing);
  const volumeInitializedRef = useRef(false);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !loaded) return;
    if (!volumeInitializedRef.current) {
      volumeInitializedRef.current = true;
      audio.volume = target;
      return;
    }
    const from = audio.volume;
    if (from === target) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min((now - start) / FADE_MS, 1);
      audio.volume = Math.min(1, Math.max(0, from + (target - from) * progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [loaded, target]);

  // Lancement automatique à l'ouverture, sauf si l'utilisateur avait mis la musique en pause.
  useEffect(() => {
    if (!loaded || !shouldAutoplay) return;
    const audio = audioRef.current;
    if (!audio) return;

    let cancelled = false;
    const clearUnlock = () => {
      document.removeEventListener("pointerdown", onInteract);
      document.removeEventListener("keydown", onInteract);
    };
    const armUnlock = () => {
      if (cancelled) return;
      document.addEventListener("pointerdown", onInteract);
      document.addEventListener("keydown", onInteract);
    };
    const tryPlay = () => {
      audio.play().then(
        () => {
          if (!cancelled) setShouldAutoplay(false);
        },
        (error: unknown) => {
          if (cancelled) return;
          if (error instanceof DOMException && error.name === "NotAllowedError") {
            armUnlock();
            return;
          }
          // Un changement de piste interrompt le play() en cours : skip relance sur la nouvelle piste.
          if (error instanceof DOMException && error.name === "AbortError") return;
          setShouldAutoplay(false);
          handlePlayError(error);
        },
      );
    };
    const onInteract = (event: Event) => {
      // Laisse le bouton lecture/pause gérer lui-même son clic sans conflit avec le pointerdown global.
      if (event.target instanceof Element && event.target.closest("[data-music-play]")) return;
      clearUnlock();
      if (!audio.paused) return;
      tryPlay();
    };

    tryPlay();

    return () => {
      cancelled = true;
      clearUnlock();
    };
  }, [loaded, shouldAutoplay]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    setShouldAutoplay(false);
    if (!audio.paused) {
      audio.pause();
      updatePrefs({ paused: true });
      return;
    }
    updatePrefs({ paused: false });
    try {
      setFailed(false);
      await audio.play();
    } catch {
      setFailed(true);
    }
  }

  // Intention de reprise : `pause` précède `ended`, `playing` n'est donc pas fiable à ce moment.
  const resumeRef = useRef(false);

  function handlePlayError(error: unknown) {
    // Un changement rapide de morceau interrompt le play() précédent : ce n'est pas une erreur.
    if (error instanceof DOMException && error.name === "AbortError") return;
    setFailed(true);
  }

  function skip(direction: 1 | -1, resume: boolean) {
    setFailed(false);
    const next = nextTrackIndex(index, direction, playlist.length);
    if (next === index) {
      // Morceau unique : l'index ne change pas, on relance directement.
      const audio = audioRef.current;
      if (audio && resume) {
        audio.currentTime = 0;
        audio.play().catch(handlePlayError);
      }
      return;
    }
    resumeRef.current = resume;
    setIndex(next);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !resumeRef.current) return;
    resumeRef.current = false;
    audio.play().catch(handlePlayError);
  }, [index]);

  // Sous md : place réservée sous le pied de page pour que le lecteur (fixe, en bas) ne le recouvre pas.
  // On mesure l'espace réellement présent sous le <footer> (widget de salle compris) au lieu de le déduire.
  useEffect(() => {
    const section = sectionRef.current;
    if (!loaded || !section || !track) return;
    const root = document.documentElement;
    const reserve = () => {
      const footer = document.querySelector("footer");
      if (!footer || window.matchMedia(DOCKED_QUERY).matches) {
        root.style.setProperty("--music-reserve", "0px");
        return;
      }
      const offset = 16 + (widgetHeight > 0 ? widgetHeight + 16 : 0);
      const current = parseFloat(root.style.getPropertyValue("--music-reserve")) || 0;
      const below = root.scrollHeight - (footer.getBoundingClientRect().bottom + window.scrollY) - current;
      const needed = offset + section.getBoundingClientRect().height + 8;
      root.style.setProperty("--music-reserve", `${Math.max(0, Math.ceil(needed - below))}px`);
    };
    reserve();
    const observer = new ResizeObserver(reserve);
    observer.observe(section);
    observer.observe(document.body);
    window.addEventListener("resize", reserve);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reserve);
      root.style.removeProperty("--music-reserve");
    };
  }, [loaded, widgetHeight, track, pathname]);

  // À partir de md : le lecteur (fixe, à 72 % de la hauteur) remonte au-dessus du pied de page
  // quand celui-ci entre dans la fenêtre. La variable est posée directement, sans re-rendu au défilement.
  useEffect(() => {
    const section = sectionRef.current;
    if (!loaded || !section || !track) return;
    const docked = window.matchMedia(DOCKED_QUERY);
    let frame = 0;
    const update = () => {
      frame = 0;
      const footer = document.querySelector("footer");
      let lift = 0;
      if (docked.matches && footer) {
        const bottom = window.innerHeight * 0.72 + section.offsetHeight / 2;
        lift = Math.max(0, bottom + FOOTER_GAP - footer.getBoundingClientRect().top);
      }
      section.style.setProperty("--music-footer-lift", `${Math.round(lift)}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      section.style.removeProperty("--music-footer-lift");
    };
  }, [loaded, track, pathname]);

  const open = !((prefs.collapsed && !welcoming) || racing);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!window.matchMedia(DOCKED_QUERY).matches) return;
      if (sectionRef.current?.contains(event.target as Node)) return;
      setWelcoming(false);
      updatePrefs({ collapsed: true });
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Repli automatique : 4 s pour l'aperçu, 3 s après la dernière interaction sinon.
  // `prefs` et `activity` relancent le compte à rebours (réglage du volume, clic, touche).
  useEffect(() => {
    const delay = autoCollapseDelay({ open, welcoming, holding });
    if (delay === null) return;
    const timer = window.setTimeout(() => {
      if (welcoming) setWelcoming(false);
      else updatePrefs({ collapsed: true });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [open, welcoming, holding, prefs, activity]);

  if (!track) return null;

  const lift: CSSProperties | undefined =
    widgetHeight > 0 ? ({ "--music-lift": `${widgetHeight + 16}px` } as CSSProperties) : undefined;
  const collapsed = (prefs.collapsed && !welcoming) || racing;

  return (
    <section
      ref={sectionRef}
      aria-label={labels.label}
      style={lift}
      className={`fixed right-4 bottom-[calc(1rem+var(--music-lift,0px))] z-30 flex max-w-[calc(100vw-2rem)] flex-col items-end text-foreground md:top-[72%] md:bottom-auto md:[translate:0_calc(-50%-var(--music-footer-lift,0px))] md:transition-[translate] md:duration-150 motion-reduce:transition-none ${loaded ? "" : "invisible"}`}
      onKeyDown={(event) => {
        setActivity((count) => count + 1);
        if (event.key !== "Escape" || collapsed) return;
        setWelcoming(false);
        updatePrefs({ collapsed: true });
        sectionRef.current?.querySelector<HTMLElement>("[data-music-toggle]")?.focus();
      }}
      onPointerEnter={() => setHolding(true)}
      onPointerLeave={() => setHolding(false)}
      onFocus={() => setHolding(true)}
      onBlur={() => setHolding(false)}
      onClick={(event) => {
        setActivity((count) => count + 1);
        // Toute commande utilisée pendant l'accueil garde le lecteur ouvert (le bouton de repli décide seul).
        if (!welcoming || (event.target as Element).closest("[data-music-toggle]")) return;
        setWelcoming(false);
        updatePrefs({ collapsed: false });
      }}
    >
      <audio
        ref={audioRef}
        src={`/music/${track.file}`}
        preload="none"
        onPlay={() => {
          setPlaying(true);
          setShouldAutoplay(false);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => skip(1, true)}
        onError={() => {
          setPlaying(false);
          setFailed(true);
        }}
      />
      <div className="flex max-w-full items-center rounded-full border-2 border-border bg-surface/85 p-1.5 shadow-soft">
        <button
          type="button"
          data-music-toggle
          className={controlClass}
          aria-expanded={!collapsed}
          aria-controls={panelId}
          aria-label={collapsed ? labels.expand : labels.collapse}
          disabled={racing}
          onClick={() => {
            setWelcoming(false);
            updatePrefs({ collapsed: !collapsed });
          }}
        >
          <span aria-hidden="true" className="flex items-center gap-1">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className={`size-1.5 rounded-full bg-accent-text ${playing ? "music-dot-active" : ""}`}
                style={{ animationDelay: `${dot * 0.15}s` }}
              />
            ))}
          </span>
        </button>
        <div
          id={panelId}
          inert={collapsed}
          className={`grid min-w-0 ${welcoming ? "" : "transition-[grid-template-columns,visibility] duration-300 motion-reduce:transition-none"} ${collapsed ? "invisible grid-cols-[0fr]" : "grid-cols-[1fr]"}`}
        >
          <div className="-m-1 flex min-w-0 items-center gap-2 overflow-hidden p-1 pl-3">
            <button type="button" className={controlClass} aria-label={labels.previous} onClick={() => skip(-1, playing || shouldAutoplay)}>
              <Icon><path d="M6 6h2v12H6zM20 6v12L9.5 12z" /></Icon>
            </button>
            <button
              type="button"
              data-music-play
              className={`${controlClass} border-accent bg-accent text-accent-foreground hover:bg-accent`}
              aria-label={playing ? labels.pause : labels.play}
              onClick={() => void togglePlay()}
            >
              <Icon>{playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}</Icon>
            </button>
            <button type="button" className={controlClass} aria-label={labels.next} onClick={() => skip(1, playing || shouldAutoplay)}>
              <Icon><path d="M16 6h2v12h-2zM4 6v12l10.5-6z" /></Icon>
            </button>
            <div className="hidden min-w-0 max-w-40 px-1 sm:block">
              <p className="truncate text-sm font-semibold" title={`${track.title} — ${track.artist}`}>{track.title}</p>
              <p className="truncate text-xs text-foreground">{track.artist}</p>
            </div>
            <button
              type="button"
              className={controlClass}
              aria-label={prefs.muted ? labels.unmute : labels.mute}
              aria-pressed={prefs.muted}
              onClick={() => updatePrefs({ muted: !prefs.muted })}
            >
              <Icon>
                {prefs.muted ? (
                  <path d="M3 9v6h4l5 5V4L7 9zM16.6 8.6 15.2 10l2 2-2 2 1.4 1.4 2-2 2 2 1.4-1.4-2-2 2-2-1.4-1.4-2 2z" />
                ) : (
                  <path d="M3 9v6h4l5 5V4L7 9zM16 8a5 5 0 0 1 0 8z" />
                )}
              </Icon>
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={prefs.volume}
              aria-label={labels.volume}
              onChange={(event) => updatePrefs({ volume: event.currentTarget.valueAsNumber })}
              className="mr-2 h-2 w-16 shrink accent-accent sm:w-24"
            />
          </div>
        </div>
      </div>
      {collapsed ? null : (
        <div className={`mt-2 max-w-72 rounded-2xl md:absolute md:inset-x-0 md:top-full md:max-w-none border border-border bg-surface/85 px-3 py-2 text-xs text-foreground shadow-soft ${failed ? "" : "sm:hidden"}`}>
          <p className="sm:hidden">
            <span className="font-semibold text-foreground">{track.title}</span> — {track.artist}
          </p>
          {failed ? <p role="alert" className="mt-1 text-danger">{labels.error}</p> : null}
        </div>
      )}
    </section>
  );
}
