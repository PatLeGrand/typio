import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BarChart3, History, Sparkles } from "lucide-react";
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

  const blobPanel = (
    <Card className="p-6 md:p-8 flex flex-col gap-6">
      <div className="flex flex-col items-center justify-center rounded-card border border-border bg-island-mint px-6 py-6">
        <BlobPreview
          style={initialBlobStyle}
          size={96}
          label={formatBlobPreviewLabel(profile.blob.preview, initialBlobStyle, profile.blob)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-xl font-bold text-foreground">{profile.blob.title}</h3>
        <p className="text-sm text-muted">{profile.blob.description}</p>
        <p className="text-xs font-medium text-muted pt-1">
          {profile.blob.colors[initialBlobStyle.color]}
          {" · "}
          {profile.blob.glasses[initialBlobStyle.glasses]}
          {" · "}
          {profile.blob.hats[initialBlobStyle.hat]}
        </p>
      </div>
      <div>
        <ButtonLink href={prefixWithLocale("/profile/blob", locale)} variant="secondary" fullWidth>
          <Sparkles aria-hidden="true" className="w-4 h-4" />
          {profile.blob.customize}
        </ButtonLink>
      </div>
    </Card>
  );

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 md:px-8 md:py-12">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Link
            href={prefixWithLocale("/play", locale)}
            className="group inline-flex self-start items-center gap-1.5 text-sm font-medium text-muted hover:text-accent-text transition-colors"
          >
            <ArrowLeft
              aria-hidden="true"
              className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none"
            />
            {profile.backToCourses}
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                {profile.title}
              </h1>
              <p className="text-muted mt-1.5 max-w-2xl text-sm sm:text-base text-pretty">
                {profile.description}
              </p>
            </div>
            {currentUser.kind === "member" && (
              <div className="shrink-0 self-start sm:self-auto inline-flex flex-wrap items-center gap-1 rounded-full border border-border bg-surface/85 p-1 shadow-soft">
                <Link
                  href={prefixWithLocale("/stats", locale)}
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent-soft hover:text-accent-text"
                >
                  <BarChart3 aria-hidden="true" className="h-4 w-4" />
                  {dictionary.stats.title}
                  <ArrowUpRight aria-hidden="true" className="w-3.5 h-3.5 text-muted" />
                </Link>
                <Link
                  href={prefixWithLocale("/history", locale)}
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent-soft hover:text-accent-text"
                >
                  <History aria-hidden="true" className="h-4 w-4" />
                  {dictionary.history.title}
                  <ArrowUpRight aria-hidden="true" className="w-3.5 h-3.5 text-muted" />
                </Link>
              </div>
            )}
          </div>
        </header>

        <ProfileForm
          user={currentUser}
          dbUser={{
            createdAt: dbUser.createdAt,
            // La base garantit la valeur (contrainte CHECK) ; la garde recale un éventuel écart de schéma.
            keyboardLayout: isKeyboardLayout(dbUser.keyboardLayout) ? dbUser.keyboardLayout : "qwerty",
          }}
          avatarPanel={
            currentUser.kind === "member" ? (
              <AvatarForm
                userId={currentUser.id}
                displayName={currentUser.displayName}
                version={dbUser.avatarVersion}
                labels={profile.avatar}
              />
            ) : null
          }
          blobPanel={blobPanel}
          statsPanel={
            statistics ? (
              <ProfileStats
                stats={statistics[0]}
                history={statistics[1]}
                locale={locale}
                labels={profile.stats}
              />
            ) : null
          }
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
