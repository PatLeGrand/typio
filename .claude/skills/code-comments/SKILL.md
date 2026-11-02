---
name: code-comments
description: Décider quand un commentaire de code est justifié. Quand on hésite à commenter ou qu'une revue porte sur les commentaires.
---
# Code comments

Le code doit s'expliquer par ses noms et sa structure. Un commentaire dit pourquoi, jamais ce que le code fait déjà.

Commenter :
- une décision non évidente et sa raison ;
- un workaround (avec la référence du problème contourné) ;
- une contrainte externe (API, format, réglementation) ;
- un comportement surprenant ou un edge case délicat ;
- une décision d'architecture importante, à l'endroit où elle s'applique.

Éviter : commentaires qui paraphrasent le code, ligne par ligne, docstrings automatiques sans information, code commenté, historique des modifications (git le garde).

Conserver les commentaires existants qui restent vrais ; corriger ceux que le changement rend faux.
