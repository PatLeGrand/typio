import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/auth/currentUser";
import { ButtonLink } from "@/components/ButtonLink";
import { users } from "@/db/schema";
import { getDb } from "@/db/shared";
import { getDictionary } from "@/i18n/dictionaries";
import { prefixWithLocale } from "@/i18n/paths";
import { requireLocale } from "@/i18n/requireLocale";
import { getBlobStyle } from "@/profile/blobStyleRepository";
import { BlobCustomizer } from "../BlobCustomizer";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const { profile, site } = getDictionary(locale);
  return { title: `${profile.blob.title} | ${site.name}` };
}

export default async function ProfileBlobPage({ params }: { params: Promise<{ lang: string }> }) {
  const locale = requireLocale((await params).lang);
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect(prefixWithLocale("/login", locale));
  }

  const [dbUser] = await getDb().select({ id: users.id }).from(users).where(eq(users.id, currentUser.id));
  if (!dbUser) {
    redirect(prefixWithLocale("/login", locale));
  }

  const { profile } = getDictionary(locale);
  const initialBlobStyle = await getBlobStyle(currentUser.id);

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 md:px-8 md:py-12">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              {profile.blob.title}
            </h1>
            <p className="text-muted mt-2 text-base">
              {profile.blob.description}
            </p>
          </div>
          <div className="shrink-0 flex flex-wrap gap-2">
            <ButtonLink href={prefixWithLocale("/profile", locale)} variant="secondary">
              <ArrowLeft aria-hidden="true" className="w-4 h-4" />
              {profile.blob.backToProfile}
            </ButtonLink>
          </div>
        </div>

        {currentUser.isDemo && <p role="status">{profile.demoReadOnly}</p>}

        <BlobCustomizer
          initialStyle={initialBlobStyle}
          isDemo={Boolean(currentUser.isDemo)}
          labels={profile.blob}
          showHeader={false}
        />
      </div>
    </main>
  );
}
