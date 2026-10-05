"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/Button";
import { defaultLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getPathLocale } from "@/i18n/paths";

/**
 * Filet de sécurité de toutes les pages `[lang]` : une erreur inattendue (par exemple une
 * base de données injoignable sur une page qui en a besoin) affiche un message simple et un
 * bouton « Réessayer » au lieu d'une page blanche. La langue vient du chemin : un composant
 * d'erreur ne reçoit pas les `params`.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const locale = getPathLocale(usePathname()) ?? defaultLocale;
  const { errorPage } = getDictionary(locale);

  useEffect(() => {
    // Seul le digest est journalisé : il permet de retrouver l'erreur dans les journaux du serveur.
    console.error("[app] route error", { digest: error.digest });
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-[32px] font-bold leading-[1.15]">{errorPage.title}</h1>
      <p className="text-base leading-[1.55] text-muted">{errorPage.text}</p>
      <Button onClick={() => retry()}>{errorPage.retry}</Button>
    </main>
  );
}
