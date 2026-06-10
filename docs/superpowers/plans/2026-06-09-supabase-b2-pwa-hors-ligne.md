# Sous-projet B2 — PWA hors-ligne + installable · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le frontend `web/` **installable** (manifest + icône SVG) et **consultable hors-ligne** : un service worker met en cache la coquille statique, et `app.js` met les livres en cache `localStorage` pour les afficher sans réseau (lecture seule, cible Android).

**Architecture:** Deux caches distincts. Le **service worker** (`web/sw.js`) pré-cache les fichiers statiques **same-origin** (stale-while-revalidate) → l'app se charge hors-ligne. **`app.js`** sauvegarde les livres dans `localStorage` après chaque chargement réussi et y retombe hors-ligne, avec un bandeau. Le manifest + une icône SVG rendent l'app installable. Aucun changement Supabase ; lecture seule.

**Tech Stack:** PWA (manifest, service worker, Cache API), `localStorage`, JS vanilla. Déployé sur GitHub Pages sous `/Library/` (scope du SW = `/Library/`). Tests : `node` (test pur existant + validité du manifest) + checklist navigateur manuelle.

**Conventions :** Windows/PowerShell. Commits en anglais terminés par :
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Structure des fichiers

| Fichier | Rôle | Action |
|---|---|---|
| `web/manifest.webmanifest` | Métadonnées d'installation | Créer |
| `web/icon.svg` | Icône de l'app (vectorielle) | Créer |
| `web/sw.js` | Service worker (pré-cache coquille + SWR) | Créer |
| `web/index.html` | Lien manifest + theme-color + div bandeau hors-ligne | Modifier (remplacement) |
| `web/app.js` | Cache livres localStorage + repli + bandeau + purge à la déconnexion + enregistrement SW | Modifier (remplacement) |
| `web/shelf.css` | Style du bandeau hors-ligne | Modifier (append) |

---

## Task 1 : Manifest + icône + index.html + style du bandeau

**Files:** Create `web/manifest.webmanifest`, `web/icon.svg` ; Modify `web/index.html`, `web/shelf.css`

- [ ] **Step 1: Créer `web/manifest.webmanifest`** :

```json
{
  "name": "Ma bibliothèque",
  "short_name": "Bibliothèque",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#2b1d12",
  "theme_color": "#1a110a",
  "icons": [
    { "src": "./icon.svg", "type": "image/svg+xml", "sizes": "any", "purpose": "any" }
  ]
}
```

- [ ] **Step 2: Créer `web/icon.svg`** (livre stylisé sur fond bois, pur vectoriel) :

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="100" fill="#1a110a"/>
  <g transform="translate(120,106)">
    <rect width="272" height="300" rx="12" fill="#533483"/>
    <rect width="46" height="300" rx="8" fill="#3a2360"/>
    <rect x="82" y="58" width="166" height="18" rx="9" fill="#f0d9ff"/>
    <rect x="82" y="98" width="120" height="12" rx="6" fill="#c9a8e0"/>
    <rect x="82" y="128" width="150" height="12" rx="6" fill="#c9a8e0"/>
  </g>
</svg>
```

- [ ] **Step 3: Remplacer `web/index.html`** par EXACTEMENT (ajoute `theme-color`, le lien manifest, et le div `#bandeau-hors-ligne`) :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#1a110a">
  <title>Ma bibliothèque</title>
  <link rel="manifest" href="./manifest.webmanifest">
  <link rel="stylesheet" href="./shelf.css">
</head>
<body>
  <header class="entete">
    <h1>📚 Ma bibliothèque</h1>
    <div class="controles" id="controles" hidden>
      <input id="recherche" type="search" placeholder="Rechercher titre, auteur, saga…">
      <div class="filtres">
        <button class="chip actif" data-statut="">Tous</button>
        <button class="chip" data-statut="non_lu">À lire</button>
        <button class="chip" data-statut="en_cours">En cours</button>
        <button class="chip" data-statut="lu">Lu</button>
      </div>
      <button id="btn-deconnexion">Déconnexion</button>
    </div>
  </header>

  <div id="bandeau-hors-ligne" class="bandeau-hors-ligne" hidden></div>

  <div id="barre-focus" class="barre-focus">
    <button id="btn-retour">← Retour</button>
    <span id="focus-nom"></span>
  </div>

  <main id="contenu">
    <form id="login" class="login">
      <h2>Connexion</h2>
      <input id="email" type="email" placeholder="Email" autocomplete="username" required>
      <input id="motdepasse" type="password" placeholder="Mot de passe" autocomplete="current-password" required>
      <button type="submit">Se connecter</button>
      <p id="login-erreur" class="login-erreur" hidden></p>
    </form>
    <div id="etagere" hidden></div>
  </main>

  <div id="livre-ouvert" class="livre-ouvert cache"></div>

  <script src="./config.js"></script>
  <script src="./vendor/supabase.js"></script>
  <script src="./shelf.js"></script>
  <script type="module" src="./app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Ajouter à la fin de `web/shelf.css`** :

