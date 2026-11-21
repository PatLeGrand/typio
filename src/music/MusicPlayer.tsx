"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { nextTrackIndex, playbackVolume, readMusicPreferences, type MusicPreferences } from "./playerLogic";
import { playlist } from "./playlist";

const STORAGE_KEY = "typio:music";
const RACE_SELECTOR = ".room-race-screen";
const FADE_MS = 600;

type Props = { labels: Dictionary["music"] };

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-current">
      {children}
    </svg>
  );
}

const controlClass =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-surface text-accent-text hover:bg-accent-soft disabled:opacity-50";

export function MusicPlayer({ labels }: Props) {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [prefs, setPrefs] = useState<MusicPreferences>({ volume: 0.5, muted: false, collapsed: true });
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [raceInDom, setRaceInDom] = useState(false);
  const [widgetHeight, setWidgetHeight] = useState(0);
  const racing = raceInDom || /^\/[^/]+\/race\/?$/.test(pathname);
  const track = playlist[index];

  // Préférences : lues après le montage (le rendu serveur ne connaît pas localStorage).
  useEffect(() => {
    const stored = readMusicPreferences(() => {
      try {
        return window.localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    });
    setPrefs(stored);
    setLoaded(true);
  }, []);

  function updatePrefs(patch: Partial<MusicPreferences>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Stockage indisponible : les préférences ne durent que pour cette visite.
    }
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

  // Volume : transition douce vers la cible (baissée pendant la course).
  const target = prefs.muted ? 0 : playbackVolume(prefs.volume, racing);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const from = audio.volume;
    if (from === target) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min((now - start) / FADE_MS, 1);
      audio.volume = Math.min(1, Math.max(0, from + (target - from) * progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
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

  if (!track) return null;

  const lift: CSSProperties | undefined =
    widgetHeight > 0 ? ({ "--music-lift": `${widgetHeight + 16}px` } as CSSProperties) : undefined;
  const collapsed = prefs.collapsed || racing;

  return (
    <section
      aria-label={labels.label}
      style={lift}
      className={`fixed bottom-4 left-4 z-30 max-w-[calc(100vw-2rem)] text-foreground max-[860px]:bottom-[calc(1rem+var(--music-lift,0px))] ${loaded ? "" : "invisible"}`}
    >
      <audio
        ref={audioRef}
        src={`/music/${track.file}`}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => skip(1, true)}
        onError={() => {
          setPlaying(false);
          setFailed(true);
        }}
      />
      <div className="flex items-center gap-2 rounded-full border-2 border-border bg-surface p-1.5 shadow-soft">
        <button
          type="button"
          className={controlClass}
          aria-expanded={!collapsed}
          aria-label={collapsed ? labels.expand : labels.collapse}
          disabled={racing}
          onClick={() => updatePrefs({ collapsed: !prefs.collapsed })}
        >
          <span aria-hidden="true" className="flex h-4 items-end gap-0.5">
            {[0, 1, 2].map((bar) => (
              <span
                key={bar}
                className={`music-bar w-1 rounded-sm bg-accent ${playing ? "music-bar-active" : ""}`}
                style={{ animationDelay: `${bar * 0.2}s` }}
              />
            ))}
          </span>
        </button>
        {collapsed ? null : (
          <>
            <button type="button" className={controlClass} aria-label={labels.previous} onClick={() => skip(-1, playing)}>
              <Icon><path d="M6 6h2v12H6zM20 6v12L9.5 12z" /></Icon>
            </button>
            <button
              type="button"
              className={`${controlClass} border-accent bg-accent text-accent-foreground hover:bg-accent`}
              aria-label={playing ? labels.pause : labels.play}
              onClick={() => void togglePlay()}
            >
              <Icon>{playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}</Icon>
            </button>
            <button type="button" className={controlClass} aria-label={labels.next} onClick={() => skip(1, playing)}>
              <Icon><path d="M16 6h2v12h-2zM4 6v12l10.5-6z" /></Icon>
            </button>
            <div className="hidden min-w-0 max-w-40 px-1 sm:block">
              <p className="truncate text-sm font-semibold" title={`${track.title} — ${track.artist}`}>{track.title}</p>
              <p className="truncate text-xs text-muted-strong">{track.artist}</p>
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
          </>
        )}
      </div>
      {collapsed ? null : (
        <div className="mt-2 max-w-72 rounded-2xl border border-border bg-surface px-3 py-2 text-xs text-muted-strong shadow-soft">
          <p className="sm:hidden">
            <span className="font-semibold text-foreground">{track.title}</span> — {track.artist}
          </p>
          <p>{labels.credit.replace("{credit}", track.credit)}</p>
          {failed ? <p role="alert" className="mt-1 text-danger">{labels.error}</p> : null}
        </div>
      )}
    </section>
  );
}
