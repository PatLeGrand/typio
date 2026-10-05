import { Button } from "@/components/Button";
import { getDictionary } from "@/i18n/dictionaries";
import { requireLocale } from "@/i18n/requireLocale";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const locale = requireLocale((await params).lang);
  const { site, home } = getDictionary(locale);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-4 py-12 text-center sm:px-8">
      <h1 className="text-[38px] font-extrabold leading-[1.15] tracking-tight sm:text-5xl sm:leading-[1.08]">
        {site.name}
      </h1>
      <p className="max-w-xl text-base leading-[1.55] text-muted">{home.tagline}</p>
      {/* Boutons désactivés : ils serviront quand les salles existeront. */}
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Button disabled>{home.createRace}</Button>
        <Button variant="secondary" disabled>
          {home.joinWithCode}
        </Button>
      </div>
    </main>
  );
}