```css

/* ---------- Bandeau hors-ligne (PWA) ---------- */
.bandeau-hors-ligne { background: #5a3a1a; color: #f0d9ff; text-align: center; padding: 6px 12px; font-size: 14px; }
```

- [ ] **Step 5: Vérifier la validité du manifest** :

Run: `node -e "JSON.parse(require('fs').readFileSync('web/manifest.webmanifest','utf8')); console.log('manifest JSON OK')"`
Expected: `manifest JSON OK`.

Run: `Select-String -Path web/index.html -Pattern "manifest.webmanifest|theme-color|bandeau-hors-ligne"`
Expected: les trois apparaissent.

- [ ] **Step 6: Commit** :

```powershell
git add web/manifest.webmanifest web/icon.svg web/index.html web/shelf.css
git commit -m "feat: add PWA manifest, SVG icon, offline banner element and styles"
```
(append trailer)

---

## Task 2 : Service worker (coquille hors-ligne)

**Files:** Create `web/sw.js`

- [ ] **Step 1: Créer `web/sw.js`** :

```javascript
// Service worker : met en cache la coquille statique (same-origin) pour la lecture hors-ligne.
// Les données Supabase (cross-origin) sont gérées au niveau de app.js (localStorage), pas ici.
const CACHE = 'biblio-v1';
const COQUILLE = [
  './', './index.html', './config.js', './app.js', './shelf.js', './shelf-logic.mjs',
  './book3d.js', './shelf.css', './manifest.webmanifest', './icon.svg',
  './vendor/supabase.js', './vendor/three.module.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(COQUILLE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // On ne gère que la coquille : GET same-origin. Le reste (Supabase, Open Library) va au réseau.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const enCache = await cache.match(req);
      const reseau = fetch(req)
        .then(rep => { if (rep && rep.ok) cache.put(req, rep.clone()); return rep; })
        .catch(() => enCache);
      return enCache || reseau;   // stale-while-revalidate : cache d'abord, MAJ en arrière-plan
    })
  );
});
```

- [ ] **Step 2: Vérifier la syntaxe** :

Run: `node --check web/sw.js`
Expected: aucune sortie (exit 0). *(node ne connaît pas `self`/`caches`, mais `--check` ne valide que la syntaxe — il passe.)*

- [ ] **Step 3: Commit** :

```powershell
git add web/sw.js
git commit -m "feat: add service worker precaching the app shell (offline shell)"
```
(append trailer)

---

## Task 3 : Cache des données + enregistrement du SW (app.js)

**Files:** Modify `web/app.js` (remplacement complet)

- [ ] **Step 1: Remplacer `web/app.js`** par EXACTEMENT :

