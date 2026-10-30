import type { Dictionary } from "@/i18n/dictionaries";
import type { createDrizzleProfileStatsRepository } from "@/race/drizzleProfileStatsRepository";

type Repository = ReturnType<typeof createDrizzleProfileStatsRepository>;
type Props = {
  stats: Awaited<ReturnType<Repository["getUserStats"]>>;
  history: Awaited<ReturnType<Repository["getWpmHistory"]>>;
  locale: string;
  labels: Dictionary["profile"]["stats"];
};

export function ProfileStats({ stats, history, locale, labels }: Props) {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const maximum = Math.max(1, ...history.map((row) => row.wpm));
  const x = (index: number) => history.length === 1 ? 314 : 64 + index * 500 / (history.length - 1);
  const y = (wpm: number) => 210 - wpm * 170 / maximum;
  const first = history[0];
  const last = history.at(-1);
  return (
    <section className="min-w-0 rounded-card border border-border bg-surface p-4" aria-labelledby="profile-stats-title">
      <h2 id="profile-stats-title" className="text-2xl font-bold">{labels.title}</h2>
      {!stats.raceCount ? <p className="mt-4 text-muted">{labels.empty}</p> : <>
        <dl className="my-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {([
            [labels.bestWpm, stats.bestWpm === null ? labels.noValue : number.format(stats.bestWpm)],
            [labels.averageWpm, stats.averageWpm === null ? labels.noValue : number.format(stats.averageWpm)],
            [labels.averageAccuracy, stats.averageAccuracy === null ? labels.noValue : percent.format(stats.averageAccuracy / 100)],
            [labels.raceCount, number.format(stats.raceCount)],
            [labels.wins, number.format(stats.wins)],
          ]).map(([label, value]) => <div key={label}><dt className="text-muted">{label}</dt><dd className="text-xl font-bold">{value}</dd></div>)}
        </dl>
        <h3 className="font-bold">{labels.chartTitle}</h3>
        {first && last ? <svg className="h-auto w-full" viewBox="0 0 600 270" role="img"
          aria-label={labels.chartSummary.replace("{count}", number.format(history.length)).replace("{first}", number.format(first.wpm)).replace("{last}", number.format(last.wpm))}>
          <g fill="var(--foreground)" className="text-[18px] md:text-[12px]">
            {[0, maximum / 2, maximum].map((value) => <g key={value}>
              <line x1="64" x2="564" y1={y(value)} y2={y(value)} stroke="var(--border)" />
              <text x="54" y={y(value) + 6} textAnchor="end">{number.format(value)}</text>
            </g>)}
            <text x="64" y="24">{labels.wpm}</text>
            <text x="64" y="245">{date.format(first.createdAt)}</text>
            {history.length > 1 && <text x="564" y="245" textAnchor="end">{date.format(last.createdAt)}</text>}
          </g>
          <polyline points={history.map((row, index) => `${x(index)},${y(row.wpm)}`).join(" ")} fill="none" stroke="var(--accent-text)" strokeWidth="3" />
          {history.map((row, index) => <circle key={row.id} cx={x(index)} cy={y(row.wpm)} r="3" fill="var(--accent-text)" />)}
        </svg> : <p className="mt-2 text-muted">{labels.noChart}</p>}
      </>}
    </section>
  );
}
