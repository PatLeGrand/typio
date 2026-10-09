import { requireLocale } from "@/i18n/requireLocale";
import { getDictionary } from "@/i18n/dictionaries";
import { DEFAULT_RACE_SETTINGS, deserializeRaceSettings } from "@/race/config";
import { SettingsForm } from "./SettingsForm";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const locale = requireLocale((await params).lang);
  const { raceSettings } = getDictionary(locale);
  return {
    title: `${raceSettings.title} | Typio`,
  };
}

export default async function RaceSettingsPage({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ config?: string | string[] }>;
}) {
  const locale = requireLocale((await params).lang);
  const dict = getDictionary(locale);
  // Back from a race: `?config=` pre-fills the choices; an invalid one falls back to the defaults.
  const initialSettings = deserializeRaceSettings((await searchParams).config) ?? { ...DEFAULT_RACE_SETTINGS };
  return <SettingsForm lang={locale} dict={dict.raceSettings} initialSettings={initialSettings} />;
}
