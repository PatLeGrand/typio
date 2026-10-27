---
name: refactoring
description: Refactoriser seulement avec une raison concrète liée à la tâche. Quand un refactoring est demandé ou bloque la tâche.
---
# Refactoring

Aucun refactoring opportuniste. Raisons acceptables :
- duplication significative que la tâche aggraverait ;
- complexité qui empêche réellement d'implémenter la tâche correctement ;
- blocage architectural ;
- dette technique directement dans le chemin de la tâche.

Règles :
- comportement inchangé, vérifié avant et après par les mêmes tests ;
- refactoring et changement fonctionnel dans des étapes (idéalement des commits) séparées ;
- la plus petite transformation qui lève le blocage ; une petite feature ne devient pas une réécriture.

Si le refactoring utile dépasse la tâche, le proposer dans le compte rendu au lieu de le faire.
