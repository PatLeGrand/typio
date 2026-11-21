import type { CSSProperties } from "react";
import { Activity } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";

type Props = {
  rows: readonly { id: string; name: string; wpm: number; timeMs: number; wpmSeries: readonly number[] }[];
  locale: string;
  labels: Dictionary["raceScreen"]["results"];
  highlightId?: string;
};

export function WpmChart({ rows, locale, labels, highlightId }: Props) {
  const copy = labels.wpmChart;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const maxSecond = Math.max(1, ...rows.map((row) => row.timeMs / 1000));
  const peak = Math.max(1, ...rows.map((row) => Math.max(row.wpm, ...row.wpmSeries.slice(0, Math.ceil(row.timeMs / 1000)))));
  const yStep = Math.max(1, Math.ceil(peak / 4));
  const maxWpm = yStep * 4;
  const xStep = Math.max(1, Math.ceil(maxSecond / 4));
  const xTicks = Array.from({ length: Math.floor(maxSecond / xStep) + 1 }, (_, i) => i * xStep);
  const seriesStyle = (index: number) => ({
    "--series-base": `var(--series-${index % 6 + 1})`,
    "--series-weight": `${100 - Math.floor(index / 6) * 12}%`,
  }) as CSSProperties;
  const x = (second: number) => 64 + second / maxSecond * 392;
  const y = (wpm: number) => 270 - wpm / maxWpm * 230;

  return (
    <figure className="flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-4 shadow-soft sm:p-6">
      <figcaption className="flex items-center gap-2 border-b border-border pb-3 font-display text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl">
        <Activity aria-hidden="true" className="size-5 shrink-0 text-accent-text" />
        <span>{copy.title}</span>
      </figcaption>

      <div className="rounded-field border border-border bg-background p-2 sm:p-3">
        <svg viewBox="0 0 480 330" role="img" aria-label={`${copy.title}. ${copy.accessibleSummary}`} className="mx-auto w-full max-w-[480px] text-foreground">
          {Array.from({ length: 5 }, (_, i) => i * yStep).map((wpm) => (
            <g key={wpm}>
              <line x1="64" x2="456" y1={y(wpm)} y2={y(wpm)} stroke="var(--border)" strokeDasharray={wpm === 0 ? undefined : "4 4"} />
              <text x="56" y={y(wpm) + 5} textAnchor="end" fill="var(--muted)" fontSize="13" fontWeight="600">{number.format(wpm)}</text>
            </g>
          ))}
          <path d="M64 40V270H456" fill="none" stroke="var(--muted)" strokeWidth="1.25" />
          {xTicks.map((second) => (
            <g key={second}>
              <line x1={x(second)} x2={x(second)} y1="270" y2="275" stroke="var(--muted)" />
              <text x={x(second)} y="295" textAnchor="middle" fill="var(--muted)" fontSize="13" fontWeight="600">{number.format(second)}</text>
            </g>
          ))}
          <text x="260" y="322" textAnchor="middle" fill="var(--muted)" fontSize="14" fontWeight="700">{copy.timeAxis}</text>
          <text x="16" y="155" transform="rotate(-90 16 155)" textAnchor="middle" fill="var(--muted)" fontSize="14" fontWeight="700">{copy.wpmAxis}</text>
          {rows.map((row, index) => (
            <polyline
              key={row.id}
              points={[...row.wpmSeries.flatMap((wpm, second) => second * 1000 < row.timeMs ? [`${x(second)},${y(wpm)}`] : []), `${x(row.timeMs / 1000)},${y(row.wpm)}`].join(" ")}
              fill="none"
              className="wpm-series"
              style={seriesStyle(index)}
              stroke="currentColor"
              strokeWidth={row.id === highlightId ? 3.25 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>

      <ul aria-label={copy.legend} className="flex max-h-36 flex-wrap gap-2 overflow-y-auto text-xs sm:text-sm">
        {rows.map((row, index) => (
          <li
            key={row.id}
            className={`flex min-w-0 items-center gap-2 rounded-full border px-2.5 py-1 ${
              row.id === highlightId
                ? "border-accent bg-accent-panel font-extrabold text-foreground"
                : "border-border bg-background text-foreground"
            }`}
          >
            <span aria-hidden="true" className="wpm-series inline-block w-4 shrink-0 border-t" style={{ ...seriesStyle(index), borderTopWidth: row.id === highlightId ? 3 : 2 }} />
            <span className="[overflow-wrap:anywhere]">{row.name}</span>
          </li>
        ))}
      </ul>

      <details className="rounded-field border border-border bg-background px-3 py-2 text-sm">
        <summary className="cursor-pointer font-semibold text-foreground">{copy.dataSummary}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full table-fixed text-left [overflow-wrap:anywhere]">
            <caption className="sr-only">{copy.accessibleSummary}</caption>
            <thead>
              <tr className="text-xs font-bold uppercase tracking-wider text-muted">
                <th scope="col" className="w-1/2 p-2">{labels.columns.name}</th>
                <th scope="col" className="p-2">{copy.finalWpm}</th>
                <th scope="col" className="p-2">{copy.peakWpm}</th>
              </tr>
            </thead>
            <tbody>{rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <th scope="row" className="break-words p-2 font-semibold">{row.name}</th>
                <td className="p-2 tabular-nums">{number.format(row.wpm)}</td>
                <td className="p-2 tabular-nums">{number.format(Math.max(row.wpm, ...row.wpmSeries.slice(0, Math.ceil(row.timeMs / 1000))))}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
