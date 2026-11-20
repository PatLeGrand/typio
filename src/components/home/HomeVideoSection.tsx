import type { Dictionary } from "@/i18n/dictionaries";
import { InteractiveVideo } from "./InteractiveVideo";

type HomeVideoSectionProps = {
  home: Dictionary["home"];
};

/** L'écran géant du stade : un cadre sombre dans les deux thèmes, comme un vrai écran éteint autour de l'image. */
export function HomeVideoSection({ home }: HomeVideoSectionProps) {
  return (
    <section id="video" className="scroll-mt-24 pb-20 md:pb-28" aria-labelledby="video-title">
      <div className="home-lane-content grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-start lg:gap-12">
        <div className="flex max-w-prose flex-col gap-4 lg:sticky lg:top-32">
          <h2 id="video-title" className="text-balance font-display text-[clamp(2.25rem,5vw,3.75rem)] font-black leading-[0.92] text-foreground">
            {home.video.title}
          </h2>
          <p className="text-lg leading-relaxed text-muted">{home.video.description}</p>
        </div>
        <div className="min-w-0">
          <div className="rounded-[28px] bg-screen p-2 shadow-[0_18px_40px_-24px_rgb(0_0_0/0.55)] sm:p-3">
            <InteractiveVideo
              ariaLabel={home.media.videoLabel}
              fallbackText={home.media.videoDescription}
              playLabel={home.media.videoPlay}
              pauseLabel={home.media.videoPause}
              details={home.media.videoDetails}
              src="/videos/typio-intro.mp4"
            />
          </div>
          <div aria-hidden="true" className="mx-auto flex w-2/3 justify-between px-6">
            <span className="h-6 w-2.5 bg-screen sm:h-10" />
            <span className="h-6 w-2.5 bg-screen sm:h-10" />
          </div>
        </div>
      </div>
    </section>
  );
}
