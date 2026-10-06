import type { Dictionary } from "@/i18n/dictionaries";
import { InteractiveVideo } from "./InteractiveVideo";
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
          <div className="overflow-hidden rounded-[28px] border border-border bg-accent-panel p-2 shadow-sm sm:p-3">
            <InteractiveVideo 
              ariaLabel={home.media.videoLabel}
              fallbackText={home.media.videoDescription}
              src="/videos/typio-intro.mp4"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
