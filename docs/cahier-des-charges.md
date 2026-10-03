> Source : `Cahier_des_charges_Web_V.docx` (Patrick Monkam). Copie de travail pour les agents ; le Word reste la référence.

Cahier des charges

Plateforme de courses de dactylographie multijoueur

Patrick Monkam

## 1. Vision du produit

Une plateforme web où les jeunes de 12 à 17 ans améliorent leur vitesse et leur précision au clavier en s'affrontant en temps réel. Inspirée de Kahoot, elle permet à n'importe quel utilisateur, enseignant ou élève, de lancer une course que les autres rejoignent en quelques secondes. Le produit doit être amusant et compétitif pour donner envie de pratiquer aussi le soir, seul ou contre des bots, tout en étant assez sérieux pour un usage en classe, avec des statistiques qui montrent une progression réelle.

## 2. Glossaire

| Terme | Définition |
|---|---|
| Course | Partie où tous les coureurs tapent le même texte en même temps. |
| Salle d'attente | Écran où les participants attendent avant le début de la course. |
| Hôte | Utilisateur qui a créé la course (ou à qui le rôle a été transféré). Il la configure, la lance et peut retirer des participants. |
| Participant | Toute personne présente dans une course : coureur ou spectateur. |
| Coureur | Participant qui tape. Peut être un humain ou un bot. |
| Spectateur | Participant qui regarde sans taper. |
| Membre | Utilisateur connecté (identifiants, Discord ou GitHub). Enseignants et élèves sont tous des membres, sans rôle distinct. |
| Invité | Utilisateur sans compte, identifié par un pseudo temporaire. Peut participer, mais pas créer de course. |
| Bot | Coureur contrôlé par le système, avec un niveau de difficulté. |
| Texte de course | Texte à taper, généré par algorithme selon la configuration. |
| Mode phrase / mode mots | Texte qui a du sens / suite de mots aléatoires. |
| MPM | Mots par minute. Un mot = 5 caractères (standard de l'industrie). |
| Précision | Pourcentage de caractères tapés correctement du premier coup. |
| Mode libre / mode bloquant | Libre : on continue malgré une erreur. Bloquant : il faut taper le bon caractère pour avancer. |
| Visibilité | Publique (listée, ouverte à tous), semi-publique (non listée, accès par code ou QR), privée (accès par lien d'invitation seulement). |
| Code de course | Code de 6 caractères pour rejoindre une course semi-publique. |
| Lien d'invitation | Lien à usage unique pour rejoindre une course privée. |
| Partie rapide | Bouton principal : place l'utilisateur dans une course publique en attente, ou en crée une. |
| Personnage | Avatar choisi par le coureur, qui possède une capacité unique. Débloqué avec la progression. |
| Capacité | Effet déclenché par un coureur en dépensant son énergie (ex. flouter les mots d'un adversaire). |
| Barre d'énergie | Jauge qui se remplit quand le coureur tape correctement. |
| Mécanique de rattrapage | Tout ce qui donne aux coureurs en retard une chance de rejoindre le premier. |
| AFK | Coureur inactif depuis le délai défini. |
| Heatmap | Clavier coloré selon le taux d'erreur par touche. |

## 3. Exigences

### Authentification (AUTH)

- AUTH-1 : Connexion par nom d'utilisateur et mot de passe (affichée en dernier, avec mention qu'elle est moins sécuritaire).

- AUTH-2 : Connexion via Discord (OAuth).

- AUTH-3 : Connexion via GitHub (OAuth).

- AUTH-4 : Accès en invité avec un pseudo, sans compte.

- AUTH-5 : Les mots de passe sont hachés (bcrypt ou argon2), jamais stockés en clair.

- AUTH-6 : Aucune récupération de mot de passe n'est requise.

### Création et accès aux courses (SALLE)

- SALLE-1 : Tout membre, enseignant ou élève, peut créer une course et en devient l'hôte.

- SALLE-2 : L'hôte choisit la visibilité : publique, semi-publique ou privée.

- SALLE-3 : Les courses publiques sont listées sur le site.

- SALLE-4 : Une course semi-publique est accessible par un code de course et par un code QR.

- SALLE-5 : Une course privée est accessible uniquement par lien d'invitation à usage unique.

- SALLE-6 : Un bouton « Partie rapide », mis en évidence, place l'utilisateur dans une course publique en attente, ou en crée une.

- SALLE-7 : Un participant rejoint comme coureur ou comme spectateur.

- SALLE-8 : Une course demande au moins 2 coureurs (un bot compte comme coureur).

- SALLE-9 : L'hôte peut retirer un participant.

- SALLE-10 : Les participants en salle d'attente voient en temps réel les changements de configuration faits par l'hôte.

- SALLE-11 : Les courses peuvent se jouer en équipes.

- SALLE-12 : Un invité peut rejoindre une course, mais ne peut pas en créer.

- SALLE-13 : Un hôte brièvement déconnecté reprend sa place et son rôle à son retour. Pendant son absence, personne d'autre ne peut lancer la course.

- SALLE-14 : L'hôte peut désigner un participant comme nouvel hôte avant de partir.

- SALLE-15 : Si l'hôte quitte sans désigner personne, le participant le plus ancien devient hôte.

### Configuration d'une course (CONFIG)

- CONFIG-1 : Type de texte : mode phrase ou mode mots.

- CONFIG-2 : Langue du texte : français ou anglais.

- CONFIG-3 : Option pour inclure des mots avec accents.

- CONFIG-4 : Longueur du texte.

- CONFIG-5 : Liste de caractères exclus du texte (blacklist).

- CONFIG-6 : Limite de temps optionnelle.

- CONFIG-7 : Mode libre ou mode bloquant.

- CONFIG-8 : Ajout de bots avec niveau de difficulté.

- CONFIG-9 : Activation ou non des capacités.

### Génération de texte (TEXTE)

- TEXTE-1 : Les textes sont générés par algorithme, pas codés en dur.

- TEXTE-2 : Le texte respecte la langue, la longueur, les accents et la blacklist configurés.

- TEXTE-3 : Tous les coureurs d'une course reçoivent le même texte de base.

### Déroulement d'une course (COURSE)

- COURSE-1 : Tous les coureurs commencent en même temps, après un compte à rebours.

- COURSE-2 : Le classement de tous les coureurs est affiché et mis à jour en temps réel sur chaque écran.

- COURSE-3 : La course se termine quand tous les coureurs actifs ont fini ou quand la limite de temps est atteinte.

- COURSE-4 : Un coureur déconnecté qui revient reprend là où il était.

- COURSE-5 : Un coureur peut abandonner volontairement.

- COURSE-6 : Un coureur inactif pendant le délai AFK est retiré du classement actif.

- COURSE-7 : Le copier-coller est bloqué dans la zone de saisie.

- COURSE-8 : La progression est validée côté serveur (une vitesse humainement impossible est rejetée).

### Bots (BOT)

- BOT-1 : Plusieurs niveaux de difficulté.

- BOT-2 : Les bots imitent un humain (vitesse variable, erreurs, pauses), sauf au niveau le plus difficile.

- BOT-3 : Un élève seul peut lancer une course contre des bots.

### Personnages et capacités (CAPA)

- CAPA-1 : Chaque coureur choisit un personnage avant la course.

- CAPA-2 : Chaque personnage possède une capacité unique (ex. ajouter des mots au premier, flouter les mots d'un adversaire).

- CAPA-3 : La barre d'énergie se remplit uniquement en tapant correctement, au même rythme pour tous.

- CAPA-4 : Une capacité ne s'utilise que si la barre contient assez d'énergie.

- CAPA-5 : Les coureurs en retard disposent d'une mécanique de rattrapage.

- CAPA-6 : Les personnages se débloquent avec la progression du joueur.

### Résultats (RES)

- RES-1 : Page de résultats avec podium.

- RES-2 : Statistiques de chaque coureur : MPM, précision, temps, rang.

- RES-3 : Heatmap des touches les plus ratées.

- RES-4 : L'hôte peut relancer une course avec les mêmes participants ou mettre fin à la session.

### Statistiques et progression (STATS)

- STATS-1 : Page de statistiques personnelles.

- STATS-2 : Historique des courses.

- STATS-3 : Graphique de progression (MPM et précision dans le temps).

- STATS-4 : Heatmap cumulative des erreurs.

### Interface (UI)

- UI-1 : Nom et logo du produit.

- UI-2 : Style professionnel et ludique, adapté aux 12-17 ans.

- UI-3 : Thème clair et sombre.

- UI-4 : Site responsive (ordinateur, tablette, mobile).

- UI-5 : Interface disponible en français et en anglais.

### Technique (TECH)

- TECH-1 : Next.js (React) avec TypeScript.

- TECH-2 : Tailwind CSS.

- TECH-3 : Base de données PostgreSQL.

- TECH-4 : Communication en temps réel par WebSockets.

- TECH-5 : HTTPS obligatoire.

- TECH-6 : Services gratuits ou à palier gratuit autant que possible.

### Qualité et documentation (QA)

- QA-1 : Tests unitaires.

- QA-2 : Tests de bout en bout (E2E).

- QA-3 : Code source public sur GitHub.

- QA-4 : Documentation publique qui explique les choix techniques.

## 4. Contradictions et zones floues

- C-1, rôle de l'enseignant : Le modèle Kahoot suggère que l'enseignant crée la course, mais les élèves peuvent aussi en créer. RÉSOLUE (client, 25/09) : aucun rôle distinct, tout le monde peut être hôte.

- C-2, âge et OAuth : Le public commence à 12 ans, mais Discord et GitHub exigent 13 ans minimum.

- C-3, invités et statistiques : « Tout le monde devrait avoir des stats », mais un invité n'a pas de compte pour les conserver.

- C-4, minimum de 2 personnes : Une course exige 2 personnes, mais un élève seul doit pouvoir jouer contre des bots.

- C-5, « 3 manières de rejoindre » : Le client en annonce 3 (publique, code, lien), mais la partie rapide et le code QR en ajoutent.

- C-6, lien qui expire après ouverture : Un lien à usage unique oblige l'hôte à générer un lien par invité. Durée de validité laissée à notre choix (client, 27/09).

- C-7, rattrapage et progression : Les effets qui ajoutent ou retirent des mots faussent les MPM et les statistiques de progression.

- C-8, classement avec textes inégaux : Si les capacités changent la longueur des textes, le classement ne peut pas se baser sur le nombre de mots.

- C-9, reconnexion et AFK : Un joueur déconnecté doit pouvoir revenir, mais le délai AFK le retire. La durée n'est pas précisée.

- C-10, texte « qui a du sens » gratuit : Générer des phrases cohérentes demande un modèle de langue (souvent payant) ou une banque de phrases.

- C-11, blacklist et mode phrase : Retirer des caractères d'un texte qui a du sens le rend illisible.

- C-12, fin de course sans limite : Sans limite de temps, la fin de la course dépend du délai AFK.

- C-13, équipes : Formation des équipes et calcul du score d'équipe non précisés.

- C-14, tablette : Le clavier virtuel permet la saisie automatique, ce qui entre en conflit avec l'anti-triche.

- C-15, heatmap et clavier : Au Québec, les élèves utilisent QWERTY, AZERTY ou le clavier canadien multilingue.

- C-16, WebSockets gratuits : Vercel, l'hébergeur habituel de Next.js, ne supporte pas les WebSockets persistants.

- C-17, brouillage des mots : Le flou peut nuire à l'accessibilité (troubles visuels, dyslexie).

- C-18, « professionnel et funny » : Deux directions visuelles qui peuvent s'opposer.

- C-19, talent contre rattrapage : Le client accepte que le talent soit la seule métrique de victoire (énergie gagnée en tapant correctement), mais veut que les joueurs en difficulté puissent rattraper le gagnant. Il refuse aussi que l'énergie se remplisse plus vite pour les derniers (Q-7).

- C-20, hôte déconnecté : La durée d'une déconnexion « brève » de l'hôte n'est pas définie.

## 5. Questions au client

Ce ne sont pas mes questions personnelles, je les ai prit depuis le channel discord

- Q-1 (C-1) : Voulez-vous un rôle Enseignant distinct ?  Réponse : Non, tous les utilisateurs peuvent être hôte (25/09).

- Q-2 (C-6) : Combien de temps un lien privé reste-t-il valide ?  Réponse : À nous de décider (25/09).

- Q-3 : Un invité peut-il créer une course ?  Réponse : Non, il peut seulement participer (25/09).

- Q-4 : Si l'hôte se déconnecte, la course s'arrête-t-elle ou le rôle est-il transféré ?  Réponse : Courte déconnexion : il revient. S'il quitte : le plus ancien participant, ou celui qu'il désigne, devient hôte (25/09).

- Q-5 : Peut-on remplacer les bonus aléatoires par des personnages avec capacités et barre d'énergie ?  Réponse : Oui, mais les joueurs en difficulté doivent pouvoir rattraper le gagnant (26/09).

- Q-6 : Course semi-publique : code seulement ou aussi code QR ? Format du code ?  Réponse : Code, et QR serait bien. Format à nous de décider. Course privée : lien seulement (27/09).

- Q-7 (C-19) : L'énergie peut-elle se remplir plus vite pour les coureurs en retard ?  Réponse : Non.

- Q-8 : Les personnages sont-ils débloqués avec la progression ?  Réponse : Oui.

- Q-9 (C-20) : Pendant la déconnexion de l'hôte, quelqu'un d'autre peut-il lancer la course ?  Réponse : Non.

## 6. Hypothèses

- H-1 : Le client n'a pas précisé comment gérer les moins de 13 ans. Je suppose que Discord et GitHub restent offerts et que les élèves de 12 ans utilisent le compte identifiant/mot de passe ou le mode invité, parce que les conditions de ces plateformes relèvent de l'utilisateur.

- H-2 : Le client n'a pas précisé la persistance des stats d'un invité. Je suppose qu'elles existent pendant la session seulement, parce qu'un invité n'a pas d'identité durable.

- H-3 : Le client n'a pas précisé si un bot compte comme coureur. Je suppose que oui, parce que les bots sont prévus pour l'élève seul.

- H-4 : Le client laisse la validité des liens à notre choix. Je suppose que chaque lien est à usage unique et expire après 24 h ou au début de la course, parce que ça respecte « expire après ouverture » sans laisser traîner de liens.

- H-5 : Le client laisse le format du code à notre choix. Je suppose 6 caractères alphanumériques majuscules sans les caractères ambigus (0, O, 1, I, L), parce qu'ils se dictent facilement en classe et offrent plus d'un milliard de combinaisons.

- H-6 : Le client ne dit pas si la course privée a un code QR. Je suppose que non, parce qu'il précise « seulement par le lien d'invitation » et qu'un QR affiché serait partageable par tous.

- H-7 : Le client n'a pas précisé l'effet des capacités sur les stats. Je suppose que les courses avec capacités sont exclues du graphique de progression, parce que les MPM y sont faussés.

- H-8 : Le client n'a pas précisé la base du classement. Je suppose le pourcentage du texte complété, parce que c'est la seule mesure juste quand les textes n'ont pas la même longueur.

- H-9 : Le client n'a pas précisé les délais. Je suppose 60 s pour la reconnexion (joueur ou hôte), 30 s pour l'AFK et 5 min de limite par défaut, parce qu'une course ne doit jamais rester bloquée.

- H-10 : Le client n'a pas précisé l'algorithme. Je suppose une banque de phrases du domaine public assemblées et filtrées pour le mode phrase, et un dictionnaire de fréquence pour le mode mots, parce que c'est gratuit et fiable.

- H-11 : Le client n'a pas précisé la blacklist en mode phrase. Je suppose que l'algorithme exclut les phrases contenant un caractère interdit plutôt que de retirer le caractère, parce que le texte reste lisible.

- H-12 : Le client n'a pas tranché pour la tablette. Je suppose qu'elle est permise seulement avec un clavier physique, parce que le clavier virtuel permet la saisie automatique.

- H-13 : Le client n'a pas précisé l'hébergement. Je suppose Next.js sur Vercel, un serveur Socket.IO sur un hébergeur gratuit (ex. Render) et PostgreSQL gratuit (ex. Neon ou Supabase), parce que Vercel ne supporte pas les WebSockets persistants.

- H-14 : Le client n'a pas précisé la disposition du clavier. Je suppose que l'utilisateur la choisit dans son profil (QWERTY, AZERTY, canadien multilingue), parce que c'est nécessaire à une heatmap juste.

- H-15 : Le client n'a pas mentionné de clavardage. Je suppose qu'il n'y en a pas, parce que modérer un chat entre mineurs dépasse la portée du projet.

- H-16 : Le client n'a pas précisé de maximum. Je suppose 20 coureurs par course, parce que c'est une taille de classe typique et que le classement reste lisible.

- H-17 : Le client refuse une énergie plus rapide pour les derniers, mais veut du rattrapage. Je suppose que l'énergie se gagne au même rythme pour tous et que le rattrapage vient des capacités elles-mêmes : certaines ciblent seulement le premier, et d'autres ne sont utilisables que par la moitié la plus lente, parce que la victoire reste méritée par la précision tout en laissant une chance aux derniers.

- H-18 : Le client veut des personnages débloqués par la progression sans préciser comment. Je suppose un déblocage selon le nombre de courses terminées et un personnage de base offert à tous, parce que ça récompense la pratique. Les invités n'ont accès qu'au personnage de base.

## 7. Priorisation

| Priorité | Exigences |
|---|---|
| Essentiel | AUTH-1, AUTH-4, AUTH-5 · SALLE-1 à 4, SALLE-7, SALLE-8, SALLE-12 à 15 · CONFIG-1, 2, 4 · TEXTE-1 à 3 · COURSE-1 à 3, COURSE-7, COURSE-8 · RES-1, RES-2 · UI-4, UI-5 · TECH-1 à 5 · QA-3 |
| Souhaitable | AUTH-2, AUTH-3 · SALLE-5, 6, 9, 10 · code QR (SALLE-4) · CONFIG-3, CONFIG-5 à 8 · COURSE-4 à 6 · BOT-1 à 3 · RES-4 · STATS-1 à 3 · UI-1 à 3 · TECH-6 · QA-1, QA-2, QA-4 |
| Moins prioritaire | SALLE-11 (équipes) · CONFIG-9, CAPA-1 à 6 · RES-3, STATS-4 (heatmaps) · AUTH-6 |