```javascript
// Frontend Supabase : authentification, récupération des livres (RLS), rendu de l'étagère.
// B2 : cache des livres en localStorage (lecture hors-ligne) + enregistrement du service worker.
import { grouperLivres, couleurTranche } from './shelf-logic.mjs';

const client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const elLogin = document.getElementById('login');
const elEtagere = document.getElementById('etagere');
const elControles = document.getElementById('controles');
const elErreur = document.getElementById('login-erreur');
const elBandeau = document.getElementById('bandeau-hors-ligne');

const CLE_LIVRES = 'biblio:livres';
const CLE_DATE = 'biblio:livres:date';

function montrerLogin() {
  elLogin.hidden = false; elEtagere.hidden = true; elControles.hidden = true;
}
async function montrerApp() {
  elLogin.hidden = true; elEtagere.hidden = false; elControles.hidden = false;
  await chargerLivres();
}

function afficherBandeau(dateISO) {
  let txt = '📴 Hors-ligne';
  if (dateISO) txt += ' — données du ' + new Date(dateISO).toLocaleDateString('fr-FR');
  elBandeau.textContent = txt; elBandeau.hidden = false;
}
function masquerBandeau() { elBandeau.hidden = true; }

async function chargerLivres() {
  const { data, error } = await client.from('books').select('*');
  if (!error && data) {
    try {
      localStorage.setItem(CLE_LIVRES, JSON.stringify(data));
      localStorage.setItem(CLE_DATE, new Date().toISOString());
    } catch (e) { /* quota dépassé : on ignore le cache */ }
    masquerBandeau();
    construireEtagere(data);
    return;
  }
  // Échec (typiquement hors-ligne) : repli sur le cache local.
  const cache = localStorage.getItem(CLE_LIVRES);
  if (cache) {
    afficherBandeau(localStorage.getItem(CLE_DATE));
    construireEtagere(JSON.parse(cache));
  } else {
    elEtagere.replaceChildren();
    const p = document.createElement('p'); p.className = 'vide';
    p.textContent = 'Hors-ligne et aucune donnée en cache. Connecte-toi une fois en ligne.';
    elEtagere.appendChild(p);
  }
}

function construireEtagere(livres) {
  elEtagere.replaceChildren();
  const groupes = grouperLivres(livres);
  if (!groupes.length) {
    const p = document.createElement('p'); p.className = 'vide'; p.textContent = 'Votre collection est vide.';
    elEtagere.appendChild(p); return;
  }
  for (const g of groupes) {
    const section = document.createElement('section'); section.className = 'auteur';
    const h2 = document.createElement('h2'); h2.className = 'auteur-nom'; h2.textContent = g.auteur;
    section.appendChild(h2);
    for (const s of g.sagas) {
      const divS = document.createElement('div'); divS.className = 'saga'; divS.setAttribute('data-saga', s.nom);
      const nom = document.createElement('div'); nom.className = 'saga-nom'; nom.setAttribute('onclick', 'basculerSaga(this)');
      nom.textContent = s.nom;
      if (s.nom !== 'Aucune') {
        const c = document.createElement('span'); c.className = 'saga-compte'; c.textContent = ` (${s.livres.length})`;
        nom.appendChild(c);
      }
      divS.appendChild(nom);
      const rangee = document.createElement('div'); rangee.className = 'rangee';
      for (const b of s.livres) {
        const livre = document.createElement('div'); livre.className = 'livre';
        livre.setAttribute('data-id', b.id);
        livre.setAttribute('data-titre', b.titre);
        livre.setAttribute('data-auteur', b.auteur);
        livre.setAttribute('data-annee', b.annee_publication || '');
        livre.setAttribute('data-saga', b.saga || 'Aucune');
        livre.setAttribute('data-tome', (b.tome ?? '') + '');
        livre.setAttribute('data-statut', b.statut_lecture || 'non_lu');
        livre.setAttribute('data-note', (b.note ?? '') + '');
        livre.setAttribute('data-isbn', b.isbn || '');
        livre.setAttribute('data-commentaire', b.commentaire || '');
        livre.setAttribute('data-possede', b.possede ? '1' : '0');
        livre.style.setProperty('--c', couleurTranche(b.titre, b.auteur));
        livre.setAttribute('onclick', 'choisirLivre(this)');
        const t = document.createElement('span'); t.className = 'tranche-titre'; t.textContent = b.titre;
        livre.appendChild(t);
        rangee.appendChild(livre);
      }
      divS.appendChild(rangee);
      section.appendChild(divS);
    }
    elEtagere.appendChild(section);
  }
}

elLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  elErreur.hidden = true;
  if (!navigator.onLine) { elErreur.textContent = 'Connexion impossible hors-ligne.'; elErreur.hidden = false; return; }
  const email = document.getElementById('email').value.trim();
  const motdepasse = document.getElementById('motdepasse').value;
  const { error } = await client.auth.signInWithPassword({ email, password: motdepasse });
  if (error) { elErreur.textContent = 'Email ou mot de passe incorrect.'; elErreur.hidden = false; return; }
  await montrerApp();
});

document.getElementById('btn-deconnexion').addEventListener('click', async () => {
  await client.auth.signOut();
  localStorage.removeItem(CLE_LIVRES);
  localStorage.removeItem(CLE_DATE);
  masquerBandeau();
  elEtagere.replaceChildren();
  montrerLogin();
});

(async function init() {
  const { data: { session } } = await client.auth.getSession();
  if (session) await montrerApp(); else montrerLogin();
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
```

- [ ] **Step 2: Vérifier la syntaxe** :

Run: `node --check web/app.js`
Expected: aucune sortie (exit 0).

- [ ] **Step 3: Commit** :

```powershell
git add web/app.js
git commit -m "feat: cache books in localStorage for offline read, offline banner, logout purge, SW registration"
```
(append trailer)

---

## Task 4 : Vérification

- [ ] **Step 1: Contrôles automatiques** :

```powershell
node web/test_shelf_logic.mjs
node -e "JSON.parse(require('fs').readFileSync('web/manifest.webmanifest','utf8')); console.log('manifest JSON OK')"
node --check web/sw.js
node --check web/app.js
```
Expected : `OK : tests shelf-logic passent.`, `manifest JSON OK`, puis aucune erreur de syntaxe.

- [ ] **Step 2: Vérification manuelle navigateur** (renseigne d'abord `web/config.js` avec tes identifiants) :

```powershell
python -m http.server 8000 --directory web
```
Ouvre http://127.0.0.1:8000 et, dans Chrome :
1. **DevTools → Application → Manifest** : affiché sans erreur ; bouton « Installer » proposé.
2. **DevTools → Application → Service Workers** : « activated ».
3. Se connecter (en ligne). Puis **DevTools → Network → Offline** → **recharger** → l'app **se charge** et **affiche les livres** (depuis `localStorage`) avec le **bandeau « 📴 Hors-ligne »** ; les couvertures sont les versions générées.
4. **Déconnexion** → le cache des livres est vidé (recharger hors-ligne montre alors le message « connecte-toi une fois en ligne »).
5. Repasser **en ligne** → login → tout revient à la normale (vraies couvertures).

*(Note : le service worker ne sert hors-ligne qu'à partir du 2ᵉ chargement — la 1ʳᵉ visite l'installe.)*

- [ ] **Step 3: `git status` propre**.

---

## Étapes manuelles (côté toi, après merge)

- Pousser sur `main` redéploie via GitHub Pages.
- Sur Android : ouvrir l'URL **en ligne une fois** (amorce le cache) → « Ajouter à l'écran d'accueil » → tu peux ensuite consulter hors-ligne.
