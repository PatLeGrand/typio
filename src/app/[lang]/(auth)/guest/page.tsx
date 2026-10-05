import type { Metadata } from "next";
import { redirectIfSignedIn } from "@/auth/redirectIfSignedIn";
import { AuthAltLink } from "@/components/auth/AuthAltLink";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { AuthInfoNote } from "@/components/auth/AuthInfoNote";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { GuestForm } from "@/components/auth/GuestForm";
import { MascotIllustration } from "@/components/auth/MascotIllustration";
import { PromisePanel } from "@/components/auth/PromisePanel";
import { getDictionary } from "@/i18n/dictionaries";
import { requireLocale } from "@/i18n/requireLocale";

export async function generateMetadata({ params }: PageProps<"/[lang]/guest">): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const { meta } = getDictionary(locale).guest;
  return { title: meta.title, description: meta.description };
}

/** AUTH-4 : jouer en invité avec un pseudo ; données supprimées après 24 h (H-2), pas de création de course (SALLE-12). */
export default async function GuestPage({ params }: PageProps<"/[lang]/guest">) {
  const locale = requireLocale((await params).lang);
  await redirectIfSignedIn(locale);
  const dictionary = getDictionary(locale);
  const { guest, auth, promise, illustration } = dictionary;

  return (
    <AuthLayout
      locale={locale}
      dictionary={dictionary}
      panel={
        <PromisePanel labels={promise}>
          <MascotIllustration labels={illustration} />
        </PromisePanel>
      }
    >
      <div className="flex flex-col gap-7">
        <AuthHeading kicker={auth.kicker} title={guest.title} intro={guest.intro} />
        <GuestForm locale={locale} labels={guest} common={auth} />
        <AuthInfoNote>{guest.limits}</AuthInfoNote>
        <AuthAltLink prompt={guest.haveAccount} linkLabel={guest.signInLink} href={`/${locale}/login`} />
      </div>
    </AuthLayout>
  );
}
