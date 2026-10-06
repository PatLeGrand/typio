import { getCurrentUserForDisplay } from "@/auth/currentUser";
import { HomeAboutSection } from "@/components/home/HomeAboutSection";
import { HomeApproachSection } from "@/components/home/HomeApproachSection";
import { HomeCallToAction } from "@/components/home/HomeCallToAction";
import { HomeFeatureSection } from "@/components/home/HomeFeatureSection";
import { HomeFooter } from "@/components/home/HomeFooter";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeVideoSection } from "@/components/home/HomeVideoSection";
import { HomeWhySection } from "@/components/home/HomeWhySection";
import { getDictionary } from "@/i18n/dictionaries";
import { requireLocale } from "@/i18n/requireLocale";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const locale = requireLocale((await params).lang);
  const dictionary = getDictionary(locale);
  const { home } = dictionary;
  const user = await getCurrentUserForDisplay();

  return (
    <>
      <main className="flex-1">
        <HomeHero home={home} />
        <HomeWhySection home={home} />
        <HomeVideoSection home={home} />
        <HomeFeatureSection home={home} variant="preview" />
        <HomeFeatureSection home={home} variant="detail" />
        <HomeApproachSection home={home} />
        <HomeAboutSection home={home} />
        <HomeCallToAction home={home} locale={locale} user={user} />
      </main>
      <HomeFooter dictionary={dictionary} locale={locale} user={user} />
    </>
  );
}
