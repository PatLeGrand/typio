---
name: performance
description: Optimiser les performances. Seulement en présence d'un problème mesuré, d'un chemin critique évident, d'une contrainte explicite ou d'un problème algorithmique significatif.
---
# Performance

Pas d'optimisation prématurée. Lisibilité et correction d'abord.

1. Mesurer ou identifier précisément le goulot (profilage, timing, requêtes, complexité).
2. Traiter d'abord les gains algorithmiques et les I/O : complexité quadratique, requêtes N+1, appels réseau en série, travail répété dans une boucle, absence de cache justifié.
3. Une optimisation à la fois, mesurée avant et après, avec les mêmes données.
4. Garder la plus simple qui atteint l'objectif ; abandonner si le gain n'est pas mesurable.

Pas de micro-optimisation qui dégrade la lisibilité sans gain démontré.
