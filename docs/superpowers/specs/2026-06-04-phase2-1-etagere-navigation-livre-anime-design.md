# Phase 2.1 — Raffinement de l'étagère : navigation à 3 niveaux et livre animé

**Date :** 2026-06-04
**Statut :** Design validé, prêt pour planification
**Auteur :** Nicolas Rossel (avec Claude)

## Contexte

La Phase 2 a livré une application web de consultation en lecture seule : une étagère
de tranches groupées auteur → saga → tome, avec recherche, filtres, vue wishlist et une
API JSON. Après test visuel, l'utilisateur veut **revoir l'interaction** de l'étagère.

Ce raffinement est **purement front-end** : il ne touche ni la base de données, ni les
routes, ni la couche `database.py`. Il modifie l'expérience de navigation dans
`static/shelf.js` et `static/shelf.css`, et retire le panneau latéral des templates.

## Problèmes adressés

1. **Titres trop longs sur les tranches** en vue de base : peu esthétiques. → Masquer les
   titres au niveau de base ; ne les montrer qu'une fois « zoomé ».
2. **Sélection directe d'un livre** trop abrupte. → Navigation en deux temps : d'abord la
   saga, puis le livre.
3. **Panneau latéral d'infos** peu immersif. → Remplacé par un livre qui s'ouvre et
   affiche ses infos sur ses pages.

## Modèle d'interaction à 3 niveaux

L'étagère devient une machine à états à trois niveaux ; chaque transition est explicite.

### Niveau 0 — Étagère (vue de base)

- Tous les groupes auteur → saga → tome, livres en **tranches debout**.
- **Les titres des tranches sont masqués** (les longs titres ne dépassent plus). Le texte
  reste dans le DOM, simplement caché en CSS.
- **Recherche et filtres** (statut) agissent à ce niveau, comme en Phase 2 (ils
  masquent/affichent les tranches ; les sagas/auteurs vidés sont cachés).
- **Action :** cliquer sur un **groupe de saga** fait passer au niveau 1. L'unité
  focalisable est le groupe de saga tel que produit par `grouper_livres` : une saga
  nommée, ou le groupe « Aucune » qui rassemble les livres sans saga d'un auteur (ce
  dernier joue le rôle de « focaliser sur l'auteur » pour ses livres isolés). Chaque
  groupe est déjà cliquable via son en-tête dans `_shelf.html`.

### Niveau 1 — Vue focalisée

- **Seul** le groupe de saga choisi est affiché, **agrandi et centré** ; le reste de
  l'étagère n'est plus visible.
- **Au-dessus des livres :** l'en-tête du groupe (nom de la saga, ou « <Auteur> » pour le
  groupe « Aucune ») et un bouton **« ← Retour »**.
- Les **titres complets** sont visibles sur les tranches agrandies.
- **Actions :** cliquer sur un **livre** → niveau 2 ; « Retour » → niveau 0.

### Niveau 2 — Livre ouvert (séquence animée)

Au clic sur un livre, une **superposition centrée** (overlay) joue cette séquence :

1. **Couverture** affichée (livre fermé) pendant **~2 secondes** — image Open Library par
   ISBN, ou couverture générée (couleur + titre) en repli.
2. Le livre **s'ouvre** (animation CSS 3D, `rotateY`).
3. Les **pages défilent** (plusieurs tournes de page successives, « comme si on cherchait
   une page »).
4. On **s'arrête sur la page d'infos** : **deux pages de papier** affichant les infos du
   livre — **la couverture n'est plus visible**. Répartition : page gauche = titre,
   auteur, année, saga · tome ; page droite = statut, possédé, note ★, commentaire, et le
   bouton **✏️ désactivé** (placeholder Phase 3).

**Raccourci :** un clic **pendant** l'animation saute directement à l'étape 4 (page
d'infos).

**Fermeture :** un clic **en dehors** du livre referme l'overlay et revient au niveau 1.

## Détails visuels

- **Tranches :** le `<span class="tranche-titre">` reste dans le DOM ; il est masqué au
  niveau 0 et affiché au niveau 1 via des classes CSS d'état. Couleur de tranche
  inchangée (helper `couleur_tranche`).
- **Livre ouvert :** overlay plein écran semi-opaque (pour capter le clic « en dehors »),
  livre centré. Pages de papier en tons crème, infos en texte sombre lisible. La
  couverture (étapes 1–2) utilise l'image Open Library avec repli généré.
- **Sécurité du rendu :** toutes les infos injectées dans les pages le sont via
  `textContent` / construction DOM (jamais `innerHTML` avec une valeur de livre), comme
  le correctif SEC-W1 de la Phase 2.

## Périmètre des changements (code)

| Fichier | Changement |
|---|---|
| `static/shelf.js` | Réécrit : machine à états 3 niveaux + séquence d'ouverture animée (timing, skip au clic, fermeture au clic extérieur). Remplace l'ancien panneau latéral. |
| `static/shelf.css` | Styles des 3 niveaux : tranches sans titre (niv. 0), vue focalisée (niv. 1) avec en-tête saga + retour, overlay et animation du livre ouvert (niv. 2). |
| `templates/base.html` | Retrait de l'`<aside id="panneau">` (remplacé par l'overlay du livre ouvert, créé/géré côté JS). Conserver l'en-tête (recherche, filtres) et les conteneurs de l'étagère. |
| `templates/_shelf.html` | **Inchangé** : conserve les attributs `data-*` (le livre ouvert lit les infos depuis ces données). |
| `webapp.py`, `shelf.py`, `database.py` | **Inchangés.** |

## Hors périmètre

- Rendu réaliste de l'étagère / arrière-plan (texture bois, profondeur) — reste une
  évolution future notée en Phase 2.
- Toute écriture depuis le web, l'authentification, l'exposition internet — Phases 3+.
- Le bouton ✏️ reste **désactivé** (édition = Phase 3).

## Tests

Ce raffinement est de l'**interaction client (JS/CSS)** : il n'est pas couvert par des
tests unitaires (conformément à la convention du projet pour le front).

- **Non-régression serveur :** les suites existantes doivent rester vertes —
  `test_webapp.py` (le HTML rendu contient toujours les titres dans `data-*` et le span ;
  l'échappement SEC-W1 est inchangé) et `test_shelf.py`. À vérifier après les changements.
- **Vérification manuelle (checklist navigateur) :**
  1. Niveau 0 : les tranches n'affichent pas de titre ; recherche et filtres fonctionnent.
  2. Clic sur une saga → vue focalisée : seule cette saga, nom + bouton « Retour » au-dessus,
     titres complets visibles. « Retour » ramène à l'étagère.
  3. Clic sur un auteur sans saga → même vue focalisée sur ses livres.
  4. Clic sur un livre → couverture ~2 s, ouverture, pages qui défilent, puis page d'infos
     **sans couverture**.
  5. Un clic pendant l'animation saute aux infos.
  6. Un clic en dehors du livre referme et revient à la vue focalisée.
  7. La vue `/wishlist` se comporte de la même façon.

## Critères de succès

- Vue de base sans titres sur les tranches ; titres visibles uniquement en vue focalisée.
- Navigation 0 → 1 → 2 et retours fonctionnels (saga/auteur → livre → infos → retour).
- Séquence d'ouverture du livre conforme (couverture → ouverture → pages → infos sans
  couverture), avec raccourci au clic et fermeture au clic extérieur.
- Panneau latéral de la Phase 2 retiré.
- Tests serveur existants toujours verts ; checklist navigateur validée.
