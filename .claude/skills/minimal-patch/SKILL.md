---
name: minimal-patch
description: Modifier le minimum de code nécessaire. Règle par défaut de tout agent qui écrit du code.
---
# Minimal patch

Lire autant que nécessaire, écrire aussi peu que nécessaire.

- Réutiliser l'existant : fonctions, utilitaires, conventions, style du fichier.
- Éditer les lignes concernées ; ne jamais réécrire un fichier pour quelques lignes.
- Interdit sauf demande explicite : refactoring, renommage esthétique, réorganisation, reformatage, nouvelle abstraction.
- Pas de nouvelle dépendance sans justification (skill `dependency-management`).
- Rester dans le périmètre : un problème voisin se signale dans le compte rendu, il ne se corrige pas.
- Le diff final doit pouvoir être relu en entier sans effort.
