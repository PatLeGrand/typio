---
name: dead-code
description: Retirer le code rendu inutile par la modification en cours. Après un changement significatif (remplacement, suppression de fonctionnalité).
---
# Dead code

Supprimer seulement ce que la modification en cours a rendu inutile :
- imports, variables, paramètres devenus inutilisés ;
- fonctions et types qui n'ont plus d'appelant ;
- anciennes branches, feature flags ou chemins de compatibilité remplacés ;
- tests du comportement supprimé.

Avant de supprimer un symbole, chercher ses usages dans tout le dépôt (y compris configs, templates, réflexion, exports publics).
Ne pas transformer cela en nettoyage général : le code mort préexistant se signale, il ne se supprime pas.
