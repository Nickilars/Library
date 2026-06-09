# Sous-projet B1 — Frontend statique privé sur Supabase (lecture)

**Date :** 2026-06-09
**Statut :** Design validé, prêt pour planification
**Auteur :** Nicolas Rossel (avec Claude)

## Contexte

Le projet bascule d'une architecture **FastAPI + SQLite (auto-hébergée)** vers un
**frontend statique + Supabase** (Postgres managé + Auth + RLS), pour une app
**multi-appareils, privée, livrée vite**. Objectif d'accès hors-ligne : couvert plus tard
par une **PWA** (sous-projet B2). Ce document couvre **B1 : le frontend statique privé en
lecture, déployé sur GitHub Pages**.

Le **socle Supabase (sous-projet A) est déjà en place** : table `books` (modèle à 14
champs en Postgres avec `user_id`), **RLS** propriétaire-only (select/insert/update/
delete), **Auth** email/mot de passe, un **utilisateur** créé, et les **livres importés**
(rattachés à cet utilisateur).

### Rappel de la décomposition (re-plateformage Supabase)

- **A** — Socle Supabase + migration. ✅ fait (manuel).
- **B1** — Frontend statique privé en lecture, déployé. *(ce document)*
- **B2** — PWA (manifest + service worker) → lecture hors-ligne + installable.
- **C** — Écriture web (CRUD + recherche OpenLibrary/BnF côté JS).
- **D** — Scan mobile (caméra navigateur).

## Objectif de B1

