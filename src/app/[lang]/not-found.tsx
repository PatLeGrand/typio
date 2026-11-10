"use client";

import { usePathname } from "next/navigation";
import { NotFoundView, notFoundTitle } from "@/components/NotFoundView";
import { defaultLocale } from "@/i18n/config";
import { getPathLocale } from "@/i18n/paths";

/** Secours : `notFound()` levé par une page (le proxy sert déjà `/<locale>/missing` pour les adresses inconnues). */
export default function NotFoundPage() {
  const locale = getPathLocale(usePathname()) ?? defaultLocale;
  return (
    <>
      <title>{notFoundTitle(locale)}</title>
      <NotFoundView locale={locale} />
    </>
  );
}
