"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import type { TextLanguage, TextMode } from "@/realtime/protocol";

export type ChartPoint = {
  id: string;
  raceId: string;
  wpm: number;
  grossWpm: number;
  accuracy: number;
  personalBest: boolean;
  endedAtIso: string;
  textMode: TextMode;
  language: TextLanguage;
  rollingAvg5: number;
};

type Props = {
  points: readonly ChartPoint[];
  locale: Locale;
  labels: Dictionary["stats"]["progression"];
  modeLabels: Dictionary["stats"]["breakdowns"]["modes"];
  languageLabels: Dictionary["stats"]["breakdowns"]["languages"];
  personalBestLabel: string;
};

const WIDTH = 760;
const HEIGHT = 300;
const PAD_LEFT = 56;
const PAD_RIGHT = 24;
const PAD_TOP = 28;
const PAD_BOTTOM = 42;
const PLOT_W = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM;

export function StatsProgressionChart({
  points,
  locale,
  labels,
  modeLabels,
  languageLabels,
  personalBestLabel,
}: Props) {
  const [showGross, setShowGross] = useState(true);
  const [showRolling, setShowRolling] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    points.length > 0 ? points.length - 1 : null,
  );
  const headingId = useId();
  const gradientId = useId();

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const shortDate = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  if (points.length === 0) {
    return (
      <section aria-labelledby={headingId} className="min-w-0 rounded-card border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={headingId} className="font-display text-3xl font-black uppercase tracking-tight text-foreground">
            {labels.title}
          </h2>
        </div>
        <p className="mt-3 text-sm text-muted">{labels.noChart}</p>
      </section>
    );
  }

  const values = points.flatMap((p) => (showGross ? [p.wpm, p.grossWpm] : [p.wpm]));
  const rawMax = Math.max(10, ...values);
  const yStep = Math.max(5, Math.ceil(rawMax / 4 / 5) * 5);
  const maxWpm = yStep * 4;
  const bestNet = Math.max(...points.map((p) => p.wpm));

  const x = (index: number) =>
    points.length === 1 ? PAD_LEFT + PLOT_W / 2 : PAD_LEFT + (index / (points.length - 1)) * PLOT_W;
  const y = (wpm: number) => PAD_TOP + PLOT_H - (wpm / maxWpm) * PLOT_H;

  const netLine = points.map((p, i) => `${x(i)},${y(p.wpm)}`).join(" ");
  const grossLine = points.map((p, i) => `${x(i)},${y(p.grossWpm)}`).join(" ");
  const rollingLine = points.map((p, i) => `${x(i)},${y(p.rollingAvg5)}`).join(" ");
  const areaPath =
    points.length > 1
      ? `M ${x(0)} ${y(points[0].wpm)} ${points.slice(1).map((p, i) => `L ${x(i + 1)} ${y(p.wpm)}`).join(" ")} L ${x(points.length - 1)} ${PAD_TOP + PLOT_H} L ${x(0)} ${PAD_TOP + PLOT_H} Z`
      : null;

  const first = points[0];
  const last = points[points.length - 1];
  const midIndex = points.length > 4 ? Math.floor((points.length - 1) / 2) : null;
  const activePoint = selectedIndex !== null ? points[selectedIndex] ?? last : last;

  const ariaSummary = labels.chartAria
    .replace("{count}", number.format(points.length))
    .replace("{first}", number.format(first.wpm))
    .replace("{last}", number.format(last.wpm))
    .replace("{best}", number.format(bestNet));

  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 rounded-card border border-border bg-surface p-4 shadow-soft sm:p-6"
    >
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2
            id={headingId}
            className="flex items-center gap-2 font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl"
          >
            <TrendingUp aria-hidden="true" className="size-6 shrink-0 text-accent-text" />
            <span>{labels.title}</span>
          </h2>
          <p className="mt-1 text-sm text-muted">{labels.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={showGross}
            onClick={() => setShowGross((v) => !v)}
            className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-field border px-3 py-1.5 text-xs font-semibold transition-colors ${
              showGross
                ? "border-accent bg-accent-soft text-accent-text"
                : "border-border bg-background text-muted hover:text-foreground"
            }`}
          >
            <span
              aria-hidden="true"
              className="inline-block w-4 border-t-2 border-dashed"
              style={{ borderColor: "var(--series-2)" }}
            />
            <span>{labels.toggleGross}</span>
          </button>

          {points.length >= 3 && (
            <button
              type="button"
              aria-pressed={showRolling}
              onClick={() => setShowRolling((v) => !v)}
              className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-field border px-3 py-1.5 text-xs font-semibold transition-colors ${
                showRolling
                  ? "border-accent bg-accent-soft text-accent-text"
                  : "border-border bg-background text-muted hover:text-foreground"
              }`}
            >
              <span
                aria-hidden="true"
                className="inline-block w-4 border-t-2"
                style={{ borderColor: "var(--series-3)" }}
              />
              <span>{labels.toggleRolling}</span>
            </button>
          )}
        </div>
      </div>

      {/* Barre de lecture télémétrique du point actif */}
      {activePoint && (
        <div
          aria-live="polite"
          className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-field border border-border bg-background px-4 py-3 text-sm"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold text-foreground">
              <time dateTime={activePoint.endedAtIso}>{fullDate.format(new Date(activePoint.endedAtIso))}</time>
            </span>
            <span className="text-xs text-muted">
              {modeLabels[activePoint.textMode]} · {languageLabels[activePoint.language]}
            </span>
            {activePoint.personalBest && (
              <span className="rounded-full bg-key-yellow px-2.5 py-0.5 text-xs font-bold text-key-ink">
                {personalBestLabel}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 tabular-nums">
            <span>
              <span className="text-muted">{labels.netWpm}</span>{" "}
              <strong className="font-bold text-accent-text">{number.format(activePoint.wpm)}</strong>
            </span>
            <span>
              <span className="text-muted">{labels.grossWpm}</span>{" "}
              <strong className="font-semibold text-foreground">{number.format(activePoint.grossWpm)}</strong>
            </span>
            <span>
              <span className="text-muted">{labels.columns.accuracy}</span>{" "}
              <strong className="font-semibold text-foreground">{percent.format(activePoint.accuracy / 100)}</strong>
            </span>
            <Link
              href={`/${locale}/history/${activePoint.raceId}`}
              className="road-link-inline inline-flex items-center gap-1 font-semibold text-accent-text"
            >
              <span>{labels.openRace}</span>
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Graphique SVG */}
      <figure className="mt-4 min-w-0">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={ariaSummary}
          className="h-auto w-full text-foreground"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grille horizontale */}
          {Array.from({ length: 5 }, (_, i) => i * yStep).map((tick) => (
            <g key={tick}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--border)"
                strokeDasharray={tick === 0 ? undefined : "4 4"}
              />
              <text
                x={PAD_LEFT - 10}
                y={y(tick) + 4}
                textAnchor="end"
                fill="var(--muted)"
                fontSize="12"
                className="tabular-nums"
              >
                {number.format(tick)}
              </text>
            </g>
          ))}

          {/* Ligne repère du record */}
          <line
            x1={PAD_LEFT}
            x2={WIDTH - PAD_RIGHT}
            y1={y(bestNet)}
            y2={y(bestNet)}
            stroke="var(--track-accent)"
            strokeWidth="1.5"
            strokeDasharray="6 4"
            opacity="0.7"
          />

          {/* Dates sur l'axe X */}
          <text x={PAD_LEFT} y={HEIGHT - 12} textAnchor="start" fill="var(--muted)" fontSize="12">
            {shortDate.format(new Date(first.endedAtIso))}
          </text>
          {midIndex !== null && (
            <text x={x(midIndex)} y={HEIGHT - 12} textAnchor="middle" fill="var(--muted)" fontSize="12">
              {shortDate.format(new Date(points[midIndex].endedAtIso))}
            </text>
          )}
          {points.length > 1 && (
            <text x={WIDTH - PAD_RIGHT} y={HEIGHT - 12} textAnchor="end" fill="var(--muted)" fontSize="12">
              {shortDate.format(new Date(last.endedAtIso))}
            </text>
          )}

          {/* Aire sous la courbe nette */}
          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

          {/* Courbe MPM brut (optionnelle) */}
          {showGross && points.length > 1 && (
            <polyline
              points={grossLine}
              fill="none"
              stroke="var(--series-2)"
              strokeWidth="2"
              strokeDasharray="5 4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Moyenne mobile sur 5 courses (optionnelle) */}
          {showRolling && points.length >= 3 && (
            <polyline
              points={rollingLine}
              fill="none"
              stroke="var(--series-3)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Courbe MPM net principale */}
          {points.length > 1 && (
            <polyline
              points={netLine}
              fill="none"
              stroke="var(--series-1)"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Points interactifs */}
          {points.map((point, index) => {
            const cx = x(index);
            const cy = y(point.wpm);
            const isSelected = activePoint?.id === point.id;
            const pointLabel = labels.selectPoint
              .replace("{date}", shortDate.format(new Date(point.endedAtIso)))
              .replace("{wpm}", number.format(point.wpm))
              .replace("{accuracy}", percent.format(point.accuracy / 100));

            return (
              <g key={point.id}>
                {isSelected && (
                  <line
                    x1={cx}
                    x2={cx}
                    y1={PAD_TOP}
                    y2={PAD_TOP + PLOT_H}
                    stroke="var(--accent-text)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.6"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 6.5 : point.personalBest ? 5.5 : 4}
                  fill={point.personalBest ? "var(--key-yellow)" : "var(--series-1)"}
                  stroke={isSelected ? "var(--foreground)" : "var(--surface)"}
                  strokeWidth={isSelected ? 2.5 : 2}
                />
                {/* Zone de clic / focus agrandie */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="14"
                  fill="transparent"
                  className="cursor-pointer"
                  tabIndex={0}
                  role="button"
                  aria-label={pointLabel}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onFocus={() => setSelectedIndex(index)}
                  onClick={() => setSelectedIndex(index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedIndex(index);
                    }
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* Légende */}
        <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-1 w-5 rounded-full" style={{ backgroundColor: "var(--series-1)" }} />
              <span className="font-medium text-foreground">{labels.netWpm}</span>
            </li>
            {showGross && (
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: "var(--series-2)" }} />
                <span>{labels.grossWpm}</span>
              </li>
            )}
            {showRolling && points.length >= 3 && (
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block h-0.5 w-5" style={{ backgroundColor: "var(--series-3)" }} />
                <span>{labels.rollingAvg}</span>
              </li>
            )}
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block size-3 rounded-full border border-border bg-key-yellow" />
              <span>{labels.recordLine.replace("{wpm}", number.format(bestNet))}</span>
            </li>
          </ul>
          <span>{labels.inspectHint}</span>
        </figcaption>
      </figure>

      {/* Équivalent texte accessible (A11Y-03) */}
      <details className="mt-4 border-t border-border pt-3 text-sm">
        <summary className="cursor-pointer font-medium text-accent-text hover:underline">
          {labels.tableSummary}
        </summary>
        <div tabIndex={0} role="region" aria-label={labels.tableCaption} className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <caption className="sr-only">{labels.tableCaption}</caption>
            <thead>
              <tr className="border-b border-border text-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">{labels.columns.date}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{labels.columns.net}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{labels.columns.gross}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{labels.columns.rolling}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{labels.columns.accuracy}</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((point) => (
                <tr key={point.id} className="border-t border-border">
                  <th scope="row" className="whitespace-nowrap py-2 pr-3 font-medium">
                    <Link href={`/${locale}/history/${point.raceId}`} className="road-link-inline text-accent-text">
                      <time dateTime={point.endedAtIso}>{fullDate.format(new Date(point.endedAtIso))}</time>
                    </Link>
                  </th>
                  <td className="px-3 py-2 tabular-nums font-semibold">{number.format(point.wpm)}</td>
                  <td className="px-3 py-2 tabular-nums text-muted">{number.format(point.grossWpm)}</td>
                  <td className="px-3 py-2 tabular-nums text-muted">{number.format(point.rollingAvg5)}</td>
                  <td className="px-3 py-2 tabular-nums">{percent.format(point.accuracy / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
