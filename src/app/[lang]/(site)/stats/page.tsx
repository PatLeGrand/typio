import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";
import { getCurrentUser } from "@/auth/currentUser";
import { Avatar } from "@/components/Avatar";
import { ButtonLink } from "@/components/ButtonLink";
import { displayFont } from "@/components/home/homeFonts";
import { CumulativeMissedKeys } from "@/components/stats/CumulativeMissedKeys";
import { StatsBreakdowns } from "@/components/stats/StatsBreakdowns";
import { StatsProgressionChart } from "@/components/stats/StatsProgressionChart";
import { StatsRecentRaces } from "@/components/stats/StatsRecentRaces";
import { StatsTimingBoard } from "@/components/stats/StatsTimingBoard";
import { getDb } from "@/db/shared";
import { getDictionary } from "@/i18n/dictionaries";
import { prefixWithLocale } from "@/i18n/paths";
import { requireLocale } from "@/i18n/requireLocale";
import { createDrizzlePersonalStatsRepository } from "@/race/drizzlePersonalStatsRepository";
import { MAX_DETAILED_RACES } from "@/race/personalStats";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const { stats, site } = getDictionary(locale);
  return {
    title: `${stats.metaTitle} | ${site.name}`,
    description: stats.metaDescription,
  };
}

export default async function StatsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const locale = requireLocale((await params).lang);
  const user = await getCurrentUser();

  if (!user) {
    redirect(prefixWithLocale("/login", locale));
  }

  const dictionary = getDictionary(locale);
  const { stats, raceScreen, history, profile } = dictionary;

  // Invité : message clair expliquant que ses stats ne sont pas enregistrées + lien pour créer un compte.
  if (user.kind === "guest") {
    return (
      <main
        className={`${displayFont.variable} mx-auto flex w-full min-w-0 max-w-4xl flex-1 flex-col justify-center gap-6 px-4 py-10 md:px-8 md:py-16`}
      >
        <section className="overflow-hidden rounded-panel border border-border bg-surface shadow-soft">
          <div aria-hidden="true" className="track-surface flex h-3 items-center justify-end px-4">
            <span className="track-checker h-full w-16" />
          </div>
          <div className="flex flex-col gap-5 p-6 sm:p-10">
            <div className="flex items-center gap-3">
              <Avatar name={user.displayName} seed={user.id} userId={user.id} avatarVersion={null} size={44} />
              <span className="text-sm font-semibold text-muted">{user.displayName}</span>
            </div>
            <h1 className="text-balance font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-foreground sm:text-6xl">
              {stats.guest.title}
            </h1>
            <p className="max-w-[60ch] text-base leading-relaxed text-muted">{stats.guest.description}</p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <ButtonLink href={prefixWithLocale("/register", locale)} variant="key" size="large">
                {stats.guest.register}
              </ButtonLink>
              <ButtonLink href={prefixWithLocale("/play", locale)} variant="secondary">
                {stats.guest.play}
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const report = await createDrizzlePersonalStatsRepository(getDb()).getPersonalStats(user.id);

  const integer = new Intl.NumberFormat(locale);
  const chartPoints = report.wpmHistory.map((point) => ({
    id: point.id,
    raceId: point.raceId,
    wpm: point.wpm,
    grossWpm: point.grossWpm,
    accuracy: point.accuracy,
    personalBest: point.personalBest,
    endedAtIso: point.endedAt.toISOString(),
    textMode: point.textMode,
    language: point.language,
    rollingAvg5: point.rollingAvg5,
  }));

  return (
    <main
      className={`${displayFont.variable} mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-7 px-4 py-8 md:px-8 md:py-12`}
    >
      {/* En-tête Grand Prix + identité + filtre de période */}
      <header className="flex flex-col gap-5 border-b border-border pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="race-masthead text-foreground">{stats.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar
                  name={user.displayName}
                  seed={user.id}
                  userId={user.id}
                  avatarVersion={user.avatarVersion}
                  size={32}
                />
                <span className="[overflow-wrap:anywhere] font-semibold text-foreground">{user.displayName}</span>
              </div>
              <span className="text-sm text-muted">{stats.subtitle}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href={prefixWithLocale("/profile", locale)} variant="secondary">
              <UserRound aria-hidden="true" className="size-4" />
              <span>{stats.profileLink}</span>
            </ButtonLink>
            <ButtonLink href={prefixWithLocale("/play", locale)} variant="start">
              {stats.playCta}
            </ButtonLink>
          </div>
        </div>

        {report.isCapped && (
          <p className="text-xs text-muted">
            {stats.cappedNote.replace("{count}", integer.format(MAX_DETAILED_RACES))}
          </p>
        )}
      </header>

      {/* État vide (aucune course enregistrée) */}
      {report.totals.raceCount === 0 ? (
        <section className="overflow-hidden rounded-panel border border-border bg-surface shadow-soft">
          <div aria-hidden="true" className="track-surface flex h-3 items-center justify-end px-4">
            <span className="track-checker h-full w-16" />
          </div>
          <div className="flex flex-col items-start gap-4 p-6 sm:p-10">
            <h2 className="text-balance font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-5xl">
              {stats.empty.allTitle}
            </h2>
            <p className="max-w-[58ch] text-base leading-relaxed text-muted">
              {stats.empty.allDescription}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <ButtonLink href={prefixWithLocale("/play", locale)} variant="start">
                {stats.playCta}
              </ButtonLink>
            </div>
          </div>
        </section>
      ) : (
        <>
          <StatsTimingBoard
            totals={report.totals}
            bestRace={report.bestRace}
            trend={report.trend}
            locale={locale}
            labels={stats.board}
            noValue={stats.noValue}
          />

          <StatsProgressionChart
            points={chartPoints}
            locale={locale}
            labels={stats.progression}
            modeLabels={stats.breakdowns.modes}
            languageLabels={stats.breakdowns.languages}
            personalBestLabel={raceScreen.results.personalBest}
          />

          <CumulativeMissedKeys
            missedKeys={report.cumulativeMissedKeys}
            totalMissedCount={report.totalMissedKeyCount}
            keyboardLayout={report.keyboardLayout}
            locale={locale}
            labels={stats.heatmap}
            keyLabels={raceScreen.results.missedKeys}
            layoutNames={profile.settings.layouts}
          />

          <StatsBreakdowns
            breakdowns={report.breakdowns}
            totals={report.totals}
            errorCostWpm={report.errorCostWpm}
            consistency={report.consistency}
            streaks={report.streaks}
            locale={locale}
            labels={stats.breakdowns}
            disciplineLabels={stats.discipline}
            noValue={stats.noValue}
          />

          <StatsRecentRaces
            races={report.recentRaces}
            locale={locale}
            labels={stats.recent}
            modeLabels={stats.breakdowns.modes}
            languageLabels={stats.breakdowns.languages}
            resultLabels={raceScreen.results}
            historyLabels={history}
          />
        </>
      )}
    </main>
  );
}
