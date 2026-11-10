import type { Metadata } from "next";
import { NotFoundView, notFoundTitle } from "@/components/NotFoundView";
import { requireLocale } from "@/i18n/requireLocale";

export async function generateMetadata({ params }: PageProps<"/[lang]/missing">): Promise<Metadata> {
  return { title: notFoundTitle(requireLocale((await params).lang)) };
}

/**
 * Page 404 rendue en HTML par le serveur. Le proxy y réécrit toute adresse inconnue avec le
 * statut 404 (un `notFound()` ne donne qu'un document vide avant hydratation, sans thème).
 */
export default async function NotFoundDocument({ params }: PageProps<"/[lang]/missing">) {
  return <NotFoundView locale={requireLocale((await params).lang)} />;
}
