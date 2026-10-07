import { ButtonLink } from "@/components/ButtonLink";
import { getDictionary } from "@/i18n/dictionaries";
import { requireLocale } from "@/i18n/requireLocale";
import { deserializeRaceSettings, getEffectiveTimeLimitSeconds } from "@/race/config";

/** Entry boundary; the gameplay controller will consume the validated settings here. */
export default async function RacePage({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ config?: string | string[] }>;
}) {
  const locale = requireLocale((await params).lang);
  const settings = deserializeRaceSettings((await searchParams).config);
  const { raceSettings: labels, raceEntry: copy } = getDictionary(locale);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-12 text-foreground">
      <h1 className="text-3xl font-bold">{copy.title}</h1>
      {!settings ? <p role="alert">{copy.invalid}</p> : (
        <>
          <p role="status">{copy.pending}</p>
          <dl className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-surface p-6">
            <dt>{labels.textMode.label}</dt><dd>{labels.textMode[settings.textMode]}</dd>
            <dt>{labels.language.label}</dt><dd>{labels.language[settings.language]}</dd>
            <dt>{labels.length.label}</dt><dd>{labels.length[settings.length]}</dd>
            <dt>{labels.accents.label}</dt><dd>{settings.accents ? labels.accents.include : labels.accents.exclude}</dd>
            <dt>{labels.excludedChars.label}</dt><dd className="break-all">{settings.excludedCharacters || labels.excludedChars.none}</dd>
            <dt>{labels.timeLimit.label}</dt><dd>{getEffectiveTimeLimitSeconds(settings)} {labels.timeLimit.seconds}</dd>
            <dt>{labels.inputMode.label}</dt><dd>{labels.inputMode[settings.inputMode]}</dd>
            <dt>{labels.botCount.label}</dt><dd>{settings.botCount}</dd>
            <dt>{labels.botDifficulty.label}</dt><dd>{labels.botDifficulty[settings.botDifficulty]}</dd>
            <dt>{labels.abilities.label}</dt><dd>{labels.abilities.comingSoon}</dd>
          </dl>
        </>
      )}
      <ButtonLink href={`/${locale}/race/settings`}>{copy.back}</ButtonLink>
    </main>
  );
}
