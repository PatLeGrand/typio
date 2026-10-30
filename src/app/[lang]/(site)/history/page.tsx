import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
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
  const { columns, statuses } = raceScreen.results;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const href = prefixWithLocale("/history", locale);

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-4xl font-bold text-foreground">{history.title}</h1>
      <p className="text-muted">{history.description}</p>
      {items.length ? <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{history.title}</caption>
          <thead><tr>
            {[history.date, columns.rank, columns.wpm, columns.accuracy, columns.status, history.actions].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-3 py-2">{label}</th>)}
          </tr></thead>
          <tbody>{items.map((row) => <tr key={row.raceId} className="border-t border-border">
            <th scope="row" className="whitespace-nowrap px-3 py-2"><time dateTime={row.endedAt.toISOString()}>{date.format(row.endedAt)}</time></th>
            <td className="whitespace-nowrap px-3 py-2">{number.format(row.rank)} / {number.format(row.participantCount)}</td>
            <td className="px-3 py-2">{number.format(row.wpm)}{row.personalBest && <span className="ml-2 rounded border border-border px-2 py-1 text-xs text-accent-text">{raceScreen.results.personalBest}</span>}</td>
            <td className="px-3 py-2">{percent.format(row.accuracy / 100)}</td>
            <td className="px-3 py-2">{statuses[row.status]}</td>
            <td className="px-3 py-2"><Link className="underline" href={`${href}/${row.raceId}`}>{history.view}</Link></td>
          </tr>)}</tbody>
        </table>
      </div> : <div className="flex flex-col gap-3">
        <p className="text-muted">{history.empty}</p>
        <Link className="underline" href={prefixWithLocale("/", locale)}>{history.play}</Link>
        {page > 1 && <Link className="underline" href={href}>{history.firstPage}</Link>}
      </div>}
      <nav aria-label={history.pagination} className="flex flex-wrap items-center gap-4">
        {page > 1 && <Link className="underline" href={`${href}?page=${page - 1}`}>{history.previous}</Link>}
        <span>{history.page.replace("{page}", number.format(page))}</span>
        {hasNext && page < MAX_HISTORY_PAGE && <Link className="underline" href={`${href}?page=${page + 1}`}>{history.next}</Link>}
      </nav>
    </main>
  );
}
