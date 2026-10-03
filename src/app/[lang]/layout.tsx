import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireLocale } from "@/i18n/requireLocale";
import { themeInitScript } from "@/theme/themeScript";
import "../globals.css";

// Toute locale hors de `locales` donne une 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const { meta } = getDictionary(locale);
  return { title: meta.title, description: meta.description };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const locale = requireLocale((await params).lang);
  const dictionary = getDictionary(locale);

  return (
    // Pas de `className` sur <html> : la classe `dark` y est posée hors de React
    // (script de thème, ThemeToggle) et React ne doit jamais la réécrire.
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Pose la classe `dark` avant le premier rendu pour éviter tout flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased">
        <SiteHeader locale={locale} dictionary={dictionary} />
        {children}
      </body>
    </html>
  );
}
