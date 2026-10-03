import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./config";

/** Valide le segment `[lang]` : une locale inconnue donne une 404, pas une erreur. */
export function requireLocale(value: string): Locale {
  if (!isLocale(value)) notFound();
  return value;
}
