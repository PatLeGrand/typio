import { requireLocale } from "@/i18n/requireLocale";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/auth/currentUser";
import { redirect } from "next/navigation";
import { RoomClient } from "./RoomClient";

export default async function RoomPage({ params }: { params: Promise<{ lang: string, code: string }> }) {
  const p = await params;
  const locale = requireLocale(p.lang);
  const dict = getDictionary(locale);
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  return (
    <main className="min-h-screen bg-background pb-20">
      <RoomClient code={p.code} lang={locale} dict={dict} user={user} />
    </main>
  );
}
