---
name: code-review
description: Relire un diff pour trouver des problèmes réels (bugs, régressions, edge cases, tests manquants). Pour la QA d'un changement.
---
# Code review

Entrées : demande originale, diff, résultats des tests. Lire les fichiers concernés seulement quand le diff ne suffit pas.

Chercher, par priorité :
1. bugs de correction et comportement contraire à la demande ;
2. régressions sur le code appelant ;
3. edge cases réalistes non gérés ;
4. tests manquants pour un comportement important (skill `unit-testing`) ;
5. sécurité, si le diff touche une zone sensible (skill `security-review`).

Ignorer : style, nommage, préférences, refactorings souhaitables, hypothèses invérifiables.

Format de réponse :
```
VERDICT : OK | À CORRIGER
- [haute|moyenne] chemin:ligne — problème — scénario concret qui le déclenche — correction en une ligne
```
Pas de constat sans scénario concret. Au plus 8 constats, les plus graves d'abord. « Rien de significatif » est une réponse valide.
