import type { Metadata } from "next";
import { getCurrentUser } from "@/auth/currentUser";
import { ButtonLink } from "@/components/ButtonLink";
import { getDictionary } from "@/i18n/dictionaries";
import { prefixWithLocale } from "@/i18n/paths";
import { requireLocale } from "@/i18n/requireLocale";
import { INVITE_TOKEN_PATTERN } from "@/realtime/protocol";
import { parseJoinRole } from "@/realtime/roomRoute";
import { InviteClient } from "./InviteClient";

type InvitePageProps = {
  params: Promise<{ lang: string; token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const { room, site } = getDictionary(locale);
  // Pas de `Referer` ni de ressource externe : le jeton de l'URL ne sort pas d'ici (SALLE-04).
  return { title: `${room.invite.metaTitle} | ${site.name}`, referrer: "no-referrer", robots: { index: false } };
}

/**
 * Lien d'invitation (SALLE-04) : exige une session. Sans session, un message renvoie vers la
 * connexion ou le mode invité, sans paramètre de retour (pas de redirection ouverte) ; la
 * personne rouvre ensuite le lien.
 */
export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { lang, token } = await params;
  const locale = requireLocale(lang);
  const user = await getCurrentUser();
  const { room } = getDictionary(locale);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:px-8 md:py-12">
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-foreground">{room.invite.title}</h1>
      {user ? (
        <InviteClient
          token={INVITE_TOKEN_PATTERN.test(token) ? token : null}
          role={parseJoinRole((await searchParams).role)}
          locale={locale}
          userId={user.id}
          labels={room}
        />
      ) : (
        <div className="flex flex-col items-start gap-6">
          <p className="text-muted-strong">{room.invite.signInRequired}</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={prefixWithLocale("/login", locale)}>{room.invite.signIn}</ButtonLink>
            <ButtonLink href={prefixWithLocale("/guest", locale)} variant="secondary">{room.invite.guest}</ButtonLink>
          </div>
        </div>
      )}
    </main>
  );
}
