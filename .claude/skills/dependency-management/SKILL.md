---
name: dependency-management
description: Décider s'il faut ajouter, mettre à jour ou retirer une dépendance. Avant toute modification du manifeste de paquets.
---
# Dependency management

Avant d'ajouter une dépendance, dans l'ordre :
1. le projet a-t-il déjà une solution (dépendance existante, utilitaire interne) ?
2. le langage, la plateforme ou le framework le fournissent-ils ?
3. une implémentation locale simple (quelques dizaines de lignes) suffit-elle ?
4. sinon, ajouter, en justifiant le choix en une ligne dans le compte rendu.

Critères pour retenir un paquet : maintenu, largement utilisé, licence compatible, peu de dépendances transitives.
Utiliser le gestionnaire de paquets du projet et mettre à jour le lockfile ; version cohérente avec les contraintes existantes.
Ne pas mettre à jour d'autres dépendances au passage.
