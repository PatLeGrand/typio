---
name: verification
description: Vérifier un changement avec les outils déterministes avant de recourir à une review LLM. Après chaque implémentation.
---
# Verification

Utiliser d'abord le contrôle le moins cher capable de valider correctement le changement ; ne pas lancer automatiquement lint, build ou tests complets quand une vérification ciblée suffit. Réutiliser les builds et caches incrémentaux existants, sauf si un fichier dont ils dépendent a changé.

Dans l'ordre, en s'arrêtant à ce qui est disponible et pertinent (commandes dans CLAUDE.md) :
1. compilation / build ;
2. type checker ;
3. linter sur les fichiers modifiés ;
4. tests ciblés sur la zone modifiée ;
5. suite plus large seulement si le changement est transversal ;
6. `git diff --stat` puis `git diff` : périmètre conforme au brief, aucun fichier parasite.

TINY ou SMALL : si ces étapes démontrent que la tâche est réussie, pas de review LLM. MEDIUM ou LARGE : la review a lieu une seule fois, sur la feature terminée, pas après chaque lot.
Un échec de vérification retourne au développeur initial avec l'erreur exacte (extrait court).
Ne jamais déclarer terminé sans avoir exécuté au moins une vérification réelle ou signalé qu'aucune n'existe.
