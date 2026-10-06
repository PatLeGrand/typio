import type { Dictionary } from "@/i18n/dictionaries";
import { HomeMediaPlaceholder } from "./HomeMediaPlaceholder";

type HomeVideoSectionProps = {
  home: Dictionary["home"];
};

export function HomeVideoSection({ home }: HomeVideoSectionProps) {
  return (
    <section id="video" className="scroll-mt-24 bg-background px-4 py-16 sm:px-8 sm:py-20" aria-labelledby="video-title">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-10">
        <div className="flex max-w-[740px] flex-col items-center gap-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{home.video.eyebrow}</p>
          <h2 id="video-title" className="text-3xl font-medium leading-[1.16] tracking-tight text-foreground sm:text-[42px]">
            {home.video.title}
          </h2>
          <p className="text-base leading-[1.65] text-muted sm:text-lg">{home.video.description}</p>
        </div>
        <div className="w-full">
          <HomeMediaPlaceholder
            kind="video"
            label={home.media.videoLabel}
            title={home.media.videoTitle}
            description={home.media.videoDescription}
            note="16:9 · 1280 × 720 px"
            className="w-full"
          />
          <div className="mt-4 flex flex-col gap-1 text-xs text-muted sm:flex-row sm:justify-between sm:text-sm">
            <p>{home.media.videoPending}</p>
            <p>{home.media.videoFormat}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
