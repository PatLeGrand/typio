import { getCurrentUserForDisplay } from "@/auth/currentUser";
import { HomeAboutSection } from "@/components/home/HomeAboutSection";
import { HomeApproachSection } from "@/components/home/HomeApproachSection";
import { HomeCallToAction } from "@/components/home/HomeCallToAction";
import { HomeFooter } from "@/components/home/HomeFooter";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeSideLane } from "@/components/home/HomeSideLane";
import { HomeVideoSection } from "@/components/home/HomeVideoSection";
import { HomeWhySection } from "@/components/home/HomeWhySection";
import { displayFont } from "@/components/home/homeFonts";
import { getDictionary } from "@/i18n/dictionaries";
import { requireLocale } from "@/i18n/requireLocale";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const locale = requireLocale((await params).lang);
  const dictionary = getDictionary(locale);
  const { home } = dictionary;
  const user = await getCurrentUserForDisplay();

  return (
    <>
      <main className={`${displayFont.variable} min-w-0 flex-1 overflow-x-clip`}>
        <HomeHero home={home} locale={locale} keyboardLabel={dictionary.room.race.keyboard} />
        <div className="relative isolate">
          <HomeSideLane />
          <HomeWhySection home={home} />
          <HomeVideoSection home={home} />
          <HomeApproachSection home={home} />
          <HomeAboutSection home={home} />
        </div>
        <HomeCallToAction home={home} locale={locale} user={user} />
      </main>
      <HomeFooter dictionary={dictionary} locale={locale} user={user} />
    </>
  );
}
