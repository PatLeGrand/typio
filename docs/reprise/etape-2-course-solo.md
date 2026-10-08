# Étape 2 — Course solo propre (après le checkpoint)

- **Branche :** `fix/race-screen`, partie de `develop` après l'étape 1
- **Exigences :** COURSE-3, COURSE-5, COURSE-7, CONFIG-1, CONFIG-2, CONFIG-4, CONFIG-6,
  CONFIG-7, TEXTE-1 à 3, RES-1, RES-2, BOT-2, UI-3, UI-5, H-10
- **But :** l'écran `src/app/[lang]/race/` (fait par Gemini) devient juste et réutilisable
  pour la course multijoueur (COURSE-1 à 3), qui suivra en étape 3.

## Ce qui est bon (garder)

- `src/race/config.ts` et `src/race/lifecycle.ts`, avec leurs tests.
- `SettingsForm`, `RadioCard`, `Switch`.
- La saisie de `RaceScreen` : préfixe correct, modes libre et bloquant, copier-coller bloqué.
- `RaceVisualizer` : le nettoyage de Pixi est correct.

## Ce qui est faux (corriger)

- [ ] **Horloge.** Le temps avance de +100 ms par tick de `setInterval`. Dans un onglet en
  arrière-plan, il passe environ 10 fois moins vite et la limite n'est pas respectée. Il
  faut calculer le temps écoulé depuis un horodatage de départ (`performance.now()`).
- [ ] **Précision.** En mode libre, après une erreur, toutes les frappes suivantes comptent
  comme fausses (`RaceScreen.tsx:134`). Il faut compter les frappes justes et fausses une
  par une.
- [ ] **Résultats (RES-1, RES-2).** Ajouter un écran de fin avec MPM final, précision, temps
  et rang, plus « Rejouer ». Ajouter « Abandonner » (COURSE-5).
- [ ] **Textes (TEXTE-1, H-10).** `sentences.ts` donne toujours les mêmes phrases dans le
  même ordre, et le mode « Mots » ne fait que couper une phrase. Il faut un tirage
  aléatoire filtré par langue et longueur, et une vraie liste de fréquence pour les mots.
- [ ] **Bots (BOT-2).** Vitesse variable, erreurs et pauses ; noms tirés du dictionnaire,
  pas codés en dur.
- [ ] **Types.** `RaceSettings` est dérivé de `RoomConfig` (`protocol.ts`), pour qu'une
  salle produise directement les réglages d'une course. Aujourd'hui, les deux ont des
  domaines différents (durée libre de 1 à 600 s contre une liste fixe).
- [ ] **UI-3, UI-5.** Supprimer « Arrivée : … px » et les ordinaux codés en dur. La scène
  Pixi garde un ciel clair en mode sombre : il faut lui donner des couleurs par thème. Le
  temps restant ne doit plus être visible seulement en `sr-only`.
- [ ] **Tests.** `RaceScreen` n'en a aucun : horloge (temps simulé), précision, fin de
  course, abandon.

## Critères d'acceptation

- **AC-1** Une course d'une minute dure une minute, onglet visible ou non.
- **AC-2** Taper 10 caractères avec 1 erreur corrigée donne une précision de 90 à 91 %.
- **AC-3** L'écran de fin affiche MPM, précision, temps et rang, et « Rejouer » relance
  avec un autre texte.
- **AC-4** FR/EN, clair/sombre, mobile/ordinateur.

## Étape 3 (à planifier)

Course multijoueur dans la salle : `START` par l'hôte (≥ 2 coureurs), compte à rebours,
même texte pour tous, progression validée côté serveur (COURSE-8), classement en direct
et résultats. Il faut d'abord étendre `protocol.ts`, ce qui relève de l'orchestrateur
(plan `feature-planning`).
