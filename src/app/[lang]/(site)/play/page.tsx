import { getCurrentUser } from "@/auth/currentUser";
import { getDictionary } from "@/i18n/dictionaries";
import { requireLocale } from "@/i18n/requireLocale";
import { redirect } from "next/navigation";
import { PlayClient } from "./PlayClient";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const { site } = getDictionary(locale);
  return {
    title: `Jouer | ${site.name}`,
  };
}

export default async function PlayPage({ params }: { params: Promise<{ lang: string }> }) {
  const locale = requireLocale((await params).lang);
  const dict = getDictionary(locale);
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const isGuest = user.kind === "guest";

  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="bg-surface border border-border rounded-[24px] p-8">
          <h2 className="text-2xl font-bold mb-4">{dict.room.play.create.title}</h2>
          <p className="mb-8 text-muted">{dict.room.play.create.description}</p>
          
          {isGuest ? (
            <p className="text-sm text-destructive">{dict.room.play.guestCannotCreate}</p>
          ) : (
            <PlayClient action="create" lang={locale} dict={dict.room} />
          )}
        </div>

        <div className="bg-surface border border-border rounded-[24px] p-8">
          <h2 className="text-2xl font-bold mb-4">{dict.room.play.join.title}</h2>
          <PlayClient action="join" lang={locale} dict={dict.room} />
        </div>
      </div>
    </main>
  );
}
