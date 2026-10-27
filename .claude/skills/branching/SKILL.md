---
name: branching
description: Branches, worktrees et intégration dans main (squash merge, rebase, nettoyage). Avant de commencer une tâche significative, de paralléliser des agents ou d'intégrer une branche.
---
# Branching

Principe : `main` stable → branche courte et isolée → développement → vérification/QA proportionnelle au risque → squash merge → nettoyage.
Ne pas créer de branche, worktree, rebase, review ou merge supplémentaire simplement parce que c'est possible : le branching reste proportionnel à la tâche (skill `token-budget`).

## Quand brancher
- `main` est toujours l'état stable et validé. Une tâche significative (feature, bug significatif, refactor, changement risqué) ne se développe pas sur `main`.
- Micro-modification : suivre le workflow existant du projet (config CLAUDE.md) si une branche coûte plus qu'elle n'apporte.
- Partir de `main` à jour ; vérifier `git status` avant (pas de changements étrangers embarqués).
- Nommer `feature/…`, `fix/…`, `refactor/…`, `chore/…`, sauf convention du projet. Une branche = une responsabilité, courte.
- Pas de `develop` par défaut : `branche de tâche → main`. `develop` seulement si le projet l'utilise déjà ou si une vraie branche d'intégration est justifiée (plusieurs développeurs, nombreuses features parallèles, releases planifiées, staging distinct).

## Multi-agents
- Jamais deux agents sur la même branche ou les mêmes fichiers en même temps.
- Paralléliser seulement des tâches réellement indépendantes : une branche par tâche, un worktree séparé quand l'isolation l'exige (`git worktree add ../<repo>-<tâche> -b <branche> main`). Aucun agent n'écrit dans l'espace de travail d'un autre.
- L'orchestrateur coordonne l'intégration, une branche après l'autre.

## Intégration
1. Validation : uniquement les contrôles justifiés par le budget (build si pertinent, tests et lint/type-check ciblés, tests supplémentaires si le risque le justifie, QA si c'est une grosse feature, review de la feature complète : voir `orchestrator.md`). Pas de merge si une vérification importante échoue.
2. Mise à jour si `main` a avancé : rebase de la branche sur `main` quand c'est sûr (branche non partagée), puis revérifier ce que le rebase a pu toucher. Le rebase sert à rattraper `main`, pas de stratégie de merge finale.
3. Squash merge par défaut : `git switch main && git merge --squash <branche> && git commit` (message : skill `commit`). Les commits de travail restent sur la branche ; `main` reçoit un commit propre par tâche logique.
4. Merge commit classique seulement s'il faut explicitement conserver l'historique de la branche.

## Après le merge
- Vérifier que `main` est dans l'état attendu (`git log -1 --stat`, contrôle ciblé si utile).
- Supprimer la branche locale : `git branch -D <branche>` (après un squash, git ne la voit pas comme fusionnée ; `-D` seulement une fois le contenu confirmé sur `main`).
- Supprimer le worktree associé : `git worktree remove <chemin>`.
- Ne jamais réécrire un historique partagé, ni pousser, forcer ou supprimer une branche distante sans demande explicite.
