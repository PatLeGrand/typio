import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/auth/currentUser";
import { getDb } from "@/db/shared";
import { users, oauthAccounts } from "@/db/schema";
import { getDictionary } from "@/i18n/dictionaries";
import { prefixWithLocale } from "@/i18n/paths";
import { requireLocale } from "@/i18n/requireLocale";
import { ButtonLink } from "@/components/ButtonLink";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage({ params }: { params: Promise<{ lang: string }> }) {
  const locale = requireLocale((await params).lang);
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    redirect(prefixWithLocale("/login", locale));
  }

  const [dbUser] = await getDb().select().from(users).where(eq(users.id, currentUser.id));
  if (!dbUser) {
    redirect(prefixWithLocale("/login", locale));
  }

  const userOauth = await getDb().select().from(oauthAccounts).where(eq(oauthAccounts.userId, currentUser.id));
  
  const providers = userOauth.map((o) => o.provider);
  const hasGithub = providers.includes("github");
  const hasDiscord = providers.includes("discord");
  const hasPassword = dbUser.passwordHash !== null;

  const dictionary = getDictionary(locale);
  const { profile } = dictionary;

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 md:px-8 md:py-12">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              {profile.title}
            </h1>
            <p className="text-muted mt-2 text-base">
              {profile.description}
            </p>
          </div>
          <ButtonLink 
            href={prefixWithLocale("/race", locale)} 
            variant="secondary"
          >
            <ArrowLeft className="w-4 h-4" />
            {profile.backToCourses}
          </ButtonLink>
        </div>

        <ProfileForm 
          user={currentUser} 
          dbUser={{
            createdAt: dbUser.createdAt,
            keyboardLayout: dbUser.keyboardLayout,
          }}
          hasPassword={hasPassword}
          hasGithub={hasGithub}
          hasDiscord={hasDiscord}
          dictionary={dictionary} 
          locale={locale} 
        />
      </div>
    </main>
  );
}
