import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { displayFont } from "@/components/home/homeFonts";
import { RaceHistoryTable } from "@/components/race/RaceHistoryTable";
import { getDb } from "@/db/shared";
import { getDictionary } from "@/i18n/dictionaries";
import { prefixWithLocale } from "@/i18n/paths";
import { requireLocale } from "@/i18n/requireLocale";
import { createDrizzleRaceHistoryRepository } from "@/race/drizzleRaceHistoryRepository";
import { HISTORY_PAGE_SIZE, MAX_HISTORY_PAGE, parseHistoryPage } from "@/race/raceHistory";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const { history, site } = getDictionary(locale);
  return { title: `${history.title} | ${site.name}` };
}

export default async function HistoryPage({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = requireLocale((await params).lang);
  const user = await getCurrentUser();
  if (!user) redirect(prefixWithLocale("/login", locale));
  if (user.kind === "guest") redirect(prefixWithLocale("/register", locale));
  const page = parseHistoryPage((await searchParams).page);
  const { items, hasNext } = await createDrizzleRaceHistoryRepository(getDb())
    .listUserRaces(user.id, { page, pageSize: HISTORY_PAGE_SIZE });
  const { history, raceScreen } = getDictionary(locale);
  const integer = new Intl.NumberFormat(locale);
  const href = prefixWithLocale("/history", locale);

  return (
    <main className={`${displayFont.variable} mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-7 px-4 py-8 md:px-8 md:py-12`}>
      <header className="flex flex-col gap-3 border-b border-border pb-6">
        <h1 className="race-masthead text-foreground">{history.title}</h1>
        <p className="max-w-[65ch] text-base leading-relaxed text-muted">{history.description}</p>
      </header>

      {items.length ? (
        <RaceHistoryTable
          rows={items}
          locale={locale}
          caption={history.title}
          resultLabels={raceScreen.results}
          historyLabels={history}
        />
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted">{page === 1 ? history.emptyFirst : history.empty}</p>
          <Link className="road-link-inline" href={prefixWithLocale("/play", locale)}>{history.play}</Link>
          {page > 1 && <Link className="road-link-inline" href={href}>{history.firstPage}</Link>}
        </div>
      )}

      {(items.length > 0 || page > 1) && (
        <nav aria-label={history.pagination} className="flex flex-wrap items-center gap-4">
          {page > 1 && <Link className="road-link-inline" href={`${href}?page=${page - 1}`}>{history.previous}</Link>}
          <span className="tabular-nums">{history.page.replace("{page}", integer.format(page))}</span>
          {hasNext && page < MAX_HISTORY_PAGE && <Link className="road-link-inline" href={`${href}?page=${page + 1}`}>{history.next}</Link>}
        </nav>
      )}
    </main>
  );
}
