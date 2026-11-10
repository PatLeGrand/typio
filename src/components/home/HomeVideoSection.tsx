import type { Dictionary } from "@/i18n/dictionaries";
import { InteractiveVideo } from "./InteractiveVideo";
type HomeVideoSectionProps = {
  home: Dictionary["home"];
};

export function HomeVideoSection({ home }: HomeVideoSectionProps) {
  return (
    <section id="video" className="relative z-10 scroll-mt-24 py-16 pl-16 pr-6 md:scroll-mt-0 md:px-8 md:py-24" aria-labelledby="video-title">
      <div className="relative mx-auto max-w-[1120px] md:pl-40">
        <span data-track-point aria-hidden="true" className="absolute -top-8 left-20" />
        <span data-track-point aria-hidden="true" className="absolute -bottom-8 left-20" />
        <div className="flex min-w-0 flex-col gap-8 md:ml-auto md:max-w-[806px]">
          <div className="flex max-w-prose flex-col gap-4">
            <h2 id="video-title" className="text-balance text-3xl font-medium leading-[1.16] tracking-tight text-foreground sm:text-[42px]">
              {home.video.title}
            </h2>
            <p className="text-base leading-[1.65] text-muted sm:text-lg">{home.video.description}</p>
          </div>
          <div className="w-full">
            <div className="overflow-hidden rounded-[28px] border border-border bg-accent-panel p-2 shadow-sm sm:p-3">
              <InteractiveVideo
                ariaLabel={home.media.videoLabel}
                fallbackText={home.media.videoDescription}
                playLabel={home.media.videoPlay}
                pauseLabel={home.media.videoPause}
                details={home.media.videoDetails}
                src="/videos/typio-intro.mp4"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
