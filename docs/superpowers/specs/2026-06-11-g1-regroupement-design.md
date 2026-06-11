# Sous-projet G1 — Regroupement de l'étagère + champ genre

**Date :** 2026-06-11
**Statut :** Design validé (brainstorming utilisateur)
**Auteur :** Nicolas Rossel (avec Claude)

## Contexte

L'étagère est figée sur un seul regroupement (auteur → saga → tome). L'utilisateur veut
explorer sa collection sous d'autres angles : **genre, année, note, statut**. Décisions du
brainstorming : on **réorganise l'étagère** (pas de vue liste), et on **ajoute un champ
`genre`** au modèle (liste prédéfinie — pas de texte libre, pour des regroupements
cohérents ; saisie manuelle, les API ne fournissent pas de genre fiable).

## Objectif de G1

1. Un sélecteur **« Grouper par »** dans l'en-tête : **Auteur** (défaut, comportement
   actuel inchangé), **Genre**, **Année** (par décennie), **Note**, **Statut**. Choix
   **persisté** (`localStorage`). Les casiers en bois (E2) se réorganisent.
2. Champ **genre** : colonne SQL, sélecteur dans la modale (liste `GENRES`), validation
   client, première **migration versionnée** du dépôt (`supabase/migrations/`).

## Regroupements (logique pure, généralisation de `grouperLivres`)

`grouperLivres(livres, critere = 'auteur')` → `[{ nom, rangees: [{ nom, livres }] }]`
(la forme actuelle `{auteur, sagas}` est renommée — `construireEtagere` et les tests
suivent). Convention : une rangée nommée `'Aucune'` n'affiche pas de libellé et la vue
focalisée retombe sur le nom de section (comportement actuel conservé).

| Critère | Sections (`nom`) | Rangées | Tri interne |
|---|---|---|---|
| `auteur` | auteur (A→Z) | sagas (« Aucune » en dernier) | tome puis titre *(inchangé)* |
| `genre` | genre (A→Z, « Sans genre » dernier) | auteurs | saga, tome, titre |
| `annee` | décennie (« Années 1990 »…, « Sans année » dernier) | une rangée unique | année puis titre |
| `note` | « ★★★★★ » → « ★ », « Sans note » dernier | une rangée unique | auteur, titre |
| `statut` | À lire / En cours / Lu | une rangée unique | auteur, saga, tome |

## Genre

- `GENRES` (exportée, validée par `validerLivre`) : Fantasy, Science-fiction,
  Fantastique, Policier / Thriller, Historique, Classique, Roman, Biographie, Essai,
  BD / Manga, Jeunesse, Autre. Champ optionnel (vide = « Sans genre »).
- **Migration** `supabase/migrations/20260611120000_ajout_genre.sql` :
  `alter table public.books add column if not exists genre text;`
  (pas de contrainte DB : la liste est validée côté client et pourra évoluer sans
  migration). **Étape manuelle** : exécuter dans le SQL Editor du dashboard.
- Modale : sélecteur « Genre » (rangée avec Statut) ; D2 (scan) insère sans genre.

## Composants & fichiers

| Fichier | Changement |
|---|---|
| `supabase/migrations/20260611120000_ajout_genre.sql` | **Nouveau** (première migration versionnée). |
| `web/shelf-logic.mjs` | `grouperLivres(livres, critere)` généralisé ; `GENRES` ; `validerLivre` accepte/normalise `genre`. |
| `web/test_shelf_logic.mjs` | Tests : chaque critère (sections, ordre, « sans X » en dernier), rétro-compat `auteur`, validation genre. |
| `web/app.js` | Sélecteur persisté (`biblio:groupement`), re-rendu au changement ; `construireEtagere` consomme la nouvelle forme ; modale lit/écrit `f-genre`. |
| `web/index.html` | `select#regroupement` dans l'en-tête ; champ Genre dans la modale. |
| `web/shelf.css` | Style du sélecteur d'en-tête (aligné sur `#recherche`). |
| `web/dev_etagere.html` | Genres dans la fausse collection ; `?groupe=genre/annee/note/statut`. |
| `web/sw.js` | Bump `biblio-v10`. |

## Hors périmètre (G1)

- Vue liste à plat triable → non retenu.
- Genre automatique depuis les API → non (saisie manuelle).
- Filtre par genre dans les chips → possible plus tard (le regroupement couvre le besoin).
- Rétro-remplissage des genres des livres existants → à la main, via la modale.

## Tests & critères de succès

- Logique pure verte en CI (tous critères + rétro-compat + validation genre).
- Captures headless : étagère groupée par genre / année / note (dev_etagere).
- « Grouper par : Auteur » = rendu strictement identique à aujourd'hui.
- Le choix survit au rechargement ; recherche/filtres/focus/édition intacts.
