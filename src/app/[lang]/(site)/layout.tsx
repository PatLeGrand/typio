import { getCurrentUserForDisplay } from "@/auth/currentUser";
import { schedulePurge } from "@/auth/schedulePurge";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getDictionary } from "@/i18n/dictionaries";
import { requireLocale } from "@/i18n/requireLocale";
import { RoomSessionGuard } from "@/realtime/RoomSessionGuard";

/**
 * Pages courantes du site (accueil, confidentialité) : elles partagent l'en-tête `SiteHeader`.
 * L'utilisateur y sert à l'affichage seulement : une panne de base donne un en-tête « visiteur ».
 */
export default async function SiteLayout({ children, params }: LayoutProps<"/[lang]">) {
  const locale = requireLocale((await params).lang);
  schedulePurge();
  const user = await getCurrentUserForDisplay();

  return (
    <>
      <SiteHeader locale={locale} dictionary={getDictionary(locale)} user={user} />
      <RoomSessionGuard userId={user?.id ?? null} />
      {children}
      <SiteFooter locale={locale} labels={getDictionary(locale).footer} />
    </>
  );
}
