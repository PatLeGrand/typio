import { ButtonLink } from "@/components/ButtonLink";
import type { Dictionary } from "@/i18n/dictionaries";

type Props = {
  labels: Dictionary["raceScreen"]["noText"];
  settingsHref: string;
};

/** TEXTE-1 : les filtres ne laissent aucun texte, on l'explique au lieu de lancer une course vide. */
export function RaceNoText({ labels, settingsHref }: Props) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-4 py-12 text-foreground">
      <h1 className="text-3xl font-bold">{labels.title}</h1>
      <p role="alert">{labels.message}</p>
      <div>
        <ButtonLink href={settingsHref}>{labels.back}</ButtonLink>
      </div>
    </main>
  );
}
