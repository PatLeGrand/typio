"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { MediaPlaybackButton } from "./MediaPlaybackButton";

type InteractiveVideoProps = {
  ariaLabel: string;
  fallbackText: string;
  src: string;
  playLabel: string;
  pauseLabel: string;
  details: string;
};

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(listener: () => void) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const motionSnapshot = () => window.matchMedia(MOTION_QUERY).matches;
const serverMotionSnapshot = () => true;

export function InteractiveVideo({ ariaLabel, fallbackText, src, playLabel, pauseLabel, details }: InteractiveVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detailsId = useId();
  const manuallyPaused = useRef(false);
  const [playing, setPlaying] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeMotion, motionSnapshot, serverMotionSnapshot);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reducedMotion) video.pause();
    else if (!manuallyPaused.current) void video.play().catch(() => {});
  }, [reducedMotion]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      manuallyPaused.current = false;
      void videoRef.current.play().catch(() => {});
    } else {
      manuallyPaused.current = true;
      videoRef.current.pause();
    }
  };

  return (
    <div className="relative">
      <video
        ref={videoRef}
        aria-label={ariaLabel}
        aria-describedby={detailsId}
        className="aspect-video w-full rounded-[22px] bg-surface object-cover"
        loop
        muted
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src={src} type="video/mp4" />
        {fallbackText}
      </video>
      <MediaPlaybackButton playing={playing} label={playing ? pauseLabel : playLabel} onClick={togglePlay} />
      <p id={detailsId} className="sr-only">{details}</p>
    </div>
  );
}
