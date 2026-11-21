import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/auth/currentUser";
import { getDb } from "@/db/shared";
import { users, oauthAccounts } from "@/db/schema";
import { getDictionary } from "@/i18n/dictionaries";
import { prefixWithLocale } from "@/i18n/paths";
import { requireLocale } from "@/i18n/requireLocale";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { BlobPreview } from "@/components/race/BlobPreview";
import { isKeyboardLayout } from "@/profile/profileSettings";
import { getBlobStyle } from "@/profile/blobStyleRepository";
import { ProfileStats } from "@/components/profile/ProfileStats";
import { createDrizzleProfileStatsRepository } from "@/race/drizzleProfileStatsRepository";
import { ProfileForm } from "./ProfileForm";
import { ProfileSecurityPanel } from "./ProfileSecurityPanel";
import { AvatarForm } from "./AvatarForm";
import { formatBlobPreviewLabel } from "./blobPreviewLabel";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const { profile, site } = getDictionary(locale);
  return { title: `${profile.title} | ${site.name}` };
}

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
  const repository = createDrizzleProfileStatsRepository(getDb());
  const [statistics, initialBlobStyle] = await Promise.all([
    currentUser.kind === "member"
      ? Promise.all([repository.getUserStats(currentUser.id), repository.getWpmHistory(currentUser.id)])
      : Promise.resolve(null),
    getBlobStyle(currentUser.id),
  ]);

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
          <div className="shrink-0 flex flex-wrap gap-2">
            {currentUser.kind === "member" && <>
              <ButtonLink href={prefixWithLocale("/stats", locale)} variant="secondary">
                {dictionary.stats.title}
              </ButtonLink>
              <ButtonLink href={prefixWithLocale("/history", locale)} variant="secondary">
                {dictionary.history.title}
              </ButtonLink>
            </>}
            <ButtonLink href={prefixWithLocale("/play", locale)} variant="secondary">
              <ArrowLeft aria-hidden="true" className="w-4 h-4" />
              {profile.backToCourses}
            </ButtonLink>
          </div>
        </div>

        {statistics && <ProfileStats stats={statistics[0]} history={statistics[1]} locale={locale} labels={profile.stats} />}

        {currentUser.kind === "member" && <AvatarForm userId={currentUser.id} displayName={currentUser.displayName}
          version={dbUser.avatarVersion} labels={profile.avatar} />}

        <Card className="p-6 md:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="shrink-0 flex flex-col items-center justify-center rounded-card border border-border bg-island-mint px-4 py-3">
                <BlobPreview
                  style={initialBlobStyle}
                  size={72}
                  label={formatBlobPreviewLabel(profile.blob.preview, initialBlobStyle, profile.blob)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-foreground">{profile.blob.title}</h2>
                <p className="text-sm text-muted">{profile.blob.description}</p>
                <p className="text-xs font-medium text-muted">
                  {profile.blob.colors[initialBlobStyle.color]}
                  {" · "}
                  {profile.blob.glasses[initialBlobStyle.glasses]}
                  {" · "}
                  {profile.blob.hats[initialBlobStyle.hat]}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <ButtonLink href={prefixWithLocale("/profile/blob", locale)} variant="secondary">
                <Sparkles aria-hidden="true" className="w-4 h-4" />
                {profile.blob.customize}
              </ButtonLink>
            </div>
          </div>
        </Card>

        {currentUser.isDemo && <p role="status">{profile.demoReadOnly}</p>}
        <ProfileForm 
          user={currentUser} 
          dbUser={{
            createdAt: dbUser.createdAt,
            // La base garantit la valeur (contrainte CHECK) ; la garde recale un éventuel écart de schéma.
            keyboardLayout: isKeyboardLayout(dbUser.keyboardLayout) ? dbUser.keyboardLayout : "qwerty",
          }}
          securityPanel={
            currentUser.kind === "member" ? (
              <ProfileSecurityPanel
                hasPassword={hasPassword}
                hasGithub={hasGithub}
                hasDiscord={hasDiscord}
                dictionary={dictionary}
              />
            ) : null
          }
          dictionary={dictionary} 
          locale={locale} 
        />
      </div>
    </main>
  );
}
