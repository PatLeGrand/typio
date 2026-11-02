---
name: commit
description: Préparer des commits petits et cohérents. Quand une tâche vérifiée doit être committée.
---
# Commit

- Committer seulement un travail vérifié, et seulement si l'utilisateur ou la config projet le prévoit.
- Un commit = un sujet cohérent ; refactoring et changement fonctionnel séparés.
- Ajouter les fichiers explicitement (`git add <chemins>`), jamais `git add -A` à l'aveugle ; relire `git diff --cached --stat`.
- Exclure les fichiers parasites : logs, builds, `.env`, fichiers temporaires, `.claude/state/`.
- Message : convention du projet, sinon `<type>: <résumé à l'impératif>` puis, si utile, le pourquoi en une ou deux lignes.
- Une micro-tâche ne justifie pas plusieurs commits.
- Ne jamais réécrire un historique déjà poussé ni contourner les hooks.
