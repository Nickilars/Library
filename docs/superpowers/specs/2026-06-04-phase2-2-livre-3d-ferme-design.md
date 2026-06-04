# Phase 2.2 — Détail du livre : livre 3D fermé + infos à côté

**Date :** 2026-06-04
**Statut :** Design validé, prêt pour planification
**Auteur :** Nicolas Rossel (avec Claude)

## Contexte

La Phase 2.1 a introduit une navigation à 3 niveaux dans l'étagère web (lecture seule).
Le **niveau 2** affichait alors un « livre qui s'ouvre » animé en CSS (couverture →
pages → infos). Après essais, l'animation de pages qui tournent s'est révélée trop
fragile à régler pour un rendu satisfaisant. On **remplace** donc le niveau 2 par
quelque chose de plus simple, net et fiable : un **livre 3D fermé** (Three.js) montrant
la **vraie couverture**, avec les **infos affichées à côté**.

Ce raffinement est **front-end uniquement** : base de données, routes et `database.py`
ne changent pas. Les niveaux 0 (étagère) et 1 (vue focalisée) ne changent pas non plus.

> Note : l'idée d'un livre 3D *qui s'ouvre avec pages qui tournent* est **abandonnée**
> (hors périmètre, non planifiée). On garde le livre **fermé**.

## Objectif

Au clic sur un livre (niveau 2), afficher en superposition :
- à gauche, le **livre en 3D fermé** (couverture réelle, tranches/pages, reliure,
  épaisseur), avec un **léger balancement** au repos et **rotation au glisser** ;
- à droite, une **carte d'infos** (titre, auteur, année, saga · tome, statut, possédé,
  note, commentaire, bouton ✏️ désactivé).

Sur mobile (écran étroit), livre et infos s'**empilent verticalement**.

## Décisions (issues du brainstorming + démos)

- **Three.js**, **vendoré en local** (`static/vendor/three.module.js`, version épinglée) —
  hors-ligne / PWA-friendly, aucune requête externe pour la bibliothèque.
- **Livre fermé** modélisé procéduralement : une boîte (BoxGeometry) avec faces
  distinctes — couverture (face avant), 4e de couverture (face arrière), reliure (dos),
  tranches « pages » (texture de fines lignes) sur les trois chants.
