import { getCurrentUserForDisplay } from "@/auth/currentUser";
import { requireLocale } from "@/i18n/requireLocale";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import { TextField } from "@/components/TextField";
import { Card } from "@/components/Card";

export default async function PlayPage({ params }: { params: Promise<{ lang: string }> }) {
  const locale = requireLocale((await params).lang);
  const user = await getCurrentUserForDisplay();

  return (
    <main className="flex-1 bg-surface px-4 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-4xl flex flex-col gap-8 md:flex-row">
        {/* Créer une salle */}
        <Card className="flex-1 flex flex-col p-8 gap-6 border border-island-sand">
          <div className="flex-1">
            <h2 className="text-2xl font-semibold mb-4">Créer une salle</h2>
            <p className="text-muted leading-relaxed">
              Configure une course sur mesure, invite tes amis et lance la partie quand tout le monde est prêt.
            </p>
          </div>
          <div>
            {user === null ? (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  La création de salle est réservée aux membres.
                </p>
                <div className="flex gap-4">
                  <ButtonLink href={`/${locale}/login`} variant="primary">
                    Se connecter
                  </ButtonLink>
                </div>
              </div>
            ) : user.kind === "guest" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  La création de salle est réservée aux membres inscrits.
                </p>
                <ButtonLink href={`/${locale}/register`} variant="primary">
                  S&apos;inscrire pour créer
                </ButtonLink>
              </div>
            ) : (
              <Button>Créer une salle</Button>
            )}
          </div>
        </Card>

        {/* Rejoindre une salle */}
        <Card className="flex-1 flex flex-col p-8 gap-6 border border-island-sand">
          <div className="flex-1">
            <h2 className="text-2xl font-semibold mb-4">Rejoindre avec un code</h2>
            <p className="text-muted leading-relaxed">
              Saisis le code à 6 caractères que l&apos;hôte t&apos;a partagé.
            </p>
          </div>
          <form action={`/${locale}/room/ABCDEF`} className="flex flex-col gap-5">
            <TextField 
              label="Code de la salle" 
              name="code" 
              placeholder="Ex: AB12CD" 
              maxLength={6}
              required
            />
            {user === null && (
               <div className="rounded-xl bg-island-sand p-4 text-sm text-muted">
                 Tu vas rejoindre en tant qu&apos;invité. <a href={`/${locale}/login`} className="underline font-medium text-foreground hover:text-primary">Connecte-toi</a> si tu veux sauvegarder tes statistiques.
               </div>
            )}
            <Button type="submit">Rejoindre</Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
