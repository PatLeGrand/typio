import Link from "next/link";
import { ArrowUpRight, BarChart3, Flag, Gauge, Target, TrendingUp, Trophy, Zap } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { createDrizzleProfileStatsRepository } from "@/race/drizzleProfileStatsRepository";

type Repository = ReturnType<typeof createDrizzleProfileStatsRepository>;
type Props = {
  stats: Awaited<ReturnType<Repository["getUserStats"]>>;
  history: Awaited<ReturnType<Repository["getWpmHistory"]>>;
  locale: string;
  labels: Dictionary["profile"]["stats"];
};

const WPM_GRADIENT_ID = "profile-stats-wpm-gradient";

export function ProfileStats({ stats, history, locale, labels }: Props) {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const maximum = Math.max(1, ...history.map((row) => row.wpm));
  const x = (index: number) => (history.length === 1 ? 314 : 64 + (index * 500) / (history.length - 1));
  const y = (wpm: number) => 210 - (wpm * 170) / maximum;
  const first = history[0];
  const last = history.at(-1);

  const kpis = [
    {
      label: labels.bestWpm,
      value: stats.bestWpm === null ? labels.noValue : number.format(stats.bestWpm),
      icon: Zap,
      highlight: true,
    },
    {
      label: labels.averageWpm,
      value: stats.averageWpm === null ? labels.noValue : number.format(stats.averageWpm),
      icon: Gauge,
      highlight: false,
    },
    {
      label: labels.averageAccuracy,
      value: stats.averageAccuracy === null ? labels.noValue : percent.format(stats.averageAccuracy / 100),
      icon: Target,
      highlight: false,
    },
    {
      label: labels.raceCount,
      value: number.format(stats.raceCount),
      icon: Flag,
      highlight: false,
    },
    {
      label: labels.wins,
      value: number.format(stats.wins),
      icon: Trophy,
      highlight: false,
    },
  ];

  const linePoints = history.map((row, index) => `${x(index)},${y(row.wpm)}`).join(" ");
  const areaPoints =
    history.length > 1 ? `${x(0)},${y(0)} ${linePoints} ${x(history.length - 1)},${y(0)}` : "";

  return (
    <section
      className="min-w-0 rounded-card border border-border bg-surface p-6 md:p-8 shadow-soft"
      aria-labelledby="profile-stats-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent-soft text-accent-text rounded-[10px]">
            <BarChart3 aria-hidden="true" className="w-6 h-6" />
          </div>
          <h2 id="profile-stats-title" className="text-xl font-bold text-foreground">
            {labels.title}
          </h2>
        </div>
        <Link
          href={`/${locale}/stats`}
          className="inline-flex items-center gap-1.5 rounded-field border border-border bg-background/60 px-3.5 py-2 text-sm font-semibold text-accent-text transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span>{labels.viewAll}</span>
          <ArrowUpRight aria-hidden="true" className="w-4 h-4 shrink-0" />
        </Link>
      </div>

      {!stats.raceCount ? (
        <div className="mt-6 rounded-card border border-dashed border-border bg-background/50 p-6 text-center">
          <p className="text-sm text-muted">{labels.empty}</p>
        </div>
      ) : (
        <>
          <dl className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {kpis.map(({ label, value, icon: Icon, highlight }) => (
              <div
                key={label}
                className="rounded-card border border-border bg-background/60 p-4 flex flex-col gap-2"
              >
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <Icon aria-hidden="true" className="w-4 h-4 shrink-0 text-accent-text" />
                  <span>{label}</span>
                </dt>
                <dd
                  className={`text-2xl font-bold tracking-tight tabular-nums ${
                    highlight ? "text-accent-text" : "text-foreground"
                  }`}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="rounded-card border border-border bg-background/50 p-4 md:p-5">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp aria-hidden="true" className="w-4 h-4 shrink-0 text-accent-text" />
              <h3 className="text-sm font-semibold text-foreground">{labels.chartTitle}</h3>
            </div>

            {first && last ? (
              <svg
                className="h-auto w-full"
                viewBox="0 0 600 270"
                role="img"
                aria-label={labels.chartSummary
                  .replace("{count}", number.format(history.length))
                  .replace("{first}", number.format(first.wpm))
                  .replace("{last}", number.format(last.wpm))}
              >
                <defs>
                  <linearGradient id={WPM_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-text)" stopOpacity="0.24" />
                    <stop offset="100%" stopColor="var(--accent-text)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <g fill="var(--foreground)" className="text-[18px] md:text-[12px]">
                  {[0, maximum / 2, maximum].map((value) => (
                    <g key={value}>
                      <line
                        x1="64"
                        x2="564"
                        y1={y(value)}
                        y2={y(value)}
                        stroke="var(--border)"
                        strokeDasharray="4 4"
                      />
                      <text x="54" y={y(value) + 6} textAnchor="end">
                        {number.format(value)}
                      </text>
                    </g>
                  ))}
                  <text x="64" y="24">
                    {labels.wpm}
                  </text>
                  <text x="64" y="245">
                    {date.format(first.createdAt)}
                  </text>
                  {history.length > 1 && (
                    <text x="564" y="245" textAnchor="end">
                      {date.format(last.createdAt)}
                    </text>
                  )}
                </g>
                {areaPoints && <polygon points={areaPoints} fill={`url(#${WPM_GRADIENT_ID})`} />}
                <polyline
                  points={linePoints}
                  fill="none"
                  stroke="var(--accent-text)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {history.map((row, index) => (
                  <circle
                    key={row.id}
                    cx={x(index)}
                    cy={y(row.wpm)}
                    r="4"
                    fill="var(--accent-text)"
                    stroke="var(--surface)"
                    strokeWidth="2"
                  />
                ))}
              </svg>
            ) : (
              <div className="rounded-field border border-dashed border-border bg-surface/60 px-4 py-6 text-center">
                <p className="text-sm text-muted">{labels.noChart}</p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
