"use client";

import { useRef } from "react";

type InteractiveVideoProps = {
  ariaLabel: string;
  fallbackText: string;
  src: string;
};

export function InteractiveVideo({ ariaLabel, fallbackText, src }: InteractiveVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  };

  return (
    <video
      ref={videoRef}
      aria-label={ariaLabel}
      autoPlay
      className="aspect-video w-full cursor-pointer rounded-[22px] bg-surface object-cover"
      loop
      muted
      playsInline
      preload="metadata"
      onClick={togglePlay}
    >
      <source src={src} type="video/mp4" />
      {fallbackText}
    </video>
  );
}
