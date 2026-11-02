---
name: token-budget
description: Classer une tâche (TINY/SMALL/MEDIUM/LARGE) et choisir pipeline, agent, effort et contexte au meilleur coût total d'exécution (qualité, tokens, quotas, latence, setup). Au début de toute tâche non triviale.
---
# Token & execution budget

Classer d'après le volume de code, le nombre de fichiers, le risque (sécurité, données, API publique) et l'incertitude. Reclasser dès que la tâche se révèle plus grosse ou plus petite.

| Classe | Exemples | Pipeline | QA | Review Gemini |
|---|---|---|---|---|
| TINY | typo, constante, import, renommage local | Luna → vérification | non | non |
| SMALL | bugfix localisé, petite fonction | Sol → vérification | non | non (`security-review` si zone sensible) |
| MEDIUM | feature ciblée, modification significative | (researcher) → Sol → vérification → review | non | oui, une fois, sur la feature complète |
| LARGE | volumineuse, multi-fichiers liés, complexe ou risquée | researcher → plan en lots → Sonnet par lot → vérification par lot → QA → review → corrections par Sonnet | oui, feature terminée | oui, une fois, sur la feature complète |

Frontière MEDIUM/LARGE : un petit patch très délicat va à Sonnet ; si Sol et Sonnet conviennent tous deux, trancher par les quotas.

Autres pipelines :
- Recherche nécessaire : researcher → résumé compact → développeur approprié.
- Échec : agent → compte rendu d'échec → orchestrateur → nouvelle décision.

Budget :
- Effort par défaut : medium pour Sol et Sonnet, high pour Gemini. Monter l'effort seulement après un échec ou une difficulté identifiée.
- LARGE : découper en lots vérifiables séparément, un agent par lot. Ne pas paralléliser des lots qui touchent les mêmes fichiers.
- Un agent de plus doit apporter une valeur que la vérification déterministe n'apporte pas.

## Coût d'exécution
Choisir l'agent au meilleur coût total attendu pour réussir, pas le modèle le moins cher. Un agent moins cher qui échoue coûte son essai plus la reprise.

Coût total = tokens estimés + quota consommé chez ce fournisseur + démarrage de l'agent + préparation de l'environnement (installation ou copie des dépendances) + builds, lint et tests + contexte à charger, le tout pondéré par la difficulté, le risque et le volume de code.

Coûts de démarrage mesurés (ordre de grandeur, à corriger d'après les en-têtes de `delegate.mjs`) :
| Agent | Démarrage fixe |
|---|---|
| Luna / Sol | ≈ 15 s et ≈ 55k tokens d'entrée par appel (en grande partie en cache) |
| Gemini | ≈ 30 s en effort low, davantage en high |
| researcher / sonnet-dev | contexte neuf : prompt, skills préchargés, relecture des fichiers |
| worktree isolé | installation des dépendances et build à froid : de quelques secondes à plusieurs minutes |

Règles :
- TINY : jamais de pipeline coûteux (worktree, Gemini, build complet) si sa préparation dépasse largement la modification. La règle « Opus n'implémente pas » reste absolue : l'économie vient de Luna, du regroupement et d'une vérification ciblée.
- Regrouper dans un seul brief plusieurs micro-tâches compatibles (mêmes fichiers ou même zone, sans dépendance d'ordre) plutôt que de payer plusieurs démarrages.
- MEDIUM/LARGE : un démarrage coûteux est acceptable s'il permet d'utiliser le meilleur agent.
- Travailler en place par défaut. Un worktree isolé seulement pour des lots parallèles ou un changement risqué à isoler.
- Réutiliser les dépendances, caches de paquets, builds incrémentaux et environnements déjà prêts quand c'est sûr. Invalider dès qu'un fichier dont ils dépendent change (lockfile, manifeste, config de build ou de test, version d'outil).
- Vérifier d'abord avec le contrôle déterministe le moins cher capable de valider correctement le changement (skill `verification`). Ne jamais sacrifier une vérification importante pour gagner quelques secondes ou tokens.