Un **site statique** qui : connecte l'utilisateur (login Supabase), récupère **ses**
livres (RLS), **rend l'étagère côté client** (réutilisant le design, la navigation à 3
niveaux et le livre 3D), et se **déploie sur GitHub Pages**. Lecture seule (l'écriture =
sous-projet C). Accès **en ligne** (l'hors-ligne = B2).

## Décisions (issues du brainstorming)

- **Hébergement** : **GitHub Pages** (site « projet », sous-chemin `…/Library/`),
  déployé via une **GitHub Action**.
- **Chemins relatifs** partout (le sous-chemin Pages casse les chemins absolus actuels).
- **`supabase-js` vendoré** en local (cohérent avec Three.js, prépare l'offline B2).
- **Coupe nette** : suppression de tout l'ancien backend Python (voir liste).
- **Privé** : login requis même pour lire ; la **RLS** garantit que chacun ne voit que
  ses livres.
- `couleurTranche` portée en JS : implémentation déterministe **propre** (pas de
  continuité requise avec les couleurs Python).

## Architecture & structure des fichiers

Nouveau site statique dans un dossier dédié `web/` (déployé) :

```
web/
  index.html              App shell : en-tête (recherche/filtres/déconnexion),
                          formulaire de login (#login), #etagere, #barre-focus, #livre-ouvert
  config.js               window.SUPABASE_URL + window.SUPABASE_ANON_KEY (clé publique)
  app.js                  Client supabase-js ; auth (session/login/logout) ;
                          fetch des livres ; grouperLivres + couleurTranche ; construit le DOM de l'étagère
  shelf.js                Interactions niveaux 0/1/2 (navigation, ouverture du livre) — repris de l'actuel,
                          fonctions globales basculerSaga/choisirLivre + câblage en-tête ; import relatif de book3d.js
  book3d.js               Visionneuse 3D — reprise, import THREE en chemin relatif
  shelf.css               Repris tel quel
  vendor/
    three.module.js       Déplacé depuis static/
    supabase.js           supabase-js vendoré (version épinglée)
.github/workflows/deploy-pages.yml   Publie web/ sur GitHub Pages
```

### Coupe nette — fichiers supprimés (présents dans l'historique git)

`webapp.py`, `templates/` (base.html, _shelf.html, shelf.html, wishlist.html),
`database.py`, `migrate.py`, `library.py`, `main.py`, `book.py`, `scanner.py`,
`shelf.py`, `test_book.py`, `test_database.py`, `test_migration.py`, `test_scanner.py`,
`test_shelf.py`, `test_webapp.py`, `requirements.txt`, `inventory.json`. L'ancien
`static/` est remplacé par `web/` (ses assets utiles — `shelf.css`, `shelf.js`,
`book3d.js`, `vendor/three.module.js` — sont déplacés/adaptés dans `web/`).

### Portage Python → JS (dans `app.js`)

- `grouperLivres(livres)` : groupe par auteur → saga → tome, même structure que l'ancien
  `_shelf.html` attend (tableau d'auteurs, chacun avec ses sagas, chacune avec ses
  livres ordonnés par tome puis titre ; sagas nommées avant « Aucune » ; comparaison
  insensible à la casse).
- `couleurTranche(titre, auteur)` : couleur `#rrggbb` déterministe dérivée d'un hash du
  titre+auteur (teinte variable, saturation/luminosité fixes).

## Authentification & flux de données

1. Au chargement, `app.js` crée le client `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)`.
2. `auth.getSession()` : pas de session → afficher `#login`, masquer l'étagère ; session
   → charger l'étagère.
3. **Login** : `auth.signInWithPassword({ email, password })` → succès : charger
   l'étagère ; erreur : message lisible (sans détail technique).
4. **Déconnexion** : bouton appelant `auth.signOut()` → revient au login.
5. **Chargement** : `supabase.from('books').select('*')` (RLS → uniquement les livres de
   l'utilisateur) ; `grouperLivres` ; construction du DOM de l'étagère (sections auteur,
   sagas, tranches avec `data-*`, `--c`, `onclick`) ; injection dans `#etagere`.
6. `shelf.js` (navigation/ouverture) et `book3d.js` (livre 3D) opèrent sur ce DOM.

## Sécurité

- **RLS = protection des données.** Sans session, `select` renvoie 0 ligne. Politiques
  propriétaire-only déjà en place (sous-projet A).
- **Clé `anon` publique par conception** : présente dans `config.js` (donc sur GitHub) —
  c'est normal et sûr tant que la RLS est correcte. La clé **`service_role` ne doit
  jamais** apparaître dans le frontend.
- **SEC-W1 (anti-XSS)** : le DOM des livres est construit via `textContent` /
  `setAttribute` (jamais `innerHTML` avec des données du livre). *Testable : un livre au
  titre `<script>` s'affiche comme texte.*
- **HTTPS** d'office sur GitHub Pages (login sûr ; prérequis PWA en B2).
- **Inscriptions publiques désactivées** côté Supabase (réglage manuel) : app
  mono-utilisateur, personne d'autre ne peut créer de compte.
- Couvertures Open Library : comportement inchangé (`book3d.js` : `crossOrigin`
  anonymous + repli généré ; repli 2D : `referrerpolicy="no-referrer"`).

## Déploiement (GitHub Pages)

- Workflow `.github/workflows/deploy-pages.yml` déclenché au push sur `main` : publie le
  contenu de `web/` via `actions/configure-pages`, `actions/upload-pages-artifact`
  (`path: web/`) et `actions/deploy-pages`.
- **Étape manuelle unique** : Repo → Settings → Pages → **Source = GitHub Actions**.
- Tous les chemins du site sont **relatifs** pour fonctionner sous `…/Library/`.

## Tests

- **Front interactif (auth, DOM, 3D)** → vérification **manuelle** (checklist navigateur).
- **Fonctions pures portées** (`grouperLivres`, `couleurTranche`) : si `node` est
  disponible, un petit script d'assertions `web/test_shelf_logic.mjs` (lançable
  `node web/test_shelf_logic.mjs`) les vérifie (groupement auteur→saga→tome,
  insensibilité à la casse, format `#rrggbb`, déterminisme) ; sinon vérification manuelle.
- **Checklist navigateur** (après déploiement, sur l'URL Pages) :
  1. Sans session : seul le formulaire de login s'affiche, aucune donnée.
  2. Login avec tes identifiants → tes 9 livres s'affichent, groupés auteur → saga → tome.
  3. Navigation : clic saga → vue focalisée (+ retour) ; clic livre → livre 3D + carte.
  4. Déconnexion → retour au login.
  5. (Sécurité) Identifiants erronés → message d'erreur, pas d'accès.

## Hors périmètre (B1)

- **PWA / hors-ligne** (manifest, service worker) → sous-projet B2.
- **Écriture** (ajout/modif/suppression), recherche OpenLibrary/BnF → sous-projet C.
- **Scan** → sous-projet D.
- Réécriture du design visuel : aucune — on réutilise le CSS et le livre 3D existants.

## Critères de succès

- Le site statique déployé sur GitHub Pages exige un **login** ; une fois connecté,
  il affiche **les livres de l'utilisateur** (RLS) sous forme d'étagère, avec la
  navigation à 3 niveaux et le livre 3D fonctionnels.
- Aucune donnée visible sans session ; déconnexion fonctionnelle.
- L'ancien backend Python est retiré ; le dépôt ne contient plus que le site statique
  (`web/`), le workflow de déploiement et `docs/`.
- Chemins relatifs (fonctionne sous le sous-chemin Pages).
- `grouperLivres`/`couleurTranche` vérifiées (test node si dispo, sinon manuel) ;
  checklist navigateur validée.
