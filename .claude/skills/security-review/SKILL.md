---
name: security-review
description: Revue sécurité ciblée. Seulement si le changement touche auth, permissions, secrets, données sensibles, entrées utilisateur, API exposées, paiements, crypto ou frontières de confiance.
---
# Security review

Ne pas lancer pour une modification triviale ou sans surface d'attaque.

Vérifier, uniquement sur ce que le diff touche :
- autorisation appliquée côté serveur sur chaque chemin, pas seulement l'authentification ;
- entrées non fiables validées avant usage : injection SQL/commande, XSS, traversée de chemin, désérialisation, SSRF ;
- secrets : jamais en dur, dans les logs, les messages d'erreur ou le dépôt ;
- données sensibles : exposition minimale dans les réponses et les logs ;
- crypto : primitives de la plateforme, pas d'algorithme maison, comparaisons en temps constant pour les secrets ;
- paiements et opérations critiques : idempotence, montants recalculés côté serveur.

Chaque constat : chemin:ligne, scénario d'exploitation concret, correctif. Pas de liste générique de bonnes pratiques.
