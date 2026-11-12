---
name: react-next-refactoring
description: Auditer puis refactoriser le code React 19 / Next 16 de Typio pour le rendre propre et maintenable, sans changer le comportement. Pour une passe de qualité demandée explicitement (audit complet ou application d'un rapport d'audit).
---
# Refactoring React et Next (Typio)

Deux modes, indiqués par le brief :
- **audit** : lire le code, ne rien modifier, produire un rapport classé ;
- **application** : appliquer les constats retenus d'un rapport, sans en inventer d'autres.

Ce skill **remplace** la règle « aucun refactoring opportuniste » du skill `refactoring` : ici le refactoring est la tâche. Les autres règles restent : comportement inchangé, petites transformations, vérifiées une par une.

## Avant de juger
- Next 16 et React 19 ont des API qui diffèrent de tes connaissances. Avant de déclarer un usage « obsolète » ou « faux », vérifie dans `node_modules/next/dist/docs/` (`01-app/`) et dans le code existant. Pas de constat sur une API sans source.
- Lis `CLAUDE.md` et `docs/EXIGENCES.md` (section « Choix documentés ») : une bizarrerie peut être un choix tranché (H-xx). On ne la « corrige » pas.
- Ne touche pas à `.claude/`, à `infra/`, aux migrations versionnées (`drizzle/`), ni aux textes des dictionnaires (sauf clés mortes).

## Ce qu'on cherche (par ordre de valeur)
1. **Frontière serveur / client** : `"use client"` posé trop haut (page entière cliente pour un seul bouton), données récupérées côté client alors qu'un Server Component suffit, secrets ou modules serveur importables depuis un composant client, actions serveur sans validation Zod (TECH-07) ou sans contrôle d'identité par la session.
2. **Hooks et état** : `useEffect` qui dérive un état (à calculer pendant le rendu), état dupliqué ou désynchronisé, effets sans nettoyage, dépendances manquantes masquées, `useRef` utilisé comme état, double déclenchement en mode strict non géré.
3. **Composants trop gros** : fichier de plus de ~300 lignes ou JSX de plus de ~150 lignes mêlant plusieurs responsabilités ; ternaires imbriqués illisibles ; listes de props géantes. Extraire des sous-composants ou des hooks nommés selon le domaine, dans le même dossier.
4. **Duplication réelle** : même logique (formatage, calcul, garde d'accès) copiée à 3 endroits ou plus. Deux occurrences ne justifient pas une abstraction.
5. **Typage** : types redéclarés à la main au lieu d'être dérivés (`z.infer`, `ReturnType`, types du protocole), unions non discriminées, assertions `as` évitables. Toujours TECH-02 : aucun `any`, aucun `@ts-ignore`.
6. **Code mort** : exports, composants, clés i18n, props jamais utilisés (vérifiés par recherche d'imports, skill `dead-code`).
7. **Conventions Next** : `loading`/`error`/`not-found` cohérents, `metadata`, `params` asynchrones, `next/link` et `next/image` là où ils apportent quelque chose.
8. **Accessibilité et i18n au passage** : texte visible codé en dur (I18N-01), balise non sémantique (A11Y-02). On signale, on corrige si trivial.

## Ce qu'on ne fait pas
- Pas de changement de comportement, de texte visible, de style ni de mise en page.
- Pas de nouvelle dépendance, pas de changement de bibliothèque ou d'architecture globale (state manager, data fetching, ORM).
- Pas de renommage de masse ni de déplacement de fichiers sans gain clair.
- Pas de reformatage, pas de réécriture « au goût du jour » d'un code correct et lisible.
- Pas de commentaire ajouté sauf s'il explique un pourquoi non évident (skill `code-comments`).
- Zones sensibles (auth, sessions, temps réel, anti-triche, droits de l'hôte, téléversements) : seulement des transformations triviales et prouvées équivalentes ; sinon, signaler sans toucher.

## Format du rapport d'audit
Fichier Markdown, constats numérotés et classés par valeur. Pour chacun :
- `R<n>` · catégorie (1 à 8 ci-dessus) · effort S/M/L · risque faible/moyen/élevé ;
- fichier(s) et lignes ;
- problème en une ou deux phrases ;
- transformation proposée, concrète (quoi extraire, où, sous quel nom) ;
- comment prouver l'équivalence (tests existants, nouveau test, vérification manuelle).
Termine par une courte liste « à ne pas toucher » (ce qui paraît sale mais est voulu).
Viser la qualité, pas le volume : 15 à 40 constats utiles valent mieux que 150 remarques.

## Application
- Un constat = un changement isolé, vérifié par `bunx tsc --noEmit`, `bun run lint` et les tests concernés avant de passer au suivant.
- Si un constat se révèle faux ou risqué une fois dans le code, le sauter et le dire.
- Les tests existants ne sont modifiés que pour suivre un déplacement ou un renommage ; jamais pour faire passer un changement de comportement.
- À la fin : suite complète `bun run test`, `bun run build` (et `bun run build:realtime` si `src/realtime/` a bougé).
