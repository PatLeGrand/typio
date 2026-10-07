import { requireLocale } from "@/i18n/requireLocale";
import { getDictionary } from "@/i18n/dictionaries";
import { SettingsForm } from "./SettingsForm";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const { raceSettings } = getDictionary(locale);
  return {
    title: `${raceSettings.title} | Typio`,
  };
}

export default async function RaceSettingsPage({ params }: { params: Promise<{ lang: string }> }) {
  const locale = requireLocale((await params).lang);
  const dict = getDictionary(locale);
  return <SettingsForm lang={locale} dict={dict.raceSettings} siteName={dict.site.name} />;
}
