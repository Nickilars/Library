# Sous-projet B2 — PWA : lecture hors-ligne + installable

**Date :** 2026-06-09
**Statut :** Design validé, prêt pour planification
**Auteur :** Nicolas Rossel (avec Claude)

## Contexte

Le frontend statique privé (B1) est en ligne sur GitHub Pages, adossé à Supabase
(Auth + RLS). B2 le rend **installable** (PWA) et **consultable hors-ligne** — pour le cas
d'usage « vérifier sa collection en librairie sans réseau ». Cible principale : **Android**
(Chrome). Reste en **lecture seule** (l'écriture = sous-projet C).

### Rappel de la décomposition (re-plateformage Supabase)

- A — Socle Supabase + migration. ✅
- B1 — Frontend statique privé (lecture), déployé. ✅
- **B2 — PWA : lecture hors-ligne + installable.** *(ce document)*
- C — Écriture web (CRUD + recherche OpenLibrary/BnF côté JS).
- D — Scan mobile.

## Objectif de B2

Ajouter au site `web/` existant : un **manifest** + une **icône** (installable), et un
**service worker** qui met en cache la coquille de l'app pour qu'elle **se charge
hors-ligne** ; plus une **mise en cache des livres** côté application pour qu'ils
**s'affichent hors-ligne**. Aucun changement du backend Supabase, aucune écriture.

## Décisions (issues du brainstorming)

- **Cible Android/Chrome** : une **icône SVG** suffit (pas de jeu de PNG / pas de
  spécificités iOS).
- **Deux caches distincts** :
  - **Service worker** → coquille statique **same-origin** uniquement.
  - **`app.js` + `localStorage`** → les **données** (livres), car l'appel Supabase est
    **cross-origin** (délicat à intercepter dans un SW).
- **Lecture seule** hors-ligne (pas de file d'écriture — l'écriture est en C).
- **Mise à jour SW** : `skipWaiting` + `clients.claim` + cache versionné purgé à
  l'activation.

## Architecture

```
Service Worker (web/sw.js)
  • install : pré-cache la coquille same-origin
  • fetch (same-origin GET) : stale-while-revalidate (sert le cache, met à jour en fond)
  • activate : purge les anciens caches versionnés
app.js
  • après select('*') réussi : sauvegarde les livres dans localStorage ('biblio:livres' + date)
  • en cas d'échec (hors-ligne) : recharge depuis localStorage + bandeau "hors-ligne"
manifest.webmanifest + web/icon.svg : installation (icône, plein écran)
```

### Fichiers

| Fichier | Rôle | Action |
|---|---|---|
| `web/sw.js` | Service worker : pré-cache + stratégie de service | Créer |
| `web/manifest.webmanifest` | Métadonnées d'installation (nom, icône, standalone, scope/start relatifs) | Créer |
| `web/icon.svg` | Icône de l'app (livre sur fond bois) | Créer |
| `web/index.html` | Ajout `<link rel="manifest">`, `<meta name="theme-color">`, enregistrement du SW | Modifier |
| `web/app.js` | Cache des livres en `localStorage` + repli hors-ligne + bandeau | Modifier |
| `web/shelf.css` | Style du bandeau hors-ligne | Modifier |

### Coquille pré-cachée par le SW (same-origin)

`./` (et `./index.html`), `./config.js`, `./app.js`, `./shelf.js`, `./shelf-logic.mjs`,
`./book3d.js`, `./shelf.css`, `./manifest.webmanifest`, `./icon.svg`,
`./vendor/supabase.js`, `./vendor/three.module.js`.

## Comportement hors-ligne

- **Session** : `supabase.auth.getSession()` lit le `localStorage` → fonctionne
  hors-ligne. Session présente + hors-ligne → on affiche l'étagère depuis le cache de
  données. Pas de session → le formulaire de login s'affiche avec une note « connexion
  impossible hors-ligne » (le login exige le réseau).
- **Données** : après un chargement en ligne réussi, les livres sont enregistrés en
  `localStorage` (clé `biblio:livres`, + un horodatage `biblio:livres:date`). Si le
  `select` échoue (hors-ligne) : on lit `localStorage` ; si présent → rendu + bandeau
  « 📴 Hors-ligne — données du <date> » ; si vide → message invitant à se connecter une
  fois en ligne.
- **Couvertures** : les images Open Library (cross-origin) ne sont **pas** disponibles
  hors-ligne → le livre 3D et le repli utilisent la **couverture générée** (couleur +
  titre). Attendu, pas un bug.

## Détails techniques

- **Sous-chemin GitHub Pages** : le SW est servi à `/Library/sw.js` et enregistré via
  `navigator.serviceWorker.register('./sw.js')` → **scope `/Library/`** (couvre toute
  l'app). Les URLs de pré-cache sont relatives (résolues contre l'emplacement du SW).
- **Manifest** : `name`, `short_name`, `start_url: "./"`, `scope: "./"`,
  `display: "standalone"`, `theme_color`/`background_color` aux tons de l'app, `icons`
  pointant `./icon.svg` (`type: image/svg+xml`, `sizes: "any"`, `purpose: "any"`).
- **Versionnement du cache** : constante `CACHE = 'biblio-v1'` ; à chaque évolution de la
  coquille, on incrémente la version pour purger l'ancien cache à l'activation.
- **Enregistrement du SW** : dans `index.html` (ou `app.js`), `if ('serviceWorker' in
  navigator) navigator.serviceWorker.register('./sw.js')` après chargement.

## Sécurité

- Inchangée vs B1 : RLS protège les données ; clé `anon` publique ; SEC-W1
  (`textContent`/`setAttribute`) conservé ; pas de `service_role` côté client.
- **Note de confidentialité (déjà signalée)** : le cache hors-ligne stocke la collection
  **en clair dans le `localStorage`** de l'appareil connecté. Acceptable (c'est ton
  appareil) ; à la **déconnexion**, on **vide** `localStorage` (`biblio:livres*`) pour ne
  pas laisser les données en cache sur un appareil partagé.

