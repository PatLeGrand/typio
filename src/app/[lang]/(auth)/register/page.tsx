import type { Metadata } from "next";
import { redirectIfSignedIn } from "@/auth/redirectIfSignedIn";
import { AuthAltLink } from "@/components/auth/AuthAltLink";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { ProgressIsland } from "@/components/auth/ProgressIsland";
import { PromisePanel } from "@/components/auth/PromisePanel";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { getDictionary } from "@/i18n/dictionaries";
import { requireLocale } from "@/i18n/requireLocale";

export async function generateMetadata({ params }: PageProps<"/[lang]/register">): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const { meta } = getDictionary(locale).register;
  return { title: meta.title, description: meta.description };
}

/** AUTH-1 : inscription par pseudo et mot de passe, sans e-mail (OAuth d'abord, désactivé pour l'instant). */
export default async function RegisterPage({ params }: PageProps<"/[lang]/register">) {
  const locale = requireLocale((await params).lang);
  await redirectIfSignedIn(locale, { allowGuests: true });
  const dictionary = getDictionary(locale);
  const { register, auth, oauth, promise, island } = dictionary;

  return (
    <AuthLayout
      locale={locale}
      dictionary={dictionary}
      panel={
        <PromisePanel labels={promise}>
          <ProgressIsland labels={island} />
        </PromisePanel>
      }
    >
      <div className="flex flex-col gap-7">
        <AuthHeading kicker={auth.kicker} title={register.title} intro={register.intro} />
        <OAuthButtons labels={oauth} />
        <AuthDivider>{register.divider}</AuthDivider>
        <RegisterForm locale={locale} labels={register} common={auth} />
        <AuthAltLink prompt={register.haveAccount} linkLabel={register.signInLink} href={`/${locale}/login`} />
      </div>
    </AuthLayout>
  );
}
