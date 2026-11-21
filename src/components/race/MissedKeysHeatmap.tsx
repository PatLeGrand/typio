import type { CSSProperties } from "react";
import { Keyboard } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatPlural } from "@/race/format";
import { placeMissedKeys } from "@/race/keyboard";

type Props = {
  missedKeys: Record<string, number>;
  locale: string;
  labels: Dictionary["raceScreen"]["results"];
};

export function MissedKeysHeatmap({ missedKeys, locale, labels }: Props) {
  const copy = labels.missedKeys;
  const { rows, other, mostMissed, max } = placeMissedKeys(missedKeys, locale === "fr" ? "fr" : "en");
  const number = new Intl.NumberFormat(locale);
  const name = (key: string) => key === " " ? copy.space : key;
  const description = ({ key, count }: { key: string; count: number }) =>
    formatPlural(locale, count, copy.keyLabel).replace("{key}", name(key)).replace("{count}", number.format(count));
  const heatStyle = (level: number): CSSProperties => ({ backgroundColor: `var(--heat-${level})` });

  return (
    <figure className="flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-4 shadow-soft sm:p-6">
      <figcaption className="flex items-center gap-2 border-b border-border pb-3 font-display text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl">
        <Keyboard aria-hidden="true" className="size-5 shrink-0 text-accent-text" />
        <span>{copy.title}</span>
      </figcaption>

      {max === 0 && (
        <p className="rounded-field border border-border bg-background px-3.5 py-2.5 text-sm font-semibold text-foreground">
          {copy.noErrors}
        </p>
      )}

      <div
        role="group"
        aria-label={locale === "fr" ? copy.azerty : copy.qwerty}
        className="flex min-w-0 flex-col gap-1 rounded-field border border-border bg-background p-2 sm:gap-1.5 sm:p-3"
      >
        {rows.map((row, index) => (
          <ul key={index} className="grid min-w-0 gap-0.5 sm:gap-1" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
            {row.map(({ key, count }) => (
              <li
                key={key}
                aria-label={description({ key, count })}
                title={description({ key, count })}
                className="flex min-w-0 flex-col items-center justify-center rounded-md border border-border px-0.5 py-2 text-center font-bold text-foreground sm:py-2.5"
                style={heatStyle(count === 0 ? 0 : Math.ceil(count / max * 3))}
              >
                <span aria-hidden="true" className="text-xs leading-none sm:text-sm">{key === " " ? copy.space : key}</span>
                {count > 0 && (
                  <span aria-hidden="true" className="mt-1 hidden text-[10px] font-semibold leading-none tabular-nums text-foreground sm:inline">
                    {number.format(count)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ))}
      </div>

      <ul aria-label={copy.legend} className="flex flex-wrap gap-3 text-xs text-muted">
        {copy.levels.map((label, level) => (
          <li key={label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block size-3.5 rounded border border-border" style={heatStyle(level)} />
            <span>{label}</span>
          </li>
        ))}
      </ul>

      {max > 0 && (
        <div className="rounded-field border border-border bg-background p-3.5 text-sm">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted">{copy.top}</h3>
          <ol className="mt-2.5 flex flex-col gap-2">
            {mostMissed.slice(0, 5).map((entry) => {
              const widthPct = Math.max(8, Math.round((entry.count / max) * 100));
              return (
                <li key={entry.key} className="flex flex-col gap-1">
                  <span className="font-semibold tabular-nums text-foreground">{description(entry)}</span>
                  <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${widthPct}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {other.length > 0 && (
        <div className="text-sm">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted">{copy.other}</h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {other.map((entry) => (
              <li key={entry.key} className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                {description(entry)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}
