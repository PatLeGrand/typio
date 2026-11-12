import type { Metadata } from "next";
import { getCurrentUser } from "@/auth/currentUser";
import { StatusPageFrame } from "@/components/StatusPageFrame";
import { ButtonLink } from "@/components/ButtonLink";
import { GuestForm } from "@/components/auth/GuestForm";
import { SoloRaceEntry } from "./SoloRaceEntry";
import { getDictionary } from "@/i18n/dictionaries";
import { requireLocale } from "@/i18n/requireLocale";
import { deserializeRaceSettings, serializeRaceSettings } from "@/race/config";

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ config?: string | string[] }>;
}): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const settings = deserializeRaceSettings((await searchParams).config);
  const { raceEntry, site } = getDictionary(locale);
  return { title: `${settings ? raceEntry.title : raceEntry.invalidTitle} | ${site.name}` };
}

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
      <StatusPageFrame locale={locale} dictionary={dictionary}>
        <main className="mx-auto flex w-full flex-1 max-w-3xl flex-col gap-6 px-4 py-12 text-foreground">
          <h1 className="text-3xl font-bold">{copy.invalidTitle}</h1>
          <p role="alert">{copy.invalid}</p>
          <ButtonLink href={`/${locale}/race/settings`}>{copy.back}</ButtonLink>
        </main>
      </StatusPageFrame>
    );
  }

  const user = await getCurrentUser();
  const returnTo = `/${locale}/race?${serializeRaceSettings(settings)}`;
  return (
    <StatusPageFrame locale={locale} dictionary={dictionary}>
      <main className="mx-auto flex w-full flex-1 max-w-3xl flex-col gap-6 px-4 py-12 text-foreground">
        <h1 className="text-balance text-3xl font-bold">{user ? copy.title : dictionary.guest.title}</h1>
        {user ? (
          <SoloRaceEntry locale={locale} userId={user.id} settings={settings} labels={copy} roomLabels={dictionary.room} />
        ) : (
          <GuestForm locale={locale} labels={dictionary.guest} common={dictionary.auth} returnTo={returnTo} />
        )}
      </main>
    </StatusPageFrame>
  );
}
