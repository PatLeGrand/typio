import type { CSSProperties } from "react";
import { Crown, Medal, Trophy } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { AvatarIdentity } from "@/components/avatar";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatOrdinal, formatPlural } from "@/race/format";

export type PodiumRow = {
  id: string;
  name: string;
  rank: number;
  wpm: number;
  avatar?: AvatarIdentity;
  status?: "finished" | "unfinished" | "abandoned";
  personalBest?: boolean;
};

type Props = {
  rows: readonly PodiumRow[];
  locale: string;
  labels: Dictionary["raceScreen"];
  highlightId?: string;
  headingLevel?: "h2" | "h3";
};

function tierFor(rank: number): 1 | 2 | 3 {
  if (rank <= 1) return 1;
  if (rank === 2) return 2;
  return 3;
}

const TIER_STYLES: Record<
  1 | 2 | 3,
  {
    cap: string;
    ring: string;
    height: string;
    delay: string;
    avatarSize: number;
  }
> = {
  1: {
    cap: "bg-key-yellow text-key-ink",
    ring: "ring-2 ring-key-yellow",
    height: "min-h-28 sm:min-h-40",
    delay: "220ms",
    avatarSize: 56,
  },
  2: {
    cap: "bg-key-mint text-key-ink",
    ring: "ring-2 ring-key-mint",
    height: "min-h-24 sm:min-h-30",
    delay: "110ms",
    avatarSize: 44,
  },
  3: {
    cap: "bg-key-coral text-key-ink",
    ring: "ring-2 ring-key-coral",
    height: "min-h-20 sm:min-h-24",
    delay: "0ms",
    avatarSize: 40,
  },
};

