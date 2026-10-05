import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { redirectIfSignedIn } from "@/auth/redirectIfSignedIn";
import { ButtonLink } from "@/components/ButtonLink";
import { AuthAltLink } from "@/components/auth/AuthAltLink";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { AuthInfoNote } from "@/components/auth/AuthInfoNote";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { MascotIllustration } from "@/components/auth/MascotIllustration";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { PromisePanel } from "@/components/auth/PromisePanel";
import { getDictionary } from "@/i18n/dictionaries";
import { requireLocale } from "@/i18n/requireLocale";

export async function generateMetadata({ params }: PageProps<"/[lang]/login">): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const { meta } = getDictionary(locale).login;
  return { title: meta.title, description: meta.description };
}

/** AUTH-1 : GitHub et Discord d'abord (désactivés pour l'instant), puis l'identifiant, en dernier. */
export default async function LoginPage({ params }: PageProps<"/[lang]/login">) {
  const locale = requireLocale((await params).lang);
  await redirectIfSignedIn(locale, { allowGuests: true });
  const dictionary = getDictionary(locale);
  const { login, auth, oauth, promise, illustration } = dictionary;

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
        <AuthHeading kicker={auth.kicker} title={login.title} intro={login.intro} />
        <OAuthButtons labels={oauth} />
        <AuthDivider>{login.divider}</AuthDivider>
        <p className="-mt-3 text-xs text-muted">{login.securityNote}</p>
        <LoginForm locale={locale} labels={login} common={auth} />
        <AuthDivider>{login.guestDivider}</AuthDivider>
        <div className="-mt-3 flex flex-col items-center gap-2">
          <ButtonLink href={`/${locale}/guest`} variant="secondary" fullWidth>
            <UserRound aria-hidden="true" className="size-5" />
            {login.guestButton}
          </ButtonLink>
          <p className="text-center text-xs text-muted">{login.guestNote}</p>
        </div>
        <AuthAltLink prompt={login.noAccount} linkLabel={login.signUpLink} href={`/${locale}/register`} />
        <AuthInfoNote>{login.sharedComputerNote}</AuthInfoNote>
      </div>
    </AuthLayout>
  );
}
