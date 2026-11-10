import { getCurrentUserForDisplay } from "@/auth/currentUser";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatusPageFrame } from "@/components/StatusPageFrame";
import { ButtonLink } from "@/components/ButtonLink";
import { RaceScreen } from "@/components/race/RaceScreen";
import { getDictionary } from "@/i18n/dictionaries";
import { requireLocale } from "@/i18n/requireLocale";
import { deserializeRaceSettings } from "@/race/config";
import { nextRaceText } from "./actions";

/** Seed for the bot names, drawn on the server with the text so hydration matches. */
function drawBotNameSeed(): number {
  return Math.floor(Math.random() * 4294967296);
}

/**
 * Entry boundary: validates the settings, draws the first text on the server (so the client
 * hydrates the same text, CONF-02, CONF-04, CONF-06, CONF-07) and hands both to the playable race screen.
 */
export default async function RacePage({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ config?: string | string[] }>;
}) {
  const locale = requireLocale((await params).lang);
  const settings = deserializeRaceSettings((await searchParams).config);
  const dictionary = getDictionary(locale);
  const { raceEntry: copy } = dictionary;
  const preferences = (
    <div className="flex flex-wrap justify-end gap-2 border-b border-border bg-background p-4 text-foreground">
      <LanguageSwitcher locale={locale} labels={dictionary.language} compact />
      <ThemeToggle labels={dictionary.theme} compact />
    </div>
  );

  if (!settings) {
    return (
      <StatusPageFrame locale={locale} dictionary={dictionary}>
        <main className="mx-auto flex w-full flex-1 max-w-3xl flex-col gap-6 px-4 py-12 text-foreground">
          <h1 className="text-3xl font-bold">{copy.title}</h1>
          <p role="alert">{copy.invalid}</p>
          <ButtonLink href={`/${locale}/race/settings`}>{copy.back}</ButtonLink>
        </main>
      </StatusPageFrame>
    );
  }

  const user = await getCurrentUserForDisplay();
  const generated = await nextRaceText({ settings });
  return (
    <>
      {preferences}
      <RaceScreen
        locale={locale}
        labels={dictionary.raceScreen}
        roomLabels={dictionary.room.race}
        siteName={dictionary.site.name}
        settings={settings}
        userName={user?.displayName ?? null}
        userId={user?.id ?? null}
        avatarVersion={user?.avatarVersion ?? null}
        initialText={generated.ok ? generated.text : null}
        initialError={!generated.ok && generated.error === "RATE_LIMITED" ? "RATE_LIMITED" : undefined}
        botNameSeed={drawBotNameSeed()}
      />
    </>
  );
}