## Tests

- **Automatisé** : `node web/test_shelf_logic.mjs` reste vert ; `manifest.webmanifest`
  est un **JSON valide** avec les clés requises (contrôle simple, ex. `node` qui
  `JSON.parse` le fichier).
- **Checklist navigateur** (Chrome desktop puis Android) :
  1. DevTools → Application → **Manifest** sans erreur ; invite « Installer ».
  2. DevTools → Application → **Service Workers** : « activated ».
  3. Se connecter (en ligne) ; Network → **Offline** → recharger → **l'app se charge**.
  4. Hors-ligne : **les livres s'affichent** (localStorage) + bandeau hors-ligne ;
     couvertures générées.
  5. **Déconnexion** : `localStorage` des livres vidé (re-login en ligne requis ensuite).
  6. **Android** : ouvrir en ligne une fois → « Ajouter à l'écran d'accueil » → couper le
     réseau → l'app installée s'ouvre et montre la collection.

## Hors périmètre (B2)

- Écriture (ajout/modif/suppression), recherche OpenLibrary/BnF → sous-projet C.
- File d'écriture hors-ligne / synchro de modifications → non (lecture seule).
- iOS/Safari (PNG apple-touch-icon, quirks SW) → non ciblé (Android d'abord).
- Mise en cache des couvertures Open Library hors-ligne → non.

## Critères de succès

- L'app est **installable** sur Android (manifest + icône valides) et s'ouvre en
  plein écran depuis l'écran d'accueil.
- Après une visite en ligne, l'app **se charge et affiche la collection hors-ligne**
  (coquille via SW + données via `localStorage`), avec un bandeau hors-ligne.
- La déconnexion purge le cache de données.
- `node web/test_shelf_logic.mjs` vert ; manifest JSON valide ; checklist navigateur OK.
- B1 (login en ligne, étagère, livre 3D) reste fonctionnel.
