import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireLocale } from "@/i18n/requireLocale";
import { themeInitScript } from "@/theme/themeScript";
import "../globals.css";
// Inter est téléchargée au build et servie avec les assets du site : aucune
// requête vers Google à l'exécution. Variable CSS lue par `--font-sans` (globals.css).
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});

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

  return (
    // Pas de `className` sur <html> : la classe `dark` y est posée hors de React
    // (script de thème, ThemeToggle) et React ne doit jamais la réécrire.
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Pose la classe `dark` avant le premier rendu pour éviter tout flash. */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${inter.variable} flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased`}
      >
        <svg aria-hidden="true" focusable="false" width="0" height="0" className="pointer-events-none absolute">
          <defs>
            <filter id="typio-goo" x="-30%" y="-50%" width="160%" height="200%" colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" />
            </filter>
          </defs>
        </svg>
        {/* L'en-tête vit dans (site)/layout.tsx : les pages (auth) ont le leur. */}
        {children}
      </body>
    </html>
  );
}
