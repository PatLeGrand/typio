"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Locale } from "@/i18n/config";
import { prefixWithLocale } from "@/i18n/paths";
import type { ConnectionStatus } from "./roomConnection";

/** Session refusée par le service temps réel (D9) : retour à la page de connexion. */
export function useLoginRedirect(connection: ConnectionStatus, locale: Locale): void {
  const router = useRouter();
  useEffect(() => {
    if (connection === "unauthenticated") router.replace(prefixWithLocale("/login", locale));
  }, [connection, locale, router]);
}
