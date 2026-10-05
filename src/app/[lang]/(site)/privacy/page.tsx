import type { Metadata } from "next";
import { getDictionary } from "@/i18n/dictionaries";
import { requireLocale } from "@/i18n/requireLocale";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const { meta } = getDictionary(locale).privacy;
  return { title: meta.title, description: meta.description };
}

export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const locale = requireLocale((await params).lang);
  const { privacy } = getDictionary(locale);

  const sections = [
    { title: privacy.storedTitle, items: Object.values(privacy.stored) },
    { title: privacy.cookiesTitle, items: Object.values(privacy.cookies) },
    { title: privacy.guestsTitle, items: [privacy.guests] },
    { title: privacy.neverTitle, items: Object.values(privacy.never) },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-[32px] font-bold leading-[1.15] sm:text-[38px]">{privacy.title}</h1>
        <p className="text-base leading-[1.55] text-muted">{privacy.intro}</p>
      </header>
      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">{section.title}</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-base leading-[1.55] marker:text-accent-text">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
