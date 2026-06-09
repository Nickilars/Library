# Sous-projet B1 — Frontend statique privé sur Supabase · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un site statique (`web/`) qui authentifie l'utilisateur via Supabase, récupère ses livres (RLS), rend l'étagère côté client (réutilisant CSS / navigation 3 niveaux / livre 3D), et se déploie sur GitHub Pages — en remplaçant l'ancien backend Python (coupe nette).

**Architecture:** Frontend-only. `supabase-js` (UMD vendoré) expose `window.supabase`. `app.js` (module ES) gère auth + fetch + construit le DOM de l'étagère, en important les fonctions pures de `shelf-logic.mjs` (`grouperLivres`, `couleurTranche`). `shelf.js` (script classique) garde les interactions globales (navigation, ouverture) utilisées par les `onclick` inline. `book3d.js` (module ES) inchangé sauf chemin relatif. Déploiement GitHub Pages via Action ; chemins relatifs pour le sous-chemin `…/Library/`.

**Tech Stack:** HTML/CSS/JS vanilla, `supabase-js` v2 (UMD vendoré), Three.js (déjà vendoré), GitHub Pages + Actions. Tests : `node` pour les fonctions pures (`web/test_shelf_logic.mjs`) ; le reste (auth/DOM/3D, qui requiert tes identifiants Supabase) en **vérification manuelle navigateur**.

**Conventions :** Windows/PowerShell. Commits en anglais terminés par :
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Structure des fichiers (cible)

```
web/
  index.html            App shell : en-tête, formulaire #login, #etagere, #barre-focus, #livre-ouvert
  config.js             window.SUPABASE_URL + window.SUPABASE_ANON_KEY (à renseigner par toi)
  shelf-logic.mjs       export grouperLivres, couleurTranche (pur, testable node)
  app.js                module ES : client supabase, auth, fetch, construit l'étagère
  shelf.js              classique : interactions niveaux 0/1/2 (déplacé, import relatif)
  book3d.js             module ES : visionneuse 3D (déplacé, import relatif)
  shelf.css             styles (déplacé, + styles login)
  vendor/
    three.module.js     (déplacé)
    supabase.js         supabase-js v2 UMD vendoré
  test_shelf_logic.mjs  test node des fonctions pures
.github/workflows/deploy-pages.yml
```

---

## Task 1 : Coupe nette + restructuration en `web/`

**Files:** supprime l'ancien backend Python ; déplace les assets statiques dans `web/` ; passe les imports en chemins relatifs.

- [ ] **Step 1: Supprimer les fichiers Python obsolètes**

```powershell
git rm book.py database.py library.py main.py scanner.py migrate.py webapp.py shelf.py requirements.txt inventory.json test_book.py test_database.py test_migration.py test_scanner.py test_shelf.py test_webapp.py
git rm -r templates
```

- [ ] **Step 2: Déplacer les assets statiques dans `web/`**

```powershell
New-Item -ItemType Directory -Force web/vendor | Out-Null
git mv static/shelf.css web/shelf.css
git mv static/shelf.js web/shelf.js
git mv static/book3d.js web/book3d.js
git mv static/vendor/three.module.js web/vendor/three.module.js
git rm static/.gitkeep
```

- [ ] **Step 3: Passer les imports en chemins relatifs**

Dans `web/book3d.js`, remplacer :
```javascript
import * as THREE from '/static/vendor/three.module.js';
```
par :
```javascript
import * as THREE from './vendor/three.module.js';
```

Dans `web/shelf.js`, remplacer :
```javascript
    import('/static/book3d.js')
```
par :
```javascript
    import('./book3d.js')
```

- [ ] **Step 4: Vérifier**

Run: `Select-String -Path web/book3d.js,web/shelf.js -Pattern "/static/"`
Expected: **aucune** correspondance.

