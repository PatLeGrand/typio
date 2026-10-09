import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { getDictionary } from "@/i18n/dictionaries";
import { prefixWithLocale } from "@/i18n/paths";
import { requireLocale } from "@/i18n/requireLocale";
import { normalizeRoomCode } from "@/realtime/roomCode";
import { parseJoinRole } from "@/realtime/roomRoute";
import { RoomClient } from "./RoomClient";

type RoomPageProps = {
  params: Promise<{ lang: string; code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const { room, site } = getDictionary(locale);
  return { title: `${room.metaTitle} | ${site.name}` };
}

/** La salle se lit et se rejoint côté navigateur ; la page fournit la session, la langue et le rôle voulu. */
export default async function RoomPage({ params, searchParams }: RoomPageProps) {
  const { lang, code } = await params;
  const locale = requireLocale(lang);
  const user = await getCurrentUser();
  if (!user) redirect(prefixWithLocale("/login", locale));
  const dict = getDictionary(locale);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:px-8 md:py-12">
      <RoomClient
        code={normalizeRoomCode(code)}
        role={parseJoinRole((await searchParams).role)}
        locale={locale}
        userId={user.id}
        labels={dict.room}
        settingsLabels={dict.raceSettings}
      />
    </main>
  );
}
