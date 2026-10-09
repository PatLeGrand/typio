import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { getDictionary } from "@/i18n/dictionaries";
import { prefixWithLocale } from "@/i18n/paths";
import { requireLocale } from "@/i18n/requireLocale";
import { PlayClient } from "./PlayClient";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const { room, site } = getDictionary(locale);
  return { title: `${room.play.metaTitle} | ${site.name}` };
}

export default async function PlayPage({ params }: { params: Promise<{ lang: string }> }) {
  const locale = requireLocale((await params).lang);
  const user = await getCurrentUser();
  if (!user) redirect(prefixWithLocale("/login", locale));

  const { room } = getDictionary(locale);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:px-8 md:py-12">
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-foreground">{room.play.title}</h1>
      <PlayClient locale={locale} userId={user.id} isGuest={user.kind === "guest"} labels={room} />
    </main>
  );
}
