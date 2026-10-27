---
name: error-handling
description: Décider où et comment gérer une erreur. Quand du code touche I/O, réseau, entrées externes ou opérations qui peuvent échouer.
---
# Error handling

Gérer une erreur seulement si elle est plausible et que son traitement apporte quelque chose : récupération, message utile, nettoyage, contexte pour le diagnostic.

- Valider aux frontières (entrées utilisateur, réseau, fichiers, API externes), pas à chaque couche interne.
- Laisser remonter ce qu'on ne sait pas traiter ; ne jamais avaler une erreur silencieusement.
- Pas de `try/catch` systématique, de validations redondantes, de fallbacks qui masquent un bug.
- Suivre le mécanisme d'erreur existant du projet (types d'erreur, codes, logger).
- Message d'erreur : ce qui a échoué et avec quelle valeur, sans secret ni donnée sensible.