Run: `Get-ChildItem *.py` 
Expected: aucun fichier (tout le Python racine est parti).

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "refactor: clean cut to a static frontend (remove Python backend, move assets to web/)"
```
(append trailer)

---

## Task 2 : Vendorer supabase-js (UMD)

**Files:** Create `web/vendor/supabase.js`

- [ ] **Step 1: Télécharger le build UMD (version figée)**

```powershell
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js" -OutFile "web/vendor/supabase.js"
```

- [ ] **Step 2: Vérifier**

Run: `(Get-Item web/vendor/supabase.js).Length`
Expected: taille ≫ 100 000 octets.

Run: `Select-String -Path web/vendor/supabase.js -Pattern "createClient" -List | Select-Object -First 1`
Expected: au moins une correspondance (le bundle expose `createClient`).

- [ ] **Step 3: Commit**

```powershell
git add web/vendor/supabase.js
git commit -m "chore: vendor supabase-js v2.45.4 (UMD)"
```
(append trailer)

---

## Task 3 : Fonctions pures portées + test node

**Files:** Create `web/shelf-logic.mjs`, `web/test_shelf_logic.mjs`

- [ ] **Step 1: Écrire le test qui échoue** — créer `web/test_shelf_logic.mjs` :

```javascript
import assert from 'node:assert';
import { grouperLivres, couleurTranche } from './shelf-logic.mjs';

// couleurTranche : déterministe + format #rrggbb + variabilité
const c1 = couleurTranche('Dune', 'Herbert');
assert.strictEqual(c1, couleurTranche('Dune', 'Herbert'), 'déterministe');
assert.match(c1, /^#[0-9a-f]{6}$/, 'format hex');
assert.notStrictEqual(couleurTranche('Dune', 'Herbert'), couleurTranche('Le Hobbit', 'Tolkien'));

// grouperLivres : auteur -> saga -> tome
const livres = [
  { titre: 'La nef du crépuscule', auteur: 'Robin Hobb', saga: "L'Assassin royal", tome: 3 },
  { titre: "L'apprenti assassin", auteur: 'Robin Hobb', saga: "L'Assassin royal", tome: 1 },
  { titre: 'Le Hobbit', auteur: 'Tolkien', saga: 'Aucune', tome: null },
];
const g = grouperLivres(livres);
assert.deepStrictEqual(g.map(x => x.auteur), ['Robin Hobb', 'Tolkien']);
assert.strictEqual(g[0].sagas[0].nom, "L'Assassin royal");
assert.deepStrictEqual(g[0].sagas[0].livres.map(b => b.titre), ["L'apprenti assassin", 'La nef du crépuscule']);
assert.strictEqual(g[1].sagas[0].nom, 'Aucune');

// insensible à la casse : un seul groupe
const g2 = grouperLivres([
  { titre: 'A', auteur: 'Tolkien', saga: 'X', tome: 1 },
  { titre: 'B', auteur: 'tolkien', saga: 'x', tome: 2 },
]);
assert.strictEqual(g2.length, 1, 'auteurs casse-insensible');
assert.strictEqual(g2[0].sagas.length, 1, 'sagas casse-insensible');

// saga vide -> "Aucune"
const g3 = grouperLivres([{ titre: 'Seul', auteur: 'X', saga: null, tome: null }]);
assert.strictEqual(g3[0].sagas[0].nom, 'Aucune');

console.log('OK : tests shelf-logic passent.');
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `node web/test_shelf_logic.mjs`
Expected: `ERR_MODULE_NOT_FOUND` (shelf-logic.mjs absent).
*(Si `node` n'est pas installé : créer quand même les deux fichiers — Steps 3 — et vérifier les fonctions manuellement dans la console du navigateur après la Task 5. Signaler l'absence de node dans le rapport.)*

- [ ] **Step 3: Créer `web/shelf-logic.mjs`**

```javascript
// Présentation pure de l'étagère (groupement + couleur). Sans DOM, testable avec node.

function cmp(a, b) { a = (a || '').toLowerCase(); b = (b || '').toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; }
function sagaKey(s) { s = s || 'Aucune'; return (s === 'Aucune' ? '￿' : '') + s.toLowerCase(); } // 'Aucune' en dernier
function tomeKey(t) { return (t === null || t === undefined || t === '') ? Infinity : Number(t); }

export function grouperLivres(livres) {
  const tries = [...livres].sort((a, b) =>
    cmp(a.auteur, b.auteur) ||
    cmp(sagaKey(a.saga), sagaKey(b.saga)) ||
    (tomeKey(a.tome) - tomeKey(b.tome)) ||
    cmp(a.titre, b.titre)
  );
  const groupes = [];
  for (const b of tries) {
    let g = groupes[groupes.length - 1];
    if (!g || g.auteur.toLowerCase() !== (b.auteur || '').toLowerCase()) {
      g = { auteur: b.auteur, sagas: [] }; groupes.push(g);
    }
    const nomSaga = b.saga || 'Aucune';
    let s = g.sagas[g.sagas.length - 1];
    if (!s || s.nom.toLowerCase() !== nomSaga.toLowerCase()) {
      s = { nom: nomSaga, livres: [] }; g.sagas.push(s);
    }
    s.livres.push(b);
  }
  return groupes;
}

export function couleurTranche(titre, auteur) {
  const s = `${titre}|${auteur}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return hslVersHex(h % 360, 0.45, 0.38);
}
function hslVersHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, bb;
  if (h < 60) { r = c; g = x; bb = 0; }
  else if (h < 120) { r = x; g = c; bb = 0; }
  else if (h < 180) { r = 0; g = c; bb = x; }
  else if (h < 240) { r = 0; g = x; bb = c; }
  else if (h < 300) { r = x; g = 0; bb = c; }
  else { r = c; g = 0; bb = x; }
  const hh = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hh(r)}${hh(g)}${hh(bb)}`;
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `node web/test_shelf_logic.mjs`
Expected: `OK : tests shelf-logic passent.`

- [ ] **Step 5: Commit**

```powershell
git add web/shelf-logic.mjs web/test_shelf_logic.mjs
git commit -m "feat: port grouperLivres and couleurTranche to JS with a node test"
```
(append trailer)

---

## Task 4 : App shell (index.html), config, styles login

**Files:** Create `web/index.html`, `web/config.js` ; Modify `web/shelf.css`

- [ ] **Step 1: Créer `web/index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Ma bibliothèque</title>
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

