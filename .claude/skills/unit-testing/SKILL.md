---
name: unit-testing
description: Décider si un test unitaire vaut la peine d'être écrit, et l'écrire. Quand une tâche ajoute ou corrige de la logique.
---
# Unit testing

Par défaut, pas de nouveau test : en écrire un seulement si le brief le demande ou si la logique touchée l'exige vraiment (liste ci-dessous).

Avant chaque test : « Quel comportement important ce test protège-t-il ? » Sans réponse claire, ne pas l'écrire.

Tester en priorité : logique métier, calculs, transformations importantes, validations, permissions, états complexes, algorithmes, branches significatives, edge cases réalistes, bug corrigé susceptible de revenir (test qui échoue avant le correctif).

Ne pas tester : HTML statique, CSS, boutons triviaux, getters/setters, boilerplate, comportements évidents, code déjà couvert ailleurs.

- Quelques tests à forte valeur plutôt que beaucoup de tests faibles ; jamais pour la couverture.
- Suivre le framework et les conventions de test existants.
- Tester le comportement observable, pas l'implémentation ; mocker seulement les frontières (réseau, horloge, I/O).
