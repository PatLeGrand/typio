---
name: gemini-task-workflow
description: Analyser, réaliser et vérifier une tâche de code confiée directement à Gemini dans Typio. À utiliser pour toute implémentation, correction ou modification du dépôt par Antigravity ; pas pour les consultations Gemini en lecture seule via scripts/gemini/run.ts.
---

# Travail de Gemini dans Typio

Quand une tâche te demande de modifier le dépôt, suis cette boucle jusqu'à obtenir un résultat vérifié ou un blocage précis. Adapte la profondeur de l'analyse et des tests à la taille du changement. Une petite correction ne demande pas un long plan.

## 1. Comprendre avant de modifier

- Reformule le résultat observable demandé et les limites de la tâche. Lis `AGENTS.md`, les consignes locales et les documents pertinents. Pour la salle en temps réel, lis `docs/plan-salle-temps-reel.md` et respecte le lot confié ainsi que les fichiers gelés.
- Inspecte `git status`, le code existant, ses appels, ses tests et les conventions applicables. Repère les modifications déjà présentes et préserve-les. Ne déduis pas le fonctionnement d'un fichier de son seul nom.
- Si tu touches à Next.js, lis le guide pertinent dans `node_modules/next/dist/docs/` avant de coder. Si tu touches à Docker ou PostgreSQL, lis `docs/stack-docker-postgresql.md`.
- Identifie la cause du problème ou les endroits exacts à changer, les cas limites et les vérifications qui prouveront le résultat. Pour une ambiguïté qui change fortement le comportement attendu, pose une question ciblée ; continue les parties indépendantes.

## 2. Décider et réaliser

- Énonce brièvement la solution choisie, les fichiers concernés et le critère de réussite. Vérifie que chaque modification sert la demande ; évite les refontes et les changements de dépendances sans nécessité démontrée.
- Modifie par petites étapes cohérentes. Respecte les contrats, l'architecture et les conventions déjà en place. N'écrase pas les changements d'autrui. Si une hypothèse se révèle fausse, réinspecte le code et corrige le plan avant de poursuivre.
- Ne lance pas de commande destructrice, de publication, de déploiement ou de changement sur une branche protégée sans autorisation applicable. Les restrictions de `AGENTS.md` prévalent toujours.

## 3. Tester le résultat réel

- Ajoute ou adapte un test pertinent quand le comportement change ou qu'une régression doit être évitée. Vérifie le cas demandé et les erreurs ou limites importantes. Ne change pas un test uniquement pour masquer un échec.
- Exécute les contrôles adaptés au changement à partir des scripts réellement définis dans le dépôt : tests ciblés, puis lint, build ou vérification navigateur si nécessaires. Si un contrôle échoue, examine la cause, corrige et relance les contrôles affectés. Une commande non exécutée ou bloquée n'est jamais un succès.
- Relis le diff final et `git status` : confirme la portée, l'absence de changements accidentels et la cohérence entre code et tests. Arrête les essais répétitifs si une dépendance externe ou une décision utilisateur bloque réellement le travail.

## 4. Rendre compte

Réponds dans la langue de l'utilisateur, de façon concise : ce qui a changé, pourquoi, les contrôles exécutés et leurs résultats, puis les limites ou blocages restants. Cite les fichiers utiles. Distingue toujours « testé avec succès », « non testé » et « bloqué ». Ne déclare pas la tâche terminée si le comportement demandé n'est pas obtenu.

Cette skill concerne Gemini lorsqu'il travaille directement dans le dépôt. Le chemin `scripts/gemini/run.ts` est volontairement limité à la lecture par [gemini-delegation](../gemini-delegation/SKILL.md) ; cette skill ne lui donne aucune permission d'écriture.
