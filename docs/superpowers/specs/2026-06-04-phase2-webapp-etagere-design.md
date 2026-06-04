# Phase 2 — Application web : étagère de consultation

**Date :** 2026-06-04
**Statut :** Design validé, prêt pour planification
**Auteur :** Nicolas Rossel (avec Claude)

## Contexte

La Phase 1 a migré le gestionnaire de bibliothèque vers SQLite, avec une couche
d'accès `database.py` isolée et testée. La Phase 2 ajoute une **interface web de
consultation** par-dessus cette même base, sans rien changer à la console ni à la
couche de données.

Vision long terme (rappel) : FastAPI + SQLite + PWA, accessible depuis le téléphone.
Phases : 1 Fondations *(fait)* → **2 Web (consultation)** *(ce document)* → 3 Auth →
4 Hébergement + PWA installable → 5 Scan mobile.

## Objectif de la Phase 2

Offrir une **consultation visuelle, en lecture seule**, de la collection : une
« étagère » où les livres sont des tranches debout, groupés par auteur puis par saga,
qu'on déplie et explore. Plus recherche, filtres et une vue wishlist dédiée.

**Hors périmètre (reporté) :** toute écriture depuis le web (ajout / modification /
suppression), l'authentification, l'exposition internet, la PWA installable, les
statistiques. L'écriture reste dans la console jusqu'à la Phase 3.

## Décisions clés (issues du brainstorming)

- **Lecture seule.** Le web ne modifie jamais la base en Phase 2. Le bouton ✏️ du
  panneau d'infos est affiché mais inactif (placeholder Phase 3).
- **Concept « étagère ».** Tranches debout, groupées **auteur → saga → tome**. Cliquer
  une saga déplie ses tranches ; cliquer un livre le fait **pivoter de face** pendant
  que ses voisins s'écartent ; ses infos s'affichent dans un panneau à côté.
- **Hôte configurable.** Défaut `127.0.0.1` ; peut écouter sur le LAN (`0.0.0.0`) pour
  un accès depuis un autre ordinateur de la maison. L'exposition internet est reportée
  (exige auth en Phase 3, HTTPS en Phase 4).
- **API JSON en plus du HTML.** Le serveur expose des routes JSON en lecture seule, en
  parallèle des pages HTML, pour garder la porte ouverte à une future app native. La
  cible Android privilégiée reste la **PWA** (Phase 4), qui réutilise la web app.

## Architecture

```
Navigateur / futur client  ──HTTP──►  FastAPI (webapp.py)  ──lecture──►  database.py  ──►  library.db
   │                                       │
   │  pages HTML rendues Jinja2 (étagère, wishlist)   +   API JSON read-only (/api/...)
   └─ JS/CSS : déplier saga, pivoter livre, panneau d'infos, recherche/filtres (côté client)
```

- **FastAPI + Uvicorn** servent les pages **Jinja2** et l'API JSON.
- **Réutilisation de `database.py`** (Phase 1) en lecture seule : `get_all_books()`,
  `search_books()`. Aucune logique d'accès dupliquée. `webapp.py` appelle
  `database.init_db()` au démarrage.
- **Isolation :** le serveur web ne touche ni `main.py` ni `library.py`. Console et web
  sont deux interfaces indépendantes sur la même base.

### Nouveaux fichiers

| Fichier | Responsabilité |
|---|---|
| `webapp.py` | App FastAPI : routes HTML + API JSON, démarrage, hôte/port configurables |
| `templates/base.html` | Gabarit commun (en-tête, inclusion CSS/JS) |
| `templates/shelf.html` | Page étagère (collection possédée) |
| `templates/wishlist.html` | Page wishlist |
| `static/shelf.css` | Style de l'étagère, des tranches, du panneau d'infos |
| `static/shelf.js` | Interaction client : déplier, pivoter, panneau, recherche/filtres |
| `test_webapp.py` | Tests des routes via le TestClient FastAPI |

## Modèle d'interaction

- **Rendu serveur complet :** la page étagère contient déjà tous les livres, groupés
  auteur → saga → tome, avec les données de chaque livre **embarquées** (attributs
  `data-*` ou bloc JSON intégré). Premier affichage rapide, fonctionne même sans JS
  pour la vue de base.
- **Interaction 100 % côté client** (CSS transforms + JS, aucun aller-retour serveur) :
  déplier/replier une saga, faire pivoter un livre de face (`rotateY`), écarter ses
  voisins, afficher le panneau d'infos.
- **Recherche & filtres côté client** sur le jeu déjà chargé : filtrer/surligner les
  tranches sans recharger (conserve l'état de l'étagère).
  - Recherche : champ texte → correspondance sur titre / auteur / saga.
  - Filtres : statut de lecture (à lire / en cours / lu), possédé, wishlist.
  - `database.search_books` reste disponible si l'on veut basculer côté serveur plus tard.

### Couvertures et tranches

- **Couverture de face** (livre pivoté) : image Open Library par ISBN
  `https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg` (gratuit, sans clé).
- **Tranche** : générée en CSS — rectangle vertical + titre écrit verticalement, couleur
  **déterministe** dérivée d'un hash du titre + auteur (un même livre garde toujours la
  même couleur). Pas de scan réel nécessaire.
- **Repli** : si l'ISBN est absent ou si l'image ne charge pas → couverture « générée »
  (titre + couleur), cohérente avec la tranche. La page ne casse jamais.

## Routes

### Pages HTML (lecture seule, `GET`)

