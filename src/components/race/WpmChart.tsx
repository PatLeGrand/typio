import type { CSSProperties } from "react";
import type { Dictionary } from "@/i18n/dictionaries";

type Props = {
  rows: readonly { id: string; name: string; wpm: number; wpmSeries: readonly number[] }[];
  locale: string;
  labels: Dictionary["raceScreen"]["results"];
  highlightId?: string;
};

export function WpmChart({ rows, locale, labels, highlightId }: Props) {
  const copy = labels.wpmChart;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const maxSecond = Math.max(1, ...rows.map((row) => row.wpmSeries.length - 1));
  const peak = Math.max(1, ...rows.map((row) => Math.max(0, ...row.wpmSeries)));
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
    <figure className="min-w-0 rounded-card border border-border bg-surface p-3 sm:p-5">
      <figcaption className="font-extrabold">{copy.title}</figcaption>
      <svg viewBox="0 0 480 330" role="img" aria-label={`${copy.title}. ${copy.accessibleSummary}`} className="w-full text-foreground">
        {Array.from({ length: 5 }, (_, i) => i * yStep).map((wpm) => (
          <g key={wpm}>
            <line x1="64" x2="456" y1={y(wpm)} y2={y(wpm)} stroke="var(--border)" />
            <text x="56" y={y(wpm) + 5} textAnchor="end" fill="currentColor" fontSize="14">{number.format(wpm)}</text>
          </g>
        ))}
        <path d="M64 40V270H456" fill="none" stroke="currentColor" />
        {xTicks.map((second) => (
          <g key={second}>
            <line x1={x(second)} x2={x(second)} y1="270" y2="275" stroke="currentColor" />
            <text x={x(second)} y="295" textAnchor="middle" fill="currentColor" fontSize="14">{number.format(second)}</text>
          </g>
        ))}
        <text x="260" y="322" textAnchor="middle" fill="currentColor" fontSize="16">{copy.timeAxis}</text>
        <text x="16" y="155" transform="rotate(-90 16 155)" textAnchor="middle" fill="currentColor" fontSize="16">{copy.wpmAxis}</text>
        {rows.map((row, index) => (
          <polyline key={row.id} points={row.wpmSeries.map((wpm, second) => `${x(second)},${y(wpm)}`).join(" ")} fill="none" className="wpm-series" style={seriesStyle(index)} stroke="currentColor" strokeWidth={row.id === highlightId ? 3 : 1.5} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <ul aria-label={copy.legend} className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {rows.map((row, index) => (
          <li key={row.id} className={`flex min-w-0 items-center gap-2 ${row.id === highlightId ? "font-extrabold" : ""}`}>
            <span aria-hidden="true" className="wpm-series inline-block w-5 shrink-0 border-t" style={{ ...seriesStyle(index), borderTopWidth: row.id === highlightId ? 3 : 1.5 }} />
            <span className="break-words">{row.name}</span>
          </li>
        ))}
      </ul>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer">{copy.dataSummary}</summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">{copy.accessibleSummary}</caption>
          <thead><tr>
            <th scope="col" className="p-2">{labels.columns.name}</th>
            <th scope="col" className="p-2">{copy.finalWpm}</th>
            <th scope="col" className="p-2">{copy.peakWpm}</th>
          </tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <th scope="row" className="break-words p-2">{row.name}</th>
              <td className="p-2">{number.format(row.wpm)}</td>
              <td className="p-2">{number.format(Math.max(0, ...row.wpmSeries))}</td>
            </tr>
          ))}</tbody>
        </table>
      </details>
    </figure>
  );
}
