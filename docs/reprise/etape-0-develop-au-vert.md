# Étape 0 — Remettre `develop` au vert

- **Branche :** `fix/develop-green`, partie de `develop` (`c22cb3c`)
- **But :** CI verte (test, lint, build, `build:realtime`), page profil qui fonctionne. Ensuite
  seulement, `develop` peut repartir vers `main` et la production.
- **Exigences :** QA-1, QA-3 (CI), UI-3, UI-5 (thème, FR/EN), AUTH-4 et AUTH-5 (le
  profil touche la session), H-14 (disposition du clavier dans le profil)
- **Hors périmètre :** pages `play/` et `room/` (réécrites à l'étape 1), écran de course
  (étape 2).

## Décisions prises

- La validation du profil n'utilise **pas** `zod` (absent de `package.json`). On réutilise
  `validatePseudo` de `src/auth/validation.ts`, comme l'inscription. Les erreurs sont des
  codes, traduits dans les dictionnaires.
- Disposition du clavier : les valeurs sont celles de la base, `qwerty | azerty | cmf`.
  Le libellé « Canadien multilingue » / « Canadian Multilingual » vient du dictionnaire.
- Stats du `ProfileModal` : les chiffres factices (0 course, 0 MPM) sont retirés. Une
  phrase « Les statistiques arrivent bientôt » les remplace, jusqu'à STATS-1.
- `/sandbox/race` est supprimée (publique en production, cassée, texte en dur).
- `fr_profile.json` (racine) est supprimé.
- On corrige les composants appelants, **pas** l'API des composants partagés : pas de
  `size` sur `Button`, pas de `className` sur `ButtonLink`. Le futur skill `ui` décidera.

## Tâches

- [x] **T1 — setup de test.** `src/test/setup.ts` : garder les polyfills `HTMLDialogElement`
  derrière `typeof HTMLDialogElement !== "undefined"`.
- [x] **T2 — erreurs de type du profil.** `profile/ProfileForm.tsx`, `profile/page.tsx`,
  `components/ProfileModal.tsx` : `Badge tone` (pas `variant`), `TextField` avec `label`
  et `error` en chaîne, `Button` sans `size` ni `variant="surface"`, `ButtonLink` sans
  `className` (envelopper si une mise en page est nécessaire).
- [x] **T3 — déconnexion.** « Se déconnecter » du profil passe par un `<form action={logout}>`
  comme `SiteHeader`, au lieu de `logout()` sans argument.
- [x] **T4 — action serveur du profil.** `profile/actions.ts` : pseudo par `validatePseudo`,
  disposition `qwerty | azerty | cmf`, langue `fr | en`, retour `{ ok } | { ok:false, code }`.
  Le formulaire devient un vrai `<form>` (Entrée valide).
- [x] **T5 — textes et tokens.** Aucun texte en dur dans `ProfileForm`, `ProfileModal`,
  `SiteHeader`. Plus de `|| "fallback"` sur les clés de dictionnaire. Tokens existants
  uniquement : `accent`, `danger`, `success`, `muted`… (liste dans `globals.css`).
  Retirer le `console.log`.
- [x] **T6 — `SiteHeader`.** Pas de `<p>` dans un `<button>` (HTML invalide). Le nom de
  l'utilisateur n'apparaît qu'une fois dans l'arbre accessible quand le menu est fermé.
- [x] **T7 — tests rouges.** `(site)/page.test.tsx` attend maintenant des liens vers
  `/[lang]/play`. `(site)/layout.test.tsx` passe sans `getAllByText()[0]`.
  `SiteHeader.test.tsx` revient à une requête précise.
- [ ] **T8 — ménage (⏳ suppression en attente de l'accord de Patrick).** Supprimer `fr_profile.json`, `src/app/[lang]/sandbox/`. Corriger
  les avertissements de lint (variables inutilisées).
- [x] **T9 — tests manquants.** `profile/actions.ts` : pseudo invalide, disposition
  inconnue, `cmf` accepté, invité/membre, sans session. `ProfileModal` : membre, invité,
  aucun chiffre factice.

## Critères d'acceptation

- **AC-1** `bun run test` : toutes les suites démarrent, y compris `src/auth/*` et
  `src/realtime/server.test.ts`. Aucun test désactivé. Les tests PostgreSQL passent avec
  `DATABASE_URL` sur la base locale.
- **AC-2** `bun run lint` : 0 erreur, 0 avertissement. `bun run build` et
  `bun run build:realtime` passent.
- **AC-3** Profil : changer le pseudo, la langue et la disposition (dont `cmf`) enregistre
  sans erreur. Un pseudo invalide affiche un message traduit.
- **AC-4** « Se déconnecter » depuis le profil déconnecte et ramène à l'accueil.
- **AC-5** Profil et menu de profil en FR et en EN : aucun mot de l'autre langue. Clair et
  sombre lisibles. Mobile et ordinateur.
- **AC-6** `security-reviewer` passé sur `profile/actions.ts` (écriture du profil depuis
  la session).

## Journal

- 2026-10-08 : branche créée, fiche écrite.
- 2026-10-08 : T1 à T7 et T9 faits par `implementer`. Revues :
  - `code-reviewer` : approuvé, 2 tests ajoutés à sa demande.
  - `security-reviewer` : rien de bloquant. Limite de débit `profileUpdates` ajoutée
    (20 par 15 min par utilisateur).
  - Gemini : P1 « cookie `NEXT_LOCALE` » écarté (faux, `src/proxy.ts:28` le met à jour) ;
    compteur et radios corrigés.
- Résultats : test (1242 tests, PostgreSQL compris), lint et `tsc` passent.
- Navigateur : enregistrement de `cmf` persistant, FR/EN, sombre, mobile vérifiés.
- Ajouts hors fiche :
  - Contrôle d'usurpation sur le nom affiché (même règle que le pseudo d'invité).
  - Disposition et langue en vrais boutons radio (`profile/ChoiceRadio.tsx`).
- **Reste :** T8, car la suppression de `fr_profile.json` et de `src/app/[lang]/sandbox/` a
  été refusée par le contrôle de permissions. Patrick doit la faire ou l'autoriser :
  `git rm -r fr_profile.json "src/app/[lang]/sandbox"`.
- **Suivi séparé :** l'usurpation par homoglyphes (« аlice » en cyrillique) touche
  invités et membres ; elle demande une tâche dédiée. Le second pool PostgreSQL de
  `src/db/shared.ts` (10 connexions au total sur la base partagée) est à unifier.
