import { getCurrentUserForDisplay } from "@/auth/currentUser";
import { getActiveRoomCode } from "@/auth/activeRoom";
import { ActiveRoomWidget } from "@/components/ActiveRoomWidget";
import { schedulePurge } from "@/auth/schedulePurge";
import { SiteHeader } from "@/components/SiteHeader";
import { pickSiteHeaderDictionary } from "@/components/siteHeaderDictionary";
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
  const roomCode = user ? await getActiveRoomCode() : null;

  return (
    <>
      <SiteHeader locale={locale} dictionary={pickSiteHeaderDictionary(getDictionary(locale))} user={user} />
      <RoomSessionGuard userId={user?.id ?? null} />
      {children}
      <SiteFooter locale={locale} labels={getDictionary(locale).footer} />
      {user && roomCode ? <ActiveRoomWidget key={user.id} userId={user.id} roomCode={roomCode} locale={locale} labels={getDictionary(locale).activeRoom} /> : null}
    </>
  );
}
