import type { CSSProperties } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
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
    copy.keyLabel.replace("{key}", name(key)).replace("{count}", number.format(count));
  const heatStyle = (level: number): CSSProperties => ({ backgroundColor: `var(--heat-${level})` });

  return (
    <figure className="min-w-0 rounded-card border border-border bg-surface p-3 sm:p-5">
      <figcaption className="font-extrabold">{copy.title}</figcaption>
      {max === 0 && <p className="mt-3 text-sm">{copy.noErrors}</p>}
      <div role="group" aria-label={locale === "fr" ? copy.azerty : copy.qwerty} className="mx-auto my-4 flex max-w-2xl min-w-0 flex-col gap-1">
        {rows.map((row, index) => (
          <ul key={index} className="grid min-w-0 gap-0.5 sm:gap-1" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
            {row.map(({ key, count }) => (
              <li key={key} aria-label={description({ key, count })} className="min-w-0 rounded border border-border py-2 text-center text-xs font-bold text-foreground sm:text-sm" style={heatStyle(count === 0 ? 0 : Math.ceil(count / max * 3))}>
                <span aria-hidden="true">{key === " " ? copy.space : key}</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
      <ul aria-label={copy.legend} className="flex flex-wrap gap-3 text-xs">
        {copy.levels.map((label, level) => <li key={label} className="flex items-center gap-1"><span aria-hidden="true" className="inline-block size-4 rounded border border-border" style={heatStyle(level)} />{label}</li>)}
      </ul>
      {max > 0 && <div className="mt-4 text-sm">
        <h3 className="font-bold">{copy.top}</h3>
        <ol className="list-inside list-decimal">{mostMissed.slice(0, 5).map((entry) => <li key={entry.key}>{description(entry)}</li>)}</ol>
      </div>}
      {other.length > 0 && <div className="mt-4 text-sm">
        <h3 className="font-bold">{copy.other}</h3>
        <ul>{other.map((entry) => <li key={entry.key}>{description(entry)}</li>)}</ul>
      </div>}
    </figure>
  );
}
