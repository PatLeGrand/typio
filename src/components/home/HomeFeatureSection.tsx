import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { HomeMediaPlaceholder } from "./HomeMediaPlaceholder";

type HomeFeatureSectionProps = {
  home: Dictionary["home"];
  variant: "preview" | "detail";
};

export function HomeFeatureSection({ home, variant }: HomeFeatureSectionProps) {
  const isPreview = variant === "preview";
  const copy = isPreview ? home.preview : home.detail;

  return (
    <section
      id={isPreview ? "preview" : undefined}
      className="scroll-mt-24 bg-surface px-4 py-12 sm:px-8 sm:py-16 lg:py-20"
      aria-labelledby={`${variant}-title`}
    >
      <div className="mx-auto grid w-full max-w-[1264px] items-center gap-10 lg:grid-cols-[minmax(0,720px)_minmax(280px,1fr)] lg:gap-[88px]">
        <div className={isPreview ? "lg:order-1" : "lg:order-2"}>
          <HomeMediaPlaceholder
            kind="image"
            label={home.media.imageLabel}
            title={isPreview ? home.media.interfaceTitle : home.media.detailTitle}
            description={isPreview ? home.media.interfaceDescription : home.media.detailDescription}
            tone={isPreview ? "mint" : "sand"}
            className="w-full"
          />
        </div>
        <div className={`flex flex-col items-start gap-[22px] ${isPreview ? "lg:order-2" : "lg:order-1"}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{copy.eyebrow}</p>
          <h2 id={`${variant}-title`} className="text-3xl font-medium leading-[1.16] tracking-tight text-foreground sm:text-[42px]">
            {copy.title}
          </h2>
          <p className="text-base leading-[1.65] text-muted sm:text-lg">{copy.description}</p>
          {isPreview ? (
            <Link href="#video" className="rounded-field font-semibold text-accent-text hover:underline">
              {home.preview.videoLink} ↗
            </Link>
          ) : (
            <p className="text-sm text-muted">{home.detail.note}</p>
          )}
        </div>
      </div>
    </section>
  );
}
