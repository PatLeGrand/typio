"use client";

import { useEffect, useRef } from "react";
import { Trophy } from "lucide-react";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatDuration, formatOrdinal } from "@/race/format";
import type { RaceResultRow } from "@/race/results";

type Props = {
  locale: Locale;
  labels: Dictionary["raceScreen"];
  rows: readonly RaceResultRow[];
  headline: string;
  settingsHref: string;
  onReplay: () => void;
};

/** Écran de résultats (RES-1, RES-2) : podium des trois premiers puis tableau de tous les coureurs. */
export function RaceResults({ locale, labels, rows, headline, settingsHref, onReplay }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const copy = labels.results;
  const podium = rows.slice(0, 3);
  const player = rows.find((row) => row.isPlayer);

  // La fin de course est annoncée en amenant le focus sur le titre.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-2">
        <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold outline-none">{headline}</h2>
        {player ? (
          <p className="text-sm text-muted">
            {formatOrdinal(locale, player.rank, labels.ordinal)} {labels.rankOf} {rows.length}
            {" · "}{player.wpm} {copy.columns.wpm}
            {" · "}{player.accuracy}% {copy.columns.accuracy}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-lg font-extrabold">
          <Trophy aria-hidden="true" className="size-5 text-accent-text" />
          {copy.podium}
        </h3>
        <ol className="grid gap-3 sm:grid-cols-3">
          {podium.map((row) => (
            <li
              key={row.id}
              className={`flex flex-col gap-1 rounded-card border-2 px-5 py-4 ${row.isPlayer ? "border-accent bg-accent-panel" : "border-border bg-surface"}`}
            >
              <span className="text-2xl font-black text-accent-text">{formatOrdinal(locale, row.rank, labels.ordinal)}</span>
              <span className="font-extrabold">{row.name}</span>
              <span className="text-sm text-muted">{row.wpm} {copy.columns.wpm}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <caption className="sr-only">{copy.tableTitle}</caption>
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th scope="col" className="px-4 py-3">{copy.columns.rank}</th>
              <th scope="col" className="px-4 py-3">{copy.columns.name}</th>
              <th scope="col" className="px-4 py-3">{copy.columns.wpm}</th>
              <th scope="col" className="px-4 py-3">{copy.columns.accuracy}</th>
              <th scope="col" className="px-4 py-3">{copy.columns.time}</th>
              <th scope="col" className="px-4 py-3">{copy.columns.status}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={`border-b border-border last:border-b-0 ${row.isPlayer ? "bg-accent-panel font-bold" : ""}`}>
                <td className="px-4 py-3">{formatOrdinal(locale, row.rank, labels.ordinal)}</td>
                <th scope="row" className="px-4 py-3 font-bold">{row.name}</th>
                <td className="px-4 py-3 tabular-nums">{row.wpm}</td>
                <td className="px-4 py-3 tabular-nums">
                  {row.accuracy === null ? (
                    <>
                      <span aria-hidden="true">—</span>
                      <span className="sr-only">{copy.notAvailable}</span>
                    </>
                  ) : `${row.accuracy}%`}
                </td>
                <td className="px-4 py-3 tabular-nums">{formatDuration(row.timeMs)}</td>
                <td className="px-4 py-3">{copy.statuses[row.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onReplay}>{copy.replay}</Button>
        <ButtonLink href={settingsHref} variant="secondary">{copy.editSettings}</ButtonLink>
      </div>
    </section>
  );
}