export function RacePodium({ rows, locale, labels, highlightId, headingLevel = "h3" }: Props) {
  if (rows.length === 0) return null;

  const wpmNumber = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const integer = new Intl.NumberFormat(locale);
  const top = rows.slice(0, 3);
  const localIndex = highlightId ? rows.findIndex((row) => row.id === highlightId) : -1;
  const localOutside = localIndex >= 3 ? rows[localIndex] : null;
  const Heading = headingLevel;

  const gridClass =
    top.length === 1
      ? "mx-auto grid max-w-sm grid-cols-1 gap-4"
      : top.length === 2
        ? "mx-auto grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end"
        : "grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end";

  const orderClass = (index: number) => {
    if (top.length === 3) {
      if (index === 0) return "sm:order-2";
      if (index === 1) return "sm:order-1";
      return "sm:order-3";
    }
    if (top.length === 2) {
      return index === 0 ? "sm:order-2" : "sm:order-1";
    }
    return "";
  };

  const countLabel = formatPlural(locale, rows.length, labels.results.participantsCount).replace(
    "{count}",
    integer.format(rows.length),
  );

  return (
    <section
      aria-label={labels.results.podium}
      className="min-w-0 overflow-hidden rounded-panel border-2 border-screen bg-screen text-screen-text shadow-soft"
    >
      {/* Bandeau supérieur du podium */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-screen-border bg-screen-surface px-4 py-3 sm:px-6">
        <Heading className="flex items-center gap-2 font-display text-2xl font-black uppercase tracking-tight text-screen-text sm:text-3xl">
          <Trophy aria-hidden="true" className="size-5 shrink-0 text-key-yellow" />
          <span>{labels.results.podium}</span>
        </Heading>
        <span className="rounded-full border border-screen-border bg-screen px-3 py-1 text-xs font-bold tabular-nums text-screen-muted">
          {countLabel}
        </span>
      </div>

      {/* Scène des trois marches */}
      <div className="overflow-hidden px-4 pt-6 pb-0 sm:px-6 sm:pt-8">
        <ol className={gridClass}>
          {top.map((row, index) => {
            const tier = tierFor(row.rank);
            const style = TIER_STYLES[tier];
            const isLocal = row.id === highlightId;
            const ordinal = formatOrdinal(locale, row.rank, labels.ordinal);

            return (
              <li
                key={row.id}
                style={{ "--podium-delay": style.delay } as CSSProperties}
                className={`podium-step flex min-w-0 flex-col items-center ${orderClass(index)}`}
              >
                {/* Identité au-dessus de la marche */}
                <div className="mb-3 flex w-full min-w-0 flex-col items-center gap-1.5 text-center">
                  <span
                    aria-hidden="true"
                    className={`inline-flex size-7 items-center justify-center rounded-full ${style.cap}`}
                  >
                    {tier === 1 ? <Crown className="size-4" /> : <Medal className="size-4" />}
                  </span>

                  <div className={`rounded-full p-0.5 ${isLocal ? "ring-2 ring-accent" : style.ring}`}>
                    <Avatar name={row.name} {...(row.avatar ?? { seed: row.id })} size={style.avatarSize} />
                  </div>

                  <div className="flex max-w-full min-w-0 flex-wrap items-center justify-center gap-1.5 px-1">
                    <span className="min-w-0 [overflow-wrap:anywhere] text-sm font-extrabold leading-snug text-screen-text sm:text-base">
                      {row.name}
                    </span>
                    {isLocal && (
                      <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-accent-foreground">
                        {labels.you}
                      </span>
                    )}
                  </div>

                  {row.personalBest && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-key-yellow px-2.5 py-0.5 text-[11px] font-extrabold text-key-ink">
                      <Trophy aria-hidden="true" className="size-3" />
                      <span>{labels.results.personalBest}</span>
                    </span>
                  )}
                </div>

                {/* Marche physique du podium */}
                <div
                  className={`flex w-full min-w-0 flex-col justify-between overflow-hidden rounded-t-2xl border-x border-t ${
                    isLocal ? "border-accent bg-screen-surface" : "border-screen-border bg-screen-surface"
                  } ${style.height}`}
                >
                  <div className={`flex items-center justify-between gap-2 px-3.5 py-2 ${style.cap}`}>
                    <span className="font-display text-2xl font-black leading-none tracking-tight tabular-nums sm:text-3xl">
                      {ordinal}
                    </span>
                    {row.status && row.status !== "finished" && (
                      <span className="truncate text-[11px] font-extrabold uppercase tracking-wide">
                        {labels.results.statuses[row.status]}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col items-center justify-center px-3 py-3 text-center">
                    <span
                      className={`font-display font-black leading-none tabular-nums ${
                        tier === 1
                          ? "text-4xl text-key-yellow sm:text-5xl"
                          : "text-3xl text-screen-text sm:text-4xl"
                      }`}
                    >
                      {wpmNumber.format(row.wpm)}
                    </span>
                    <span className="mt-1 text-xs font-bold uppercase tracking-wider text-screen-muted">
                      {labels.results.columns.wpm}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Ligne d'arrivée en tartan et damier (écho à la piste DES-04) */}
      <div aria-hidden="true" className="track-surface flex h-3 items-center justify-between px-4 sm:px-6">
        <span className="track-checker h-full w-16" />
        <span className="track-checker h-full w-16" />
      </div>

      {/* Rappel visible de ta position si tu es hors du top 3 */}
      {localOutside && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-screen-border bg-screen-surface px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-accent-foreground">
              {labels.results.yourPosition}
            </span>
            <span className="font-display text-2xl font-black leading-none tabular-nums text-key-yellow sm:text-3xl">
              {formatOrdinal(locale, localOutside.rank, labels.ordinal)}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={localOutside.name} {...(localOutside.avatar ?? { seed: localOutside.id })} size={30} />
              <span className="min-w-0 [overflow-wrap:anywhere] text-sm font-bold text-screen-text">
                {localOutside.name}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm tabular-nums">
            <span className="font-extrabold text-screen-text">
              {wpmNumber.format(localOutside.wpm)}{" "}
              <span className="text-xs font-bold uppercase text-screen-muted">{labels.results.columns.wpm}</span>
            </span>
            {localOutside.status && localOutside.status !== "finished" && (
              <span className="rounded-full border border-screen-border bg-screen px-2.5 py-0.5 text-xs font-semibold text-screen-muted">
                {labels.results.statuses[localOutside.status]}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