| Route | Rôle |
|---|---|
| `GET /` | Étagère des livres **possédés** (`possede = true`), groupés auteur → saga → tome. |
| `GET /wishlist` | Étagère des livres `wishlist = true`. |
| `GET /health` | Point de contrôle (`{"status": "ok"}` ou page simple) pour vérifier que le serveur tourne. |

### API JSON (lecture seule, `GET`)

| Route | Rôle |
|---|---|
| `GET /api/books` | Tous les livres possédés, en JSON (liste d'objets aux champs du modèle `Book`). |
| `GET /api/books/{id}` | Un livre par son id, en JSON ; 404 si absent. |
| `GET /api/wishlist` | Les livres `wishlist = true`, en JSON. |

### Statique

`static/` sert `shelf.css` et `shelf.js`.

La recherche et les filtres **ne sont pas des routes** : ils agissent côté client sur le
jeu déjà rendu.

## Configuration

- **Hôte / port configurables** via variables d'environnement (ex. `LIBRARY_HOST`,
  `LIBRARY_PORT`) avec défauts `127.0.0.1` / `8000`. Aucune valeur d'hôte codée en dur
  dans la logique (SEC-4).
- Lancement type : `uvicorn webapp:app` (défaut localhost) ; pour le serveur perso :
  hôte `0.0.0.0` via la variable d'environnement.

## Exigences de sécurité

La Phase 2 est en **lecture seule** : aucune mutation serveur, donc surface d'attaque
minime. La modélisation des menaces se poursuivra aux phases suivantes (auth en 3,
hébergement/HTTPS en 4).

- **SEC-W1 — Auto-échappement des gabarits.** Jinja2 échappe par défaut le HTML. Les
  données saisies (titre, auteur, commentaire) rendues dans la page ne peuvent pas
  injecter de script (XSS stocké). *Testable : un titre contenant `<script>` apparaît
  échappé, jamais exécuté.*
- **SEC-W2 — Liaison réseau maîtrisée.** Hôte configurable, **défaut `127.0.0.1`**.
  L'écoute sur le LAN (`0.0.0.0`) est autorisée en lecture seule pour un usage domestique.
  L'**exposition internet** d'une base **modifiable** exige d'abord l'authentification
  (Phase 3) et HTTPS (Phase 4) — pas avant.
- **SEC-W3 — Lecture seule stricte.** `webapp.py` n'appelle que `get_all_books` /
  `search_books` / `get_book`. Aucune route `POST` / `PUT` / `DELETE`, aucune écriture.
  Le bouton ✏️ est inactif.
- **SEC-W4 — Images externes maîtrisées.** Couvertures depuis `covers.openlibrary.org`
  avec `referrerpolicy="no-referrer"` ; repli local si l'image ne charge pas (pas de
  fuite de référent, pas de page cassée).
- **Acquis Phase 1 conservés :** `library.db` git-ignoré (SEC-3) ; pas de secret ni de
  chemin codé en dur (SEC-4) ; dépendances épinglées dans `requirements.txt` (SEC-6),
  avec ajout de `fastapi`, `uvicorn`, `jinja2`.

## Tests

`webapp.py` est testé avec le **TestClient de FastAPI** (requêtes HTTP en mémoire, sans
serveur ni navigateur), sur une **base SQLite en mémoire** peuplée de quelques livres —
même approche isolée qu'en Phase 1.

- `GET /` → 200 ; contient les titres des livres possédés ; **exclut** un livre
  uniquement wishlist.
- `GET /wishlist` → 200 ; contient les livres wishlist ; exclut les possédés non-wishlist.
- **SEC-W1** : un livre au titre `<script>alert(1)</script>` → la réponse contient la
  forme **échappée** (`&lt;script&gt;`), jamais la balise brute.
- Groupement : deux livres d'une même saga apparaissent sous le même en-tête de saga,
  ordonnés par tome.
- `GET /api/books` → 200, JSON, contient les bons livres ; `GET /api/books/{id}` →
  l'objet attendu, et **404** pour un id inexistant.
- `GET /api/wishlist` → 200, JSON, livres wishlist.
- `GET /health` → 200.

L'interaction visuelle (pivot, dépliage, panneau) relève du JS/CSS et se vérifie
**manuellement** dans le navigateur via une courte checklist de smoke test (déplier une
saga, pivoter un livre, ouvrir le panneau, lancer une recherche, appliquer un filtre,
ouvrir la wishlist).

## Évolutions visuelles futures (hors périmètre Phase 2)

Intention notée pour une itération ultérieure (à ne pas implémenter maintenant) :
rendre l'**étagère et l'arrière-plan plus réalistes** (texture bois, ombres portées,
profondeur, éclairage). La Phase 2 livre d'abord l'étagère fonctionnelle et stylisée
décrite ci-dessus ; le polish visuel réaliste viendra dans une passe dédiée.

## Critères de succès

- L'étagère affiche la collection possédée, groupée auteur → saga → tome, avec tranches
  générées et couvertures de face au pivot.
- Déplier une saga, pivoter un livre et afficher son panneau d'infos fonctionnent dans
  le navigateur.
- Recherche et filtres agissent instantanément côté client.
- La vue `/wishlist` liste les livres à acheter.
- Les routes JSON renvoient les bonnes données.
- Le serveur démarre sur l'hôte configuré (localhost par défaut, LAN possible).
- La suite de tests `test_webapp.py` passe au vert, dont le test d'échappement XSS
  (SEC-W1).
- La console et `database.py` restent inchangées et fonctionnelles.
