import type { CSSProperties } from "react";
import Link from "next/link";
import { Keyboard } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import type { KeyboardLayout } from "@/profile/profileSettings";
import { formatPlural } from "@/race/format";
import { placeMissedKeys } from "@/race/keyboard";
import { ButtonLink } from "@/components/ButtonLink";

type Props = {
  missedKeys: Record<string, number>;
  totalMissedCount: number;
  keyboardLayout: KeyboardLayout;
  locale: Locale;
  labels: Dictionary["stats"]["heatmap"];
  keyLabels: Dictionary["raceScreen"]["results"]["missedKeys"];
  layoutNames: Dictionary["profile"]["settings"]["layouts"];
};

export function CumulativeMissedKeys({
  missedKeys,
  totalMissedCount,
  keyboardLayout,
  locale,
  labels,
  keyLabels,
  layoutNames,
}: Props) {
  const { rows, other, mostMissed, max } = placeMissedKeys(missedKeys, locale, keyboardLayout);
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const keyName = (key: string) => (key === " " ? keyLabels.space : key);
  const describe = ({ key, count }: { key: string; count: number }) =>
    formatPlural(locale, count, keyLabels.keyLabel)
      .replace("{key}", keyName(key))
      .replace("{count}", number.format(count));
  const heatStyle = (level: number): CSSProperties => ({ backgroundColor: `var(--heat-${level})` });

  const keyboardAriaLabel =
    keyboardLayout === "azerty"
      ? keyLabels.azerty
      : keyboardLayout === "cmf"
        ? keyLabels.cmf
        : keyLabels.qwerty;

  const totalBadge = formatPlural(locale, totalMissedCount, labels.totalMissed).replace(
    "{count}",
    number.format(totalMissedCount),
  );

  return (
    <section
      aria-labelledby="stats-heatmap-title"
      className="min-w-0 rounded-card border border-border bg-surface p-4 shadow-soft sm:p-6"
    >
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2
            id="stats-heatmap-title"
            className="flex items-center gap-2 font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl"
          >
            <Keyboard aria-hidden="true" className="size-6 shrink-0 text-accent-text" />
            <span>{labels.title}</span>
          </h2>
          <p className="mt-1 text-sm text-muted">{labels.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="rounded-full border border-border bg-background px-3 py-1 font-semibold text-foreground">
            {labels.layoutBadge.replace("{layout}", layoutNames[keyboardLayout])}
          </span>
          <Link href={`/${locale}/profile`} className="road-link-inline font-semibold text-accent-text">
            {labels.changeLayout}
          </Link>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-start">
        {/* Clavier heatmap */}
        <figure className="min-w-0">
          <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span className="font-semibold text-foreground tabular-nums">{totalBadge}</span>
            <ul aria-label={keyLabels.legend} className="flex flex-wrap gap-3">
              {keyLabels.levels.map((levelLabel, level) => (
                <li key={levelLabel} className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="inline-block size-3.5 rounded border border-border"
                    style={heatStyle(level)}
                  />
                  <span>{levelLabel}</span>
                </li>
              ))}
            </ul>
          </figcaption>

          <div
            role="group"
            aria-label={keyboardAriaLabel}
            className="flex min-w-0 flex-col gap-1.5 rounded-field border border-border bg-background p-2.5 sm:p-4"
          >
            {rows.map((row, rowIndex) => (
              <ul
                key={rowIndex}
                className="grid min-w-0 gap-1"
                style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
              >
                {row.map(({ key, count }) => {
                  const level = count === 0 || max === 0 ? 0 : Math.ceil((count / max) * 3);
                  return (
                    <li
                      key={key}
                      aria-label={describe({ key, count })}
                      title={describe({ key, count })}
                      className="flex min-w-0 flex-col items-center justify-center rounded-md border border-border px-0.5 py-2 text-center font-bold text-foreground sm:py-2.5"
                      style={heatStyle(level)}
                    >
                      <span aria-hidden="true" className="text-xs leading-none sm:text-sm">
                        {keyName(key)}
                      </span>
                      {count > 0 && (
                        <span aria-hidden="true" className="mt-1 hidden text-[10px] font-semibold tabular-nums text-foreground sm:inline">
                          {number.format(count)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}
          </div>
        </figure>

        {/* Top 5 des touches à travailler + autres caractères */}
        <div className="flex min-w-0 flex-col gap-4 rounded-field border border-border bg-background p-4">
          <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight text-foreground">
            {labels.topTitle}
          </h3>

          {max === 0 ? (
            <p className="text-sm leading-relaxed text-muted">{labels.noErrors}</p>
          ) : (
            <>
              <ol className="flex flex-col gap-3">
                {mostMissed.slice(0, 5).map((entry) => {
                  const widthPct = Math.max(8, Math.round((entry.count / max) * 100));
                  const share = totalMissedCount > 0 ? entry.count / totalMissedCount : 0;
                  return (
                    <li key={entry.key} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="inline-flex items-center gap-2 font-bold text-foreground">
                          <kbd className="inline-flex min-w-8 items-center justify-center rounded-md border border-border bg-key-yellow px-2 py-0.5 text-xs font-extrabold text-key-ink">
                            {keyName(entry.key)}
                          </kbd>
                          <span className="tabular-nums">{number.format(entry.count)}</span>
                        </span>
                        <span className="text-xs tabular-nums text-muted">
                          {labels.share.replace("{percent}", percent.format(share))}
                        </span>
                      </div>
                      <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-full bg-surface">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${widthPct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ol>

              {other.length > 0 && (
                <div className="border-t border-border pt-3 text-xs">
                  <h4 className="font-bold text-foreground">{keyLabels.other}</h4>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {other.slice(0, 8).map((entry) => (
                      <li
                        key={entry.key}
                        className="rounded border border-border bg-surface px-2 py-0.5 tabular-nums text-foreground"
                      >
                        {describe(entry)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-1">
                <ButtonLink href={`/${locale}/race/settings`} variant="secondary" fullWidth>
                  {labels.practiceCta}
                </ButtonLink>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