- **Couverture** : texture chargée depuis Open Library par ISBN
  (`https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg`, `crossOrigin = "anonymous"`).
  En cas d'absence/échec/CORS → **couverture générée** (dégradé + titre dessinés sur un
  canvas). *(Si le CORS d'Open Library posait problème à l'usage, une route serveur de
  proxy d'image pourrait être ajoutée plus tard — hors périmètre ici.)*
- **Infos en HTML à côté** (pas dans la 3D) : texte net, sélectionnable, accessible, et
  injecté via `textContent` (SEC-W1). 
- **Rotation** : balancement automatique doux au repos ; **glisser** (souris/tactile)
  pour tourner le livre.
- **Repli sans WebGL** : si WebGL est indisponible, on affiche la couverture en **image
  2D** (`<img>` Open Library, `referrerpolicy="no-referrer"`, repli couleur générée) à la
  place du canvas 3D ; la carte d'infos est identique.
- **Fermeture** : clic en dehors de la zone (livre + infos) referme la superposition.

## Architecture

```
shelf.js  (niveau 2 : choisirLivre/ouvrirLivre)
   │  construit l'overlay #livre-ouvert : [ zone visuelle ] + [ carte d'infos HTML ]
   │  WebGL dispo ? → import dynamique de book3d.js → rend le livre 3D dans un <canvas>
   │              sinon → <img> couverture 2D (repli)
   ▼
static/book3d.js   (moteur 3D isolé : scène, caméra, lumières, livre, textures, sway+drag)
static/vendor/three.module.js   (Three.js vendoré, version figée)
```

### Fichiers

| Fichier | Changement |
|---|---|
| `static/vendor/three.module.js` | **Créer** — Three.js vendoré (version épinglée) |
| `static/book3d.js` | **Créer** — module ES : `webglDisponible()`, `creerVisionneuse(canvas)` (scène/renderer persistants), `montrerLivre(donnees)` (texture couverture + repli), `detruire()`. Gère balancement + glisser. |
| `static/shelf.js` | **Modifier** — `ouvrirLivre` construit l'overlay (zone visuelle + carte infos) ; choisit 3D (lazy import de book3d.js) ou repli 2D ; ferme au clic extérieur. Retirer l'ancien code du livre CSS animé. |
| `static/shelf.css` | **Modifier** — retirer les styles de l'ancien livre animé (`.livre3d/.spread/.feuille/.couverture`…) ; ajouter la mise en page overlay (zone livre + carte infos, responsive) et le style de la carte. Niveaux 0 et 1 inchangés. |
| `templates/base.html`, `templates/_shelf.html`, `webapp.py`, `shelf.py`, `database.py` | **Inchangés** (l'overlay `#livre-ouvert` existe déjà ; les `data-*` portent les infos). |

### Le livre 3D (`book3d.js`)

- **Visionneuse persistante** : un seul `WebGLRenderer` + `Scene` + `PerspectiveCamera`
  créés une fois (paresseusement), réutilisés à chaque ouverture. À la fermeture, on
  **arrête la boucle d'animation** et on masque le canvas ; on ne recrée pas de contexte
  WebGL à chaque ouverture (les navigateurs limitent le nombre de contextes). `detruire()`
  libère les ressources si jamais nécessaire.
- **Géométrie** : `BoxGeometry(largeur, hauteur, épaisseur)` épaisse, 6 matériaux :
  couverture (avant), 4e de couv (arrière), reliure (dos), tranches « pages » (3 chants).
- **Lumières** : ambiante + une directionnelle clé + une de remplissage (rendu chaleureux,
  modéré pour rester fluide sur mobile).
- **Interaction** : balancement sinusoïdal léger au repos ; `pointerdown/move/up` pour
  tourner (inertie simple par interpolation vers une cible).
- **Couverture** : `TextureLoader` (crossOrigin anonymous) ; `onError` → texture générée.

## Sécurité

- **SEC-W1** — Les infos (titre, auteur, commentaire…) sont injectées via `textContent`
  dans la carte HTML ; aucune insertion via `innerHTML` de données du livre.
- **SEC-W4** — Repli 2D : `<img referrerpolicy="no-referrer">`. Texture 3D : `crossOrigin`
  anonymous (pas de cookies/référent). Pas de requête externe pour Three.js (vendoré).
- **Lecture seule** conservée : aucun changement serveur, aucune route d'écriture, le
  bouton ✏️ reste désactivé.
- `library.db` toujours git-ignoré ; pas de secret en dur.

## Performance

- `book3d.js` et Three.js sont chargés **paresseusement au premier clic** sur un livre
  (pas au chargement de la page).
- Visionneuse réutilisée entre ouvertures ; boucle d'animation arrêtée à la fermeture
  (pas de rendu en tâche de fond quand l'overlay est fermé).

## Tests

Front-end interactif → vérification **manuelle** (checklist navigateur). Les suites
serveur existantes restent vertes (aucun changement serveur) — à confirmer.

- **Non-régression serveur** : `test_webapp.py` et `test_shelf.py` toujours `OK`.
- **Checklist navigateur** :
  1. Niveaux 0 et 1 inchangés (étagère sans titres → vue focalisée).
  2. Clic sur un livre → overlay : livre 3D fermé à gauche (couverture réelle si ISBN
     connu, sinon couverture générée), carte d'infos à droite.
  3. Le livre se balance doucement ; le glisser le fait tourner.
  4. Clic en dehors → fermeture ; réouvrir un autre livre fonctionne (pas de fuite de
     contexte WebGL, la visionneuse est réutilisée).
  5. Repli : en simulant l'absence de WebGL, la couverture 2D + la carte s'affichent.
  6. Sur écran étroit (mobile), livre et infos s'empilent.
  7. `/wishlist` se comporte de la même façon.
- Le fichier `static/vendor/three.module.js` est servi (HTTP 200).

## Hors périmètre

- **Animation de pages qui tournent / livre qui s'ouvre** — abandonnée.
- Étagère/arrière-plan réalistes (texture bois, profondeur) — évolution future notée.
- Écriture web, authentification, exposition internet — Phases 3+.
- Route serveur de proxy d'images de couverture — éventuelle, plus tard, seulement si le
  CORS d'Open Library s'avère problématique.

## Critères de succès

- Au clic sur un livre, un **livre 3D fermé** (couverture réelle + épaisseur) s'affiche
  avec sa **carte d'infos à côté** ; balancement + glisser fonctionnels.
- Repli 2D propre si WebGL indisponible ; couverture générée si l'image manque.
- Ouvrir/fermer/rouvrir plusieurs livres reste fluide (visionneuse réutilisée).
- L'ancien livre CSS animé est retiré ; niveaux 0 et 1 intacts.
- Tests serveur toujours verts ; checklist navigateur validée.
