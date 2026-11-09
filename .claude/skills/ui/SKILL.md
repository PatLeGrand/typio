---
name: ui
description: Refonte et travail visuel sur l'interface de Typio (pages, composants partagés, tokens, piste de progression). À charger pour toute tâche qui change ce que l'utilisateur voit. Fixe la direction, les interdits DES-01 à DES-06 et la checklist de finition.
---
# UI de Typio

Objectif : un site reconnaissable, qu'on ne pourrait pas confondre avec un modèle généré (DES-04), pensé pour des 12-17 ans, professionnel et ludique. Ce skill remplace la consigne « UI basique et neutre » de `CLAUDE.md`.

## Ce qui fait autorité
Dans l'ordre : `docs/enonce.md` (DES-*, A11Y-*, I18N-*), les maquettes Figma de Patrick et `docs/design/`, les tokens de `src/app/globals.css`, `docs/DEMARCHE-CREATIVE.md`.

L'univers actuel est à prolonger, pas à effacer : fond crème, violet d'accent, touches de clavier jaune, menthe et corail, île sable et menthe, mascotte poulpe, piste dessinée en PixiJS.

**Réservé à Patrick, jamais produit par une IA :** nom et logo (DES-01, DES-02), croquis, moodboard, raison des choix de palette et de typographies (DES-03). Ne pas les rédiger, ne pas les générer, ne pas les redessiner. `Logo.tsx` et la mascotte s'utilisent tels quels.

**Changer la palette ou les polices est une décision de Patrick.** Si la tâche semble l'exiger, présenter 2 ou 3 options argumentées à l'orchestrateur au lieu de trancher. Toute police ajoutée passe par `next/font`, avec une licence compatible.

## Refonte sans casser
- On change l'apparence, pas le comportement : ne pas toucher à `useRaceSession`, `src/realtime/`, aux actions serveur ni aux validations Zod pour une raison visuelle.
- Couleurs uniquement par tokens (`bg-surface`, `text-accent-text`…). Seule exception existante : `SCENE_COLORS` dans `RaceVisualizer.tsx`, à garder aligné sur les deux thèmes.
- Un token modifié : mettre à jour `src/theme/contrast.test.ts` si une paire change, et les tableaux de `docs/DEMARCHE-CREATIVE.md`.
- Mutualiser dans `src/components/` (`Button`, `TextField`, `Card`…) au lieu de recopier des classes. Pas de composants shadcn/ui bruts.
- Avant tout code Next : le guide concerné dans `node_modules/next/dist/docs/` (`AGENTS.md`).

## La piste est la signature (DES-04)
Chaque page importante doit en porter un écho (forme, rythme, personnages, lignes de course), sans copier le canvas partout. Garder : image statique sur mobile (PERF-01), figée si `prefers-reduced-motion`, `<canvas>` en `aria-hidden` avec l'information disponible en texte (A11Y-03).

## À refuser
Signes d'une UI générée. Si l'un d'eux paraît justifié, le dire et expliquer pourquoi.
- **Énoncé DES-04 :** shadcn/ui non personnalisé, dégradé violet dans le hero (vigilance : l'accent est violet), émojis ou glyphes Unicode comme icônes, landing page SaaS sans lien avec la course. L'enchaînement actuel des sections de l'accueil est justement le point encore partiel.
- **Structure :** grille de cartes identiques icône + titre + texte, cartes imbriquées, gros chiffre + petit libellé + stats comme gabarit, surtitre au-dessus de chaque titre, sections numérotées 01/02/03, modale là où une page ou un panneau suffit.
- **Surfaces :** texte en dégradé, verre et flou décoratifs, halo coloré sans décalage, bordure latérale colorée épaisse sur les cartes, ombres dures par réflexe, monospace pour « faire technique » (le mono du texte à taper est justifié), Inter partout sans parti pris typographique assumé.
- **Mouvement :** une seule animation marquante par écran, pas la même apparition sur chaque section. Jamais pendant la frappe si elle gêne la lecture.

## Obligatoire
- **Thèmes (DES-05) :** chaque écran en clair et en sombre, sans flash. Ne pas se contenter d'inverser : vérifier les décors et les ombres.
- **Langues (I18N-01) :** aucun texte en dur, clés ajoutées ensemble dans `src/i18n/dictionaries/`. Dates et nombres par `Intl`. Tester le texte réel : l'anglais et le français n'ont pas la même longueur.
- **Responsive (DES-06) :** dès 360 px sans défilement horizontal. Sur mobile, la zone de frappe reste remplacée par le message « clavier physique », la piste reste visible.
- **Accessibilité (A11Y-01 à 04) :** AA en clair et en sombre, HTML sémantique avant ARIA, un `<h1>` sans saut de niveau, libellés sur les champs et les boutons-icônes, focus visible partout, parcours au clavier.
- **TECH-02 :** TypeScript uniquement, aucun `any`.

## Checklist de finition
**États :** survol, focus, actif, désactivé, chargement, erreur, vide. Contenu court, moyen et très long (pseudos, codes de salle) : `min-w-0`, troncature ou retour à la ligne.

**Formulaires :** `<label>` lié, `type`, `name` et `autocomplete` corrects, coller jamais bloqué, erreur à côté du champ avec la marche à suivre, focus sur la première erreur, bouton actif jusqu'à l'envoi.

**Animation :** `prefers-reduced-motion` respecté, propriétés listées (jamais `transition: all`), interruptible, pas d'animation automatique longue sans moyen de l'arrêter.

**Typographie française :** `…` et non `...`, guillemets « », espaces insécables avant `: ; ? !` et dans « 10 Mo ». Majuscule en début de phrase seulement, pas de Title Case. Chiffres tabulaires pour MPM, précision, chrono et classements (`tabular-nums`). Titres en `text-balance`, largeur de lecture de 65 à 75 caractères.

**Détails du navigateur :** sélection de texte, curseur de saisie, barres de défilement, `<select>` natifs, `color-scheme`, `<meta name="theme-color">` accordés au thème. Ce sont les détails qu'on oublie le plus.

**Images et performance :** `width` et `height` explicites, `loading="lazy"` sous la ligne de flottaison, pas de lecture de mise en page au rendu, frappe sans ralentissement (la saisie reste prioritaire sur le décor).

**Navigation :** `<a>`/`Link` pour naviguer, `<button>` pour agir, jamais de `<div onClick>`. Action destructive confirmée ou annulable. Marques et codes en `translate="no"`.

## Figma
Lire la maquette (contexte de conception, capture, variables), puis traduire vers les tokens et composants existants. Ne pas recopier les valeurs en dur ni le code généré tel quel. Les agents sans accès à Figma reçoivent les valeurs utiles dans leur brief.

## Fin de lot
1. `bun run lint`, `bunx tsc --noEmit`, tests ciblés.
2. E2E concernés : `e2e/a11y.spec.ts`, `e2e/keyboard.spec.ts`, `e2e/preferences.spec.ts`.
3. Rendu réel à 360, 768 et 1 280 px, clair et sombre, FR et EN (`.claude/launch.json`).
4. Feature terminée : passage de l'agent `ui-adversary`, avant la review du diff.

Sources adaptées : Impeccable de Paul Bakaus (Apache-2.0), `frontend-design` d'Anthropic, Web Interface Guidelines de Vercel Labs (MIT). Règles reformulées et ajustées à Typio.
