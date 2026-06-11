# Sous-projet E2 — Étagère réaliste (bois, variations, animations)

**Date :** 2026-06-11
**Statut :** Design validé (brainstorming utilisateur)
**Auteur :** Nicolas Rossel (avec Claude)

## Contexte

Le livre 3D est devenu réaliste (E1), mais l'étagère (niveaux 0/1) — le visage de
l'app — n'a pas bougé depuis la Phase 2 : tranches uniformes 26×120 px sur un simple
dégradé. E2 la transforme en **bibliothèque en bois crédible**.

## Décisions (issues du brainstorming)

1. **Bois réaliste, zéro asset** : veinage et planches générés en **CSS pur**
   (dégradés superposés) — cohérent avec l'approche du projet (rien à télécharger,
   hors-ligne par construction). Chaque rangée devient un **casier** : fond de
   caisson sombre en retrait (profondeur), **planche** en bois sous les livres avec
   chant éclairé et ombre portée.
2. **Variations physiques déterministes** : chaque livre tire de son titre+auteur
   (même graine que `couleurTranche`) une **hauteur** (~106–124 px), une **largeur**
   (~22–34 px) et, pour ~1 livre sur 7, une **inclinaison** (±4°, appuyé contre son
   voisin). Fonction **pure** `apparenceTranche(titre, auteur)` dans
   `shelf-logic.mjs` → testable node, stable d'un rendu à l'autre.
3. **Tranches améliorées** : reflet de courbure (dégradé clair→sombre par-dessus
   `--c`), ombre de contact sur la planche, coins très légèrement arrondis.
4. **Animations** :
   - **survol** : le livre se sort de l'étagère (translation verticale + ombre
     accentuée), composée avec l'inclinaison via variables CSS ;
   - **niveau 0 → 1** : apparition en fondu/zoom doux de la saga focalisée
     (~250 ms) au lieu du saut brutal. Inclinaison neutralisée en vue focalisée
     (lisibilité des titres).
5. **En-têtes** : nom d'auteur en petites capitales avec filet, façon étiquette de
   bibliothèque — discret, pas de fausse plaque.

## Composants & fichiers

| Fichier | Changement |
|---|---|
| `web/shelf-logic.mjs` | **+ `apparenceTranche(titre, auteur)`** (pure) → `{ hauteur, largeur, inclinaison }`. |
| `web/test_shelf_logic.mjs` | Tests : déterminisme, bornes, distribution de l'inclinaison (~1/7, ±4). |
| `web/app.js` | `construireEtagere` pose `--h`, `--l`, `--rot` sur chaque `.livre` ; expose `window.construireEtagere` (page d'essai). |
| `web/shelf.css` | Refonte niveaux 0/1 : casier, planche, tranches, survol, transition focus. |
| `web/dev_etagere.html` | **Nouveau.** Page d'essai : iframe `index.html`, masque le login, appelle `construireEtagere` avec une fausse collection (~25 livres, sagas variées). |
| `web/sw.js` | Bump `biblio-v9`. |

## Hors périmètre (E2)

- Texture bois en vraie image/canvas WebGL → non (CSS pur suffit).
- Réorganisation de l'information (groupement, tri) → inchangé.
- E3 (dos imprimé du livre 3D, 4e de couverture) → plus tard.

## Tests & critères de succès

- `apparenceTranche` verte en CI (node) ; aucun autre code logique touché.
- Vérification visuelle par captures headless (`dev_etagere.html` + `dev_cadre.html`)
  en desktop et 390 px ; itérations avec l'utilisateur.
- Au premier regard : une **bibliothèque**, pas des rectangles sur un dégradé.
- Recherche/filtres/navigation/RLS strictement inchangés.
