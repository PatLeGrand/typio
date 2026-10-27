---
name: context-management
description: Choisir le contexte minimal à transmettre à un agent ou à lire soi-même. Pour préparer un brief ou une exploration.
---
# Context management

Transmettre en priorité :
- les fichiers et fonctions concernés (chemin:ligne plutôt que contenu, quand l'agent peut lire) ;
- les interfaces et types nécessaires ;
- les erreurs, logs et tests pertinents (extraits, pas des logs entiers) ;
- le `git diff` pour une review.

Ne jamais transmettre automatiquement : le dépôt complet, l'historique de conversation, les analyses précédentes entières, des fichiers sans rapport.

Ajouter du contexte progressivement : un agent qui manque d'information le signale, on complète alors. Préférer un pointeur (chemin, symbole) à une copie quand l'agent a accès aux fichiers.