- [ ] **Step 2: Créer `web/config.js`** (valeurs à renseigner par toi)

```javascript
// À RENSEIGNER : Supabase -> Project Settings -> API.
// La clé anon est PUBLIQUE par conception (la RLS protège les données).
window.SUPABASE_URL = 'https://VOTRE-PROJET.supabase.co';
window.SUPABASE_ANON_KEY = 'VOTRE_CLE_ANON';
```

> Étape manuelle : remplace les deux valeurs par celles de ton projet Supabase avant de tester/déployer.

- [ ] **Step 3: Ajouter les styles login à la fin de `web/shelf.css`**

```css

/* ---------- Login + en-tête connecté ---------- */
[hidden] { display: none !important; }
.login { max-width: 320px; margin: 60px auto; display: flex; flex-direction: column; gap: 12px; background: #1a110a; padding: 24px; border-radius: 12px; border: 1px solid #4a3826; }
.login h2 { margin: 0 0 4px; color: #c9a880; }
.login input { padding: 10px; border-radius: 6px; border: 1px solid #5a4a35; background: #2b1d12; color: #eee; }
.login button { padding: 10px; border-radius: 6px; border: none; background: #c9a880; color: #1a110a; font-weight: 600; cursor: pointer; }
.login-erreur { color: #ff6b6b; margin: 0; }
#btn-deconnexion { background: #2b1d12; border: 1px solid #5a4a35; color: #c9a880; border-radius: 6px; padding: 6px 12px; cursor: pointer; }
```

- [ ] **Step 4: Commit**

```powershell
git add web/index.html web/config.js web/shelf.css
git commit -m "feat: add app shell (index.html), config and login styles"
```
(append trailer)

---

## Task 5 : app.js — auth + fetch + rendu de l'étagère

**Files:** Create `web/app.js`

- [ ] **Step 1: Créer `web/app.js`**

```javascript
// Frontend Supabase : authentification, récupération des livres (RLS), rendu de l'étagère.
import { grouperLivres, couleurTranche } from './shelf-logic.mjs';

const client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const elLogin = document.getElementById('login');
const elEtagere = document.getElementById('etagere');
const elControles = document.getElementById('controles');
const elErreur = document.getElementById('login-erreur');

function montrerLogin() {
  elLogin.hidden = false; elEtagere.hidden = true; elControles.hidden = true;
}
async function montrerApp() {
  elLogin.hidden = true; elEtagere.hidden = false; elControles.hidden = false;
  await chargerLivres();
}

async function chargerLivres() {
  const { data, error } = await client.from('books').select('*');
  if (error) { elEtagere.replaceChildren(); const p = document.createElement('p'); p.className = 'vide'; p.textContent = 'Erreur de chargement.'; elEtagere.appendChild(p); return; }
  construireEtagere(data || []);
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
  const email = document.getElementById('email').value.trim();
  const motdepasse = document.getElementById('motdepasse').value;
  const { error } = await client.auth.signInWithPassword({ email, password: motdepasse });
  if (error) { elErreur.textContent = 'Email ou mot de passe incorrect.'; elErreur.hidden = false; return; }
  await montrerApp();
});

document.getElementById('btn-deconnexion').addEventListener('click', async () => {
  await client.auth.signOut();
  elEtagere.replaceChildren();
  montrerLogin();
});

(async function init() {
  const { data: { session } } = await client.auth.getSession();
  if (session) await montrerApp(); else montrerLogin();
})();
```

