import { getCurrentUserForDisplay } from "@/auth/currentUser";
import { ButtonLink } from "@/components/ButtonLink";
import { RaceScreen } from "@/components/race/RaceScreen";
import { getDictionary } from "@/i18n/dictionaries";
import { requireLocale } from "@/i18n/requireLocale";
import { deserializeRaceSettings } from "@/race/config";
import { createRaceText } from "@/race/raceText";

/** Seed for the bot names, drawn on the server with the text so hydration matches. */
function drawBotNameSeed(): number {
  return Math.floor(Math.random() * 4294967296);
}

/**
 * Entry boundary: validates the settings, draws the first text on the server (so the client
 * hydrates the same text, TEXTE-2) and hands both to the playable race screen.
 */
export default async function RacePage({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ config?: string | string[] }>;
}) {
  const locale = requireLocale((await params).lang);
  const settings = deserializeRaceSettings((await searchParams).config);
  const dictionary = getDictionary(locale);
  const { raceEntry: copy } = dictionary;

  if (!settings) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-12 text-foreground">
        <h1 className="text-3xl font-bold">{copy.title}</h1>
        <p role="alert">{copy.invalid}</p>
        <ButtonLink href={`/${locale}/race/settings`}>{copy.back}</ButtonLink>
      </main>
    );
  }

  const user = await getCurrentUserForDisplay();
  return (
    <RaceScreen
      locale={locale}
      labels={dictionary.raceScreen}
      siteName={dictionary.site.name}
      settings={settings}
      userName={user?.displayName ?? null}
      initialText={createRaceText(settings, Math.random)}
      botNameSeed={drawBotNameSeed()}
    />
  );
}
