import "server-only";
import { after } from "next/server";
import { getAuthDeps } from "./deps";
import { describeError } from "./errors";
import { purgeExpired } from "./purge";

/**
 * Déclenche le nettoyage des sessions et des invités échus (H-2) depuis le rendu d'une page,
 * pour tout visiteur, et non seulement à l'ouverture d'une session : sans cela, un invité
 * inactif resterait en base tant que personne ne se connecte.
 *
 * `after` exécute le travail une fois la réponse envoyée : le rendu n'attend rien. La purge
 * est de toute façon limitée à un lot et à une fois par minute et par processus (`purgeExpired`).
 * Rien ne peut faire échouer le rendu : l'appel à `after` et la création des dépendances sont
 * dans un `try`, et les erreurs sont journalisées (nom et code seulement).
 */
export function schedulePurge(): void {
  try {
    after(async () => {
      try {
        await purgeExpired(getAuthDeps());
      } catch (error) {
        console.error("[auth] scheduled purge failed", describeError(error));
      }
    });
  } catch (error) {
    // `after` peut refuser d'être appelé hors d'une requête : jamais bloquant.
    console.error("[auth] could not schedule the purge", describeError(error));
  }
}
