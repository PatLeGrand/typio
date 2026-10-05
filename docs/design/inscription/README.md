# Écran d'inscription — référence Figma

- **Source :** fichier Figma `Typio-connection`, page « Inscription », frame `18:204`
  « Typio · Inscription », 1440 × 960
  (`https://www.figma.com/design/SqbF9bf8Tsqbd1J4zK1Yl0/Typio-connection?node-id=18-204`)
- **Extrait le :** 5 octobre 2026. Rendu de référence : [maquette.png](maquette.png)
- Même palette, typographie et composants que la connexion ([../login/README.md](../login/README.md)).
  Les icônes sont des Lucide, sauf GitHub (`../login/assets/github.svg`), que Lucide 1.x ne
  fournit plus.

## Différences avec la connexion

- **Formulaire :** pseudo, e-mail, mot de passe et confirmation côte à côte, règle du mot de
  passe, case de consentement, bouton « Créer mon compte », lien « Déjà un compte ? Connecte-toi ».
  Les champs font 52 px de haut, contre 56 px sur la connexion.
- **Panneau droit « Île dactylo » :** uniquement des formes CSS, sans image. Il se compose de :
  - une carte blanche ;
  - une île crème `#fff8e8` ;
  - une colline menthe pâle `#e8f7f0` ;
  - une montagne menthe `#bce9da` avec une étoile jaune ;
  - un chemin en 3 étapes ;
  - deux cartes « 10 min/jour » et « Récompenses ».
  Le titre, la carte de conseil et les bénéfices sont les mêmes que sur la connexion.
- **Nouvelles teintes :** `#fff8e8` (île) et `#e8f7f0` (colline). Elles deviennent des tokens,
  avec une variante sombre.

## Décisions (5 octobre 2026)

| # | Maquette | Décision |
|---|---|---|
| I-1 | Champ « Adresse e-mail » | **Retiré.** Public de 12 à 17 ans, minimisation des données, aucune récupération (AUTH-6) |
| I-2 | « Pseudo » | C'est l'**identifiant de connexion** (3 à 20 caractères, lettres, chiffres et `_`) |
| I-3 | Confirmation du mot de passe | Vérifiée **côté serveur** (`PASSWORD_MISMATCH`) |
| I-4 | « Au moins 8 caractères, avec une lettre et un chiffre » | Règle appliquée **côté serveur** à l'inscription |
| I-5 | Case « J'accepte les conditions… » | **Obligatoire**, vérifiée côté serveur (`TERMS_REQUIRED`). Les deux liens mènent à une page **Confidentialité** FR/EN, qui dit ce qui est stocké |
| I-6 | GitHub et Discord sous le formulaire | **AUTH-1**, comme pour la connexion : en premier, désactivés avec la mention « bientôt » |
| I-7 | Pied de page « Besoin d'aide ? » | Retiré tant qu'il n'existe pas de page d'aide |
