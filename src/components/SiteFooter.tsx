"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

export function SiteFooter({ locale, labels }: { locale: Locale; labels: Dictionary["footer"] }) {
  const pathname = usePathname();
  // L'accueil possède déjà son propre pied de page détaillé.
  if (pathname === `/${locale}` || pathname === `/${locale}/`) return null;

  return (
    <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-6 text-sm text-muted sm:px-8">
      <p>{labels.copyright}</p>
      <Link href={`/${locale}/privacy`} className="road-link rounded-field hover:text-foreground">{labels.privacy}</Link>
    </footer>
  );
}