- [ ] **Step 2: Vérification manuelle (avec TES identifiants Supabase)**

D'abord renseigne `web/config.js` (URL + clé anon de ton projet). Puis sers `web/` en local :
```powershell
python -m http.server 8000 --directory web
```
Ouvre http://127.0.0.1:8000 et vérifie :
1. Sans session : seul le formulaire de **login** s'affiche.
2. Identifiants **erronés** → message d'erreur, pas d'accès.
3. **Login** réussi → tes livres s'affichent (étagère groupée auteur → saga → tome).
4. Clic **saga** → vue focalisée + Retour ; clic **livre** → livre 3D + carte d'infos.
5. **Déconnexion** → retour au login ; recharger la page reste sur login.

(Arrête le serveur avec Ctrl+C. `python` sert juste de serveur statique ici — aucun backend.)

- [ ] **Step 3: Commit**

```powershell
git add web/app.js
git commit -m "feat: Supabase auth + RLS-scoped book fetch + client-side shelf rendering"
```
(append trailer)

---

## Task 6 : Déploiement GitHub Pages + README

**Files:** Create `.github/workflows/deploy-pages.yml` ; Modify `README.md`

- [ ] **Step 1: Créer `.github/workflows/deploy-pages.yml`**

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: web
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Réécrire `README.md`** (le projet est désormais un frontend statique sur Supabase)

```markdown
# 📚 Ma bibliothèque — frontend statique (Supabase)

Application web de consultation de ma bibliothèque personnelle : étagère 3D (livres en
tranches groupés par auteur puis saga, livre 3D au clic), **privée** (login), servie en
**site statique** et adossée à **Supabase** (Postgres + Auth + RLS).

## Lancer en local
Renseigne `web/config.js` (URL + clé anon de ton projet Supabase), puis :
```bash
python -m http.server 8000 --directory web
```
Ouvre http://127.0.0.1:8000.

## Déploiement (GitHub Pages)
Le workflow `.github/workflows/deploy-pages.yml` publie `web/` à chaque push sur `main`.
Étape unique côté GitHub : **Settings → Pages → Source = GitHub Actions**.

## Données & sécurité
- Données dans Supabase ; chaque ligne porte un `user_id`, la **RLS** restreint la lecture
  au propriétaire connecté.
- La clé `anon` du frontend est **publique par conception** (la RLS protège). La clé
  `service_role` ne doit jamais être exposée.
- Pense à désactiver les inscriptions publiques (Authentication) pour cette app mono-utilisateur.

## Tests
- Fonctions pures : `node web/test_shelf_logic.mjs`.
- Le reste se vérifie manuellement dans le navigateur (login → étagère → livre 3D).
```

- [ ] **Step 3: Commit**

```powershell
git add .github/workflows/deploy-pages.yml README.md
git commit -m "ci: deploy web/ to GitHub Pages; docs: rewrite README for the static app"
```
(append trailer)

---

## Vérification finale

- [ ] `node web/test_shelf_logic.mjs` → `OK : tests shelf-logic passent.` (ou vérif manuelle si node absent)
- [ ] Aucun fichier `.py` à la racine ; `web/` contient index.html, config.js, app.js, shelf.js, shelf-logic.mjs, book3d.js, shelf.css, vendor/{three.module.js, supabase.js}, test_shelf_logic.mjs.
- [ ] `Select-String -Path web/*.js,web/*.mjs -Pattern "/static/"` → aucune correspondance.
- [ ] Checklist navigateur (Task 5, Step 2) validée avec tes identifiants.
- [ ] Étapes manuelles côté toi : renseigner `config.js` ; activer Pages (Source = Actions) ; désactiver les inscriptions publiques Supabase.
