---
name: debugging
description: Trouver la cause racine d'un bug avant de le corriger. Pour un comportement inattendu, une erreur ou un test qui échoue.
---
# Debugging

1. Reproduire : commande ou test minimal qui montre le problème. Sans reproduction, le dire.
2. Lire l'erreur exacte et la stack trace : partir de la première frame dans le code du projet.
3. Formuler une hypothèse, la tester par l'observation la moins chère (lecture ciblée, log temporaire, test isolé).
4. Corriger la cause, pas le symptôme. Pas de correctif « au cas où » sur des hypothèses non confirmées.
5. Vérifier avec la reproduction de l'étape 1, puis retirer les logs temporaires.

Après deux hypothèses infirmées, s'arrêter et rendre compte (ce qui a été testé, ce qui est exclu) plutôt que de tâtonner.
Un bug corrigé susceptible de revenir mérite un test de non-régression (skill `unit-testing`).
