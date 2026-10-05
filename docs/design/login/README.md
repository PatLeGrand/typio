# Écran de connexion — référence Figma

- **Source :** fichier Figma `Typio-connection`, frame `6:472` « TapTap · Connexion », 1440 × 960
  (`https://www.figma.com/design/SqbF9bf8Tsqbd1J4zK1Yl0/Typio-connection?node-id=6-472`)
- **Extrait le :** 5 octobre 2026, par le connecteur Figma
- **Contenu de ce dossier :** [maquette.png](maquette.png) (rendu de référence) et `assets/`
  (icônes SVG et mascotte, téléchargées parce que les liens Figma expirent au bout de 7 jours)

Le fichier Figma ne définit **aucune variable** : les valeurs ci-dessous sont lues dans les
calques. Elles sont la première ébauche des tokens du futur skill `ui`.

## Palette (thème clair seulement : la maquette n'a pas de version sombre)

| Rôle proposé | Valeur | Où dans la maquette |
|---|---|---|
| `--background` | `#fffcf7` | Fond de page, blanc cassé chaud |
| `--surface` | `#ffffff` | Champs, boutons secondaires, cartes |
| `--foreground` | `#29233d` | Titres, libellés |
| `--muted` | `#777184` | Textes secondaires, indications |
| `--muted-strong` | `#65577e` | Textes du panneau violet |
| `--border` | `#dfdae7` | Bordures de champs, séparateurs |
| `--accent` | `#7043d9` | Bouton principal, liens, case cochée |
| `--accent-shadow` | `#5933b4` | Ombre « touche » sous le logo |
| `--accent-soft` | `#f6f1ff` | Badges, encart d'information |
| `--accent-panel` | `#ede5ff` | Panneau de la mascotte |
| `--key-yellow` | `#ffda70` | Touche « A », pastille minuteur |
| `--key-mint` | `#bce9da` | Touche « Z » |
| `--key-coral` | `#ff967d` | Touche « espace » |

## Typographie

Police **Inter**, avec les graisses 400, 500, 600, 700 et 800.

| Usage | Taille | Graisse | Interligne |
|---|---|---|---|
| Titre du panneau | 48 px | 800 | 1,08 |
| Titre du formulaire | 38 px | 700 | 1,15 |
| Marque « Typio » | 27 px | 800 | — |
| Texte d'introduction | 16 px | 400 | 1,55 |
| Bouton principal | 16 px | 700 | — |
| Saisie | 15 px | 400 | — |
| Libellé de champ | 14 px | 600 | — |
| Options, liens | 13 px | 400 et 600 | — |
| Badges (majuscules) | 11 px | 700 | — |
| Pied de page | 11 px | 400 | — |

## Formes et espacements

- **Arrondis :** 12 px pour les champs et les boutons, 10 px pour le logo et l'encart, 24 et 32 px
  pour les cartes du panneau, 100 px pour les badges en pilule.
- **Hauteurs :** 56 px pour les champs et le bouton principal, 52 px pour les boutons OAuth.
- **Formulaire :** 448 px de large, 28 px entre les blocs, 20 px entre les champs, 9 px entre
  un libellé et son champ.
- **Effet « touche de clavier » :** ombre pleine décalée vers le bas, sans flou
  (`0 4px 0 #5933b4` sous le logo, bordure basse épaisse sur les touches volantes). C'est la
  signature visuelle de la marque.
- **Ombre douce des cartes :** `0 8px 24px rgba(83, 53, 155, 0.05)`.

## Composition

Deux colonnes égales sur ordinateur :

1. **Gauche, connexion :** identité (logo touche, « Typio », signature), formulaire, pied de page.
2. **Droite, promesse :** badge, titre « Deviens le boss du clavier. », mascotte (poulpe au
   clavier avec touches volantes), carte de conseil, trois bénéfices.

## Écarts avec le cahier des charges et le code, à trancher

| # | Dans la maquette | Problème | Proposition |
|---|---|---|---|
| E-1 | Nom du frame « TapTap » | Le reste dit « Typio » | Garder **Typio** |
| E-2 | Identifiants en haut, GitHub/Discord en bas | **AUTH-1** : les identifiants s'affichent **en dernier**, avec mention « moins sécuritaire » | Inverser l'ordre et ajouter la mention |
| E-3 | « E-mail ou identifiant » | Le modèle de données ne stocke pas d'e-mail (public mineur, pas de récupération) | « Identifiant » |
| E-4 | « Mot de passe oublié ? » | **AUTH-6** : aucune récupération | Retirer, ou remplacer par un conseil qui ne promet rien |
| E-5 | Encart d'information vide (« Conseil école ») | Pas de texte | Texte à fournir |
| E-6 | Bouton Discord sans icône | GitHub en a une | Ajouter l'icône Discord |
| E-7 | Pas de version sombre | **UI-3** obligatoire | Dériver une palette sombre des mêmes teintes |
| E-8 | Pas de version mobile | **UI-4** obligatoire | Une seule colonne ; panneau de la mascotte réduit ou masqué |
| E-9 | Sélecteur de langue « FR » dans le pied de page, aucun choix de thème | Le header actuel porte les deux | Garder le sélecteur de langue dans le pied de page, ajouter le choix du thème à côté |
| E-10 | « Rester connecté » cochée | Compatible : session de 30 jours si cochée, cookie de session sinon | À garder |
| E-11 | Textes uniquement en français | **UI-5** | Traductions anglaises à rédiger |
| E-12 | GitHub et Discord | AUTH-2 et AUTH-3 sont « souhaitables », pas dans le checkpoint 1 | Boutons visibles mais désactivés, ou masqués, jusqu'à l'OAuth |
