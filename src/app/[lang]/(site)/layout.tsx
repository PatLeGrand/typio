import { getCurrentUser } from "@/auth/currentUser";
import { SiteHeader } from "@/components/SiteHeader";
import { getDictionary } from "@/i18n/dictionaries";
import { requireLocale } from "@/i18n/requireLocale";

/** Pages courantes du site (accueil, confidentialité) : elles partagent l'en-tête `SiteHeader`. */
export default async function SiteLayout({ children, params }: LayoutProps<"/[lang]">) {
  const locale = requireLocale((await params).lang);
  const user = await getCurrentUser();

  return (
    <>
      <SiteHeader locale={locale} dictionary={getDictionary(locale)} user={user} />
      {children}
    </>
  );
}
