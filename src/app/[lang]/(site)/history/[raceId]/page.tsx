import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { RaceResultsTable } from "@/components/race/RaceResultsTable";
import { getDb } from "@/db/shared";
import { getDictionary } from "@/i18n/dictionaries";
import { prefixWithLocale } from "@/i18n/paths";
import { requireLocale } from "@/i18n/requireLocale";
import { createDrizzleRaceHistoryRepository } from "@/race/drizzleRaceHistoryRepository";
import { isRaceId } from "@/race/raceHistory";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const { history, site } = getDictionary(locale);
  return { title: `${history.detailTitle} | ${site.name}` };
}

export default async function RaceHistoryPage({ params }: {
  params: Promise<{ lang: string; raceId: string }>;
}) {
  const { lang, raceId } = await params;
  const locale = requireLocale(lang);
  const user = await getCurrentUser();
  if (!user) redirect(prefixWithLocale("/login", locale));
  if (user.kind === "guest") redirect(prefixWithLocale("/register", locale));
  if (!isRaceId(raceId)) notFound();
  const race = await createDrizzleRaceHistoryRepository(getDb()).getRaceForUser(user.id, raceId);
  if (!race) notFound();
  const { history, raceScreen, room } = getDictionary(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const number = new Intl.NumberFormat(locale);

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-4xl font-bold text-foreground">{history.detailTitle}</h1>
      <p><time dateTime={race.endedAt.toISOString()}>{date.format(race.endedAt)}</time></p>
      <p>{history.participants.replace("{count}", number.format(race.participantCount))}</p>
      <p className="text-sm text-muted">{history.membersOnly}</p>
      <RaceResultsTable rows={race.rows} lang={locale} labels={raceScreen.results} extraLabels={room.race} botLevels={raceScreen.botLevels} highlightId={user.id} />
      <Link className="underline" href={prefixWithLocale("/history", locale)}>{history.back}</Link>
    </main>
  );
}
