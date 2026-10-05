"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MascotIllustration } from "@/components/auth/MascotIllustration";
import { ButtonLink } from "@/components/ButtonLink";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { defaultLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getPathLocale } from "@/i18n/paths";

/** Page affichée par Next.js pour toute adresse inconnue sous une locale. */
export default function NotFoundPage() {
  const locale = getPathLocale(usePathname()) ?? defaultLocale;
  const dictionary = getDictionary(locale);
  const { notFound } = dictionary;

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-8">
        <Link href={`/${locale}`} className="rounded-field">
          <Logo name={dictionary.site.name} tagline={dictionary.brand.tagline} />
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher locale={locale} labels={dictionary.language} />
          <ThemeToggle labels={dictionary.theme} />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:gap-12 lg:py-12">
        <section className="flex flex-col items-start text-left">
          <p className="mb-4 rounded-full bg-accent-soft px-4 py-2 text-sm font-extrabold uppercase tracking-[0.12em] text-accent-text">
            {notFound.eyebrow}
          </p>
          <h1 className="max-w-xl text-[38px] font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            {notFound.title}
          </h1>
          <p className="mt-5 max-w-lg text-base leading-[1.65] text-muted sm:text-lg">{notFound.text}</p>
          <div className="mt-8">
            <ButtonLink href={`/${locale}`}>{notFound.home}</ButtonLink>
          </div>
        </section>

        <div className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-panel bg-accent-panel p-2 shadow-soft sm:min-h-[390px] sm:p-5">
          <MascotIllustration labels={dictionary.illustration} />
        </div>
      </main>
    </div>
  );
}
