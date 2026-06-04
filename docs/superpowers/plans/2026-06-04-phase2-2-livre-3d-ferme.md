# Phase 2.2 — Livre 3D fermé + infos · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'animation CSS d'ouverture du livre (niveau 2) par un **livre 3D fermé** (Three.js vendoré) montrant la vraie couverture Open Library, avec une **carte d'infos à côté**, et un repli 2D si WebGL est indisponible.

**Architecture:** Front-end uniquement. Three.js est vendoré en local. Un module isolé `static/book3d.js` gère la scène 3D (livre fermé, textures, lumières, balancement + glisser) avec une visionneuse persistante réutilisée entre ouvertures. `static/shelf.js` (niveaux 0/1 inchangés) reconstruit l'overlay du niveau 2 : zone visuelle (canvas 3D ou image 2D de repli) + carte d'infos HTML. Aucun changement serveur ; `_shelf.html`/`base.html`/`webapp.py`/`shelf.py`/`database.py` inchangés.

**Tech Stack:** Three.js 0.160.0 (vendoré), JS ES modules (import dynamique), CSS. Vérification front **manuelle** (checklist navigateur) ; les suites serveur (`test_webapp.py`, `test_shelf.py`) restent vertes.

**Conventions :** Windows/PowerShell. Python via `.venv\Scripts\python.exe`. Pour les tests à accents : `$env:PYTHONIOENCODING='utf-8'`. Commits en anglais terminés par :
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Structure des fichiers

| Fichier | Changement |
|---|---|
| `static/vendor/three.module.js` | **Créer** (téléchargé, version figée 0.160.0) |
| `static/book3d.js` | **Créer** — module : `webglDisponible()`, `ouvrir(conteneur, donnees)`, `fermer()` |
| `static/shelf.js` | **Remplacer** — niveau 2 reconstruit (3D/2D + carte) ; niveaux 0/1 + filtres inchangés ; retrait de l'ancien livre animé |
| `static/shelf.css` | **Remplacer** — retrait des styles du livre animé ; ajout layout overlay (zone livre + carte) responsive |
| `templates/*`, `webapp.py`, `shelf.py`, `database.py` | **Inchangés** |

---

## Task 1 : Vendorer Three.js

**Files:** Create `static/vendor/three.module.js`

- [ ] **Step 1: Créer le dossier et télécharger Three.js (version figée)**

Run (PowerShell) :
```
New-Item -ItemType Directory -Force "static/vendor" | Out-Null
Invoke-WebRequest -Uri "https://unpkg.com/three@0.160.0/build/three.module.js" -OutFile "static/vendor/three.module.js"
```

- [ ] **Step 2: Vérifier le fichier**

Run: `(Get-Item static/vendor/three.module.js).Length`
Expected: une taille de l'ordre de ~1 200 000 octets (≫ 100 000). S'il fait quelques centaines d'octets, c'est une page d'erreur — réessayer.

Run: `Select-String -Path static/vendor/three.module.js -Pattern "WebGLRenderer" -List`
Expected: au moins une correspondance (le fichier contient bien Three.js).

- [ ] **Step 3: Commit**

```bash
git add static/vendor/three.module.js
git commit -m "chore: vendor three.js 0.160.0 for the 3D book viewer"
```
(append trailer)

---

## Task 2 : Module du livre 3D (book3d.js)

**Files:** Create `static/book3d.js`

Front-end ; vérification : import du module + (Task 5) rendu manuel.

- [ ] **Step 1: Créer `static/book3d.js`** avec EXACTEMENT :

```javascript
// Visionneuse de livre 3D fermé (Three.js vendoré). Lecture seule.
// Visionneuse persistante (un seul contexte WebGL) réutilisée entre ouvertures.
import * as THREE from '/static/vendor/three.module.js';

const W = 1.7, H = 2.4, T = 0.55;   // dimensions du livre (épais)
let renderer, scene, camera, livre, matCouv, rafId = null, actif = false;
let cibleY = -0.5, cibleX = 0.18, drag = false, lastX = 0, lastY = 0, libre = true, t0 = 0;

export function webglDisponible() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
}

// Texture de tranche : fines lignes pour évoquer les pages
function texTranche() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 512;
  const x = cv.getContext('2d');
  x.fillStyle = '#efe6d0'; x.fillRect(0, 0, 64, 512);
  x.strokeStyle = '#d8ccae'; x.lineWidth = 1;
  for (let y = 2; y < 512; y += 3) { x.beginPath(); x.moveTo(0, y); x.lineTo(64, y); x.stroke(); }
  return new THREE.CanvasTexture(cv);
}

// Couverture générée (repli) : aplat de couleur + titre
function couvGeneree(titre, couleur) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 720;
  const x = cv.getContext('2d');
  x.fillStyle = couleur || '#444'; x.fillRect(0, 0, 512, 720);
  x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 560, 512, 160);
  x.fillStyle = '#fff'; x.font = 'bold 40px Georgia, serif';
  // découpe simple du titre sur quelques lignes
  const mots = (titre || '').split(' '); let ligne = '', y = 610;
  for (const m of mots) {
    if ((ligne + ' ' + m).trim().length > 16) { x.fillText(ligne.trim(), 36, y); ligne = m; y += 46; }
    else ligne += ' ' + m;
  }
  if (ligne.trim()) x.fillText(ligne.trim(), 36, y);
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
}

function init(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2); camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const key = new THREE.DirectionalLight(0xfff2e0, 1.05); key.position.set(3, 4, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0x99bbff, 0.3); fill.position.set(-4, 1, 2); scene.add(fill);

  matCouv = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.55, metalness: 0.08 });
  const matDos = new THREE.MeshStandardMaterial({ color: 0x2b1d12, roughness: 0.6 });
  const matReliure = new THREE.MeshStandardMaterial({ color: 0x3a2233, roughness: 0.7 });
  const matPages = new THREE.MeshStandardMaterial({ map: texTranche(), roughness: 1 });
  // Faces : +x, -x, +y, -y, +z, -z
  const mats = [matPages, matReliure, matPages, matPages, matCouv, matDos];
  livre = new THREE.Mesh(new THREE.BoxGeometry(W, H, T), mats);
  scene.add(livre);

  // Glisser pour tourner
  canvas.addEventListener('pointerdown', e => { drag = true; libre = false; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('pointerup', () => { drag = false; });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    cibleY += (e.clientX - lastX) * 0.01;
    cibleX += (e.clientY - lastY) * 0.01;
    cibleX = Math.max(-1.0, Math.min(1.0, cibleX));
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('resize', redimensionner);
}

function redimensionner() {
  if (!renderer) return;
  const cv = renderer.domElement;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (w && h && (cv.width !== w || cv.height !== h)) {
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
}

function animer(now) {
  if (!actif) return;
  const t = (now - t0) / 1000;
  if (libre) cibleY = -0.5 + Math.sin(t * 0.5) * 0.35;   // balancement doux au repos
  livre.rotation.y += (cibleY - livre.rotation.y) * 0.08;
  livre.rotation.x += (cibleX - livre.rotation.x) * 0.08;
  redimensionner();
  renderer.render(scene, camera);
  rafId = requestAnimationFrame(animer);
}

function appliquerCouverture(d) {
  const isbn = (d.isbn || '').trim();
  if (isbn) {
    const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
    new THREE.TextureLoader().load(
      url,
      tex => { tex.anisotropy = 4; matCouv.map = tex; matCouv.color.set(0xffffff); matCouv.needsUpdate = true; },
      undefined,
      () => { matCouv.map = couvGeneree(d.titre, d.couleur); matCouv.color.set(0xffffff); matCouv.needsUpdate = true; }
    );
  } else {
    matCouv.map = couvGeneree(d.titre, d.couleur); matCouv.color.set(0xffffff); matCouv.needsUpdate = true;
  }
}

// Monte le canvas dans le conteneur, applique la couverture, démarre la boucle.
export function ouvrir(conteneur, d) {
  if (!renderer) {
    const canvas = document.createElement('canvas');
    canvas.className = 'canvas-livre';
    init(canvas);
  }
  conteneur.appendChild(renderer.domElement);
  cibleY = -0.5; cibleX = 0.18; libre = true;
  livre.rotation.set(0.18, -0.5, 0);
  appliquerCouverture(d);
  redimensionner();
  if (!actif) { actif = true; t0 = performance.now(); rafId = requestAnimationFrame(animer); }
}

// Arrête la boucle et détache le canvas (le contexte WebGL est conservé pour réusage).
export function fermer() {
  actif = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (renderer && renderer.domElement.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
}
```

- [ ] **Step 2: Vérifier que le module se charge (sans erreur de syntaxe)**

Démarrer le serveur et confirmer que `book3d.js` et le vendor sont servis :
```
$job = Start-Job -ScriptBlock { Set-Location "C:\Users\NicolasRossel\OneDrive - Abilene Advisors SA\Desktop\Dev\Learning\Python\Library"; $env:LIBRARY_PORT="8131"; & ".\.venv\Scripts\python.exe" webapp.py }
Start-Sleep -Seconds 4
try {
  (Invoke-WebRequest "http://127.0.0.1:8131/static/book3d.js" -UseBasicParsing).StatusCode
  (Invoke-WebRequest "http://127.0.0.1:8131/static/vendor/three.module.js" -UseBasicParsing).StatusCode
} finally { Stop-Job $job; Remove-Job $job }
```
Expected: `200` puis `200`.

- [ ] **Step 3: Commit**

```bash
git add static/book3d.js
git commit -m "feat: add Three.js closed-book 3D viewer module (book3d.js)"
```
(append trailer)

---

## Task 3 : Reconstruire le niveau 2 dans shelf.js

**Files:** Modify `static/shelf.js` (remplacement complet)

- [ ] **Step 1: Remplacer TOUT le contenu de `static/shelf.js`** par EXACTEMENT :

```javascript
// Étagère — navigation à 3 niveaux. Lecture seule.
// Niveau 0 : étagère (tranches sans titre). Clic saga -> niveau 1.
// Niveau 1 : vue focalisée d'un groupe de saga (titres visibles). Clic livre -> niveau 2.
// Niveau 2 : détail du livre = livre 3D fermé (book3d.js) + carte d'infos ; repli 2D sans WebGL.

const STATUTS = { non_lu: 'À lire', en_cours: 'En cours', lu: 'Lu' };
let book3dMod = null;          // module book3d.js (chargé paresseusement)
let book3dActif = false;       // un livre 3D est-il monté ?

// ---------- Niveau 0 -> 1 : focaliser un groupe de saga ----------
function focaliser(saga) {
  document.querySelectorAll('.saga.focalisee').forEach(s => s.classList.remove('focalisee'));
  document.querySelectorAll('.auteur.auteur-focus').forEach(a => a.classList.remove('auteur-focus'));
  saga.classList.add('focalisee');
  const auteur = saga.closest('.auteur');
  auteur.classList.add('auteur-focus');
  document.body.classList.add('mode-focus');
  const nom = (saga.dataset.saga && saga.dataset.saga !== 'Aucune')
    ? saga.dataset.saga
    : auteur.querySelector('.auteur-nom').textContent.trim();
  document.getElementById('focus-nom').textContent = nom;
}
function basculerSaga(elNom) { focaliser(elNom.closest('.saga')); }
function quitterFocus() {
  fermerLivre();
  document.body.classList.remove('mode-focus');
  document.querySelectorAll('.saga.focalisee').forEach(s => s.classList.remove('focalisee'));
  document.querySelectorAll('.auteur.auteur-focus').forEach(a => a.classList.remove('auteur-focus'));
}

// ---------- Niveau 1 -> 2 : ouvrir le détail d'un livre ----------
function choisirLivre(el) {
  if (!document.body.classList.contains('mode-focus')) { focaliser(el.closest('.saga')); return; }
  ouvrirLivre(el);
}

function ligne(parent, texte, classe) {
  const p = document.createElement('p');
  if (classe) p.className = classe;
  p.textContent = texte;          // textContent : pas d'injection HTML (SEC-W1)
  parent.appendChild(p);
}

function construireCarte(d) {
  const carte = document.createElement('div');
  carte.className = 'carte-infos';
  const h = document.createElement('h2'); h.textContent = d.titre; carte.appendChild(h);
  ligne(carte, d.auteur + (d.annee ? ' · ' + d.annee : ''), 'aut');
  if (d.saga && d.saga !== 'Aucune') {
    ligne(carte, 'Saga : ' + d.saga + (d.tome ? ' · Tome ' + d.tome : ''), '');
  }
  ligne(carte, 'Statut : ' + (STATUTS[d.statut] || d.statut) + (d.possede === '1' ? ' · Possédé ✓' : ''), '');
  if (d.note) ligne(carte, '★'.repeat(Number(d.note)), 'note');
  if (d.commentaire) ligne(carte, '« ' + d.commentaire + ' »', 'com');
  const crayon = document.createElement('button');
  crayon.className = 'crayon'; crayon.disabled = true;
  crayon.title = 'Modification — bientôt (Phase 3)'; crayon.textContent = '✏️ Modifier';
  carte.appendChild(crayon);
  return carte;
}

function webglDisponible() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
}

// Repli 2D : couverture en image (ou aplat couleur + titre si absente)
function couverture2D(d, couleur) {
  const div = document.createElement('div');
  div.className = 'couv-2d';
  div.style.background = couleur || '#444';
  div.textContent = d.titre;
  const isbn = (d.isbn || '').trim();
  if (isbn) {
    const img = document.createElement('img');
    img.referrerPolicy = 'no-referrer';
    img.alt = d.titre;
    img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover'; img.style.borderRadius = '4px';
    img.onload = () => { div.textContent = ''; div.style.background = 'none'; div.appendChild(img); };
    img.onerror = () => { /* on garde l'aplat couleur + titre */ };
    img.src = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
  }
  return div;
}

function ouvrirLivre(el) {
  const d = el.dataset;
  const couleur = el.style.getPropertyValue('--c');
  const overlay = document.getElementById('livre-ouvert');
  overlay.replaceChildren();

  const zone = document.createElement('div');
  zone.className = 'zone-livre';
  overlay.appendChild(zone);
  overlay.appendChild(construireCarte(d));
  overlay.classList.remove('cache');

  const donnees = { titre: d.titre, isbn: d.isbn, couleur };
  if (webglDisponible()) {
    import('/static/book3d.js')
      .then(mod => { book3dMod = mod; book3dActif = true; mod.ouvrir(zone, donnees); })
      .catch(() => { zone.appendChild(couverture2D(d, couleur)); });
  } else {
    zone.appendChild(couverture2D(d, couleur));
  }

  overlay.onclick = (e) => { if (e.target === overlay) fermerLivre(); };
}

function fermerLivre() {
  const overlay = document.getElementById('livre-ouvert');
  if (book3dActif && book3dMod) { book3dMod.fermer(); book3dActif = false; }
  overlay.classList.add('cache');
  overlay.replaceChildren();
  overlay.onclick = null;
}

// ---------- Recherche + filtre statut (niveau 0) ----------
let filtreStatut = '';
function appliquerFiltres() {
  const q = document.getElementById('recherche').value.trim().toLowerCase();
  document.querySelectorAll('.livre').forEach(livre => {
    const d = livre.dataset;
    const okTexte = !q ||
      d.titre.toLowerCase().includes(q) ||
      d.auteur.toLowerCase().includes(q) ||
      (d.saga || '').toLowerCase().includes(q);
    const okStatut = !filtreStatut || d.statut === filtreStatut;
    livre.classList.toggle('masque', !(okTexte && okStatut));
  });
  document.querySelectorAll('.saga').forEach(s => {
    s.style.display = s.querySelectorAll('.livre:not(.masque)').length ? '' : 'none';
  });
  document.querySelectorAll('.auteur').forEach(a => {
    a.style.display = a.querySelectorAll('.livre:not(.masque)').length ? '' : 'none';
  });
}

// ---------- Câblage ----------
document.getElementById('recherche').addEventListener('input', appliquerFiltres);
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('actif'));
    chip.classList.add('actif');
    filtreStatut = chip.dataset.statut;
    appliquerFiltres();
  });
});
document.getElementById('btn-retour').addEventListener('click', quitterFocus);
```

- [ ] **Step 2: Vérifier import + non-régression serveur**

Run: `.venv\Scripts\python.exe -c "import webapp; print('import ok')"` → `import ok`
Run: `$env:PYTHONIOENCODING='utf-8'; .venv\Scripts\python.exe test_webapp.py` → `OK : tests webapp passent.`

- [ ] **Step 3: Commit**

```bash
git add static/shelf.js
git commit -m "feat: level-2 book detail = 3D closed book + info card (drop CSS open-book)"
```
(append trailer)

---

## Task 4 : Styles de l'overlay (shelf.css)

**Files:** Modify `static/shelf.css` (remplacement complet)

- [ ] **Step 1: Remplacer TOUT le contenu de `static/shelf.css`** par EXACTEMENT :

```css
:root {
  --bois: #3a2817;
  --bois-fonce: #2b1d12;
  --texte-tranche: #f0e6d2;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, "Segoe UI", sans-serif; background: var(--bois-fonce); color: #eee; }
.entete { position: sticky; top: 0; z-index: 10; background: #1a110a; padding: 12px 20px; box-shadow: 0 2px 10px rgba(0,0,0,.5); }
.entete h1 { margin: 0 0 8px; font-size: 20px; }
.entete nav a { color: #c9a880; text-decoration: none; margin-right: 16px; font-weight: 600; }
.entete nav a:hover { color: #fff; }
.controles { display: flex; gap: 16px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
#recherche { padding: 6px 10px; border-radius: 6px; border: 1px solid #5a4a35; background: #2b1d12; color: #eee; min-width: 240px; }
.filtres { display: flex; gap: 6px; }
.chip { padding: 5px 12px; border-radius: 14px; border: 1px solid #5a4a35; background: transparent; color: #c9a880; cursor: pointer; font-size: 13px; }
.chip.actif { background: #c9a880; color: #1a110a; font-weight: 600; }

/* ---------- Niveau 0 : étagère, tranches SANS titre ---------- */
.auteur { padding: 18px 20px; }
.auteur-nom { color: #c9a880; font-size: 16px; margin: 0 0 10px; border-bottom: 1px solid #4a3826; padding-bottom: 4px; }
.saga { margin-bottom: 14px; }
.saga-nom { color: #b59a78; font-size: 13px; cursor: pointer; user-select: none; margin-bottom: 6px; }
.saga-nom:hover { color: #fff; }
.saga-compte { opacity: .6; }
.rangee { display: flex; align-items: flex-end; gap: 3px; background: linear-gradient(var(--bois), var(--bois-fonce)); border-bottom: 6px solid #1a110a; padding: 10px 8px; border-radius: 3px; overflow-x: auto; }
.livre { flex: 0 0 auto; width: 26px; height: 120px; background: var(--c, #555); border-radius: 2px; box-shadow: inset -3px 0 6px rgba(0,0,0,.45); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: height .25s, width .25s, transform .25s; }
.livre:hover { transform: translateY(-4px); }
.tranche-titre { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 10px; color: var(--texte-tranche); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-height: 110px; padding: 4px 0; }
.livre.masque { display: none; }
.tranche-titre { display: none; }                       /* titres masqués au niveau 0 */

/* ---------- Niveau 1 : vue focalisée ---------- */
.barre-focus { display: none; align-items: center; gap: 14px; background: #1a110a; padding: 10px 20px; box-shadow: 0 2px 10px rgba(0,0,0,.5); }
body.mode-focus .barre-focus { display: flex; }
#btn-retour { background: #2b1d12; border: 1px solid #5a4a35; color: #c9a880; border-radius: 6px; padding: 6px 12px; cursor: pointer; }
#btn-retour:hover { color: #fff; }
#focus-nom { color: #c9a880; font-weight: 600; font-size: 16px; }
body.mode-focus .auteur { display: none; }
body.mode-focus .auteur.auteur-focus { display: block; }
body.mode-focus .auteur.auteur-focus .auteur-nom { display: none; }
body.mode-focus .auteur.auteur-focus .saga { display: none; }
body.mode-focus .auteur.auteur-focus .saga.focalisee { display: block; }
body.mode-focus .auteur.auteur-focus .saga.focalisee .saga-nom { display: none; }
body.mode-focus .saga.focalisee .rangee { justify-content: center; min-height: 280px; }
body.mode-focus .saga.focalisee .livre { width: 60px; height: 240px; }
body.mode-focus .saga.focalisee .tranche-titre { display: block; font-size: 13px; max-height: 220px; }

/* ---------- Niveau 2 : détail du livre (3D fermé + infos) ---------- */
.livre-ouvert {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(10,7,4,.80);
  display: flex; align-items: center; justify-content: center; gap: 40px; flex-wrap: wrap; padding: 24px;
}
.livre-ouvert.cache { display: none; }
.zone-livre { width: min(46vw, 420px); height: min(70vh, 560px); display: flex; align-items: center; justify-content: center; }
.zone-livre canvas { width: 100%; height: 100%; cursor: grab; touch-action: none; }
.zone-livre canvas:active { cursor: grabbing; }
.couv-2d { width: 240px; height: 340px; border-radius: 4px; background-size: cover; background-position: center; box-shadow: 0 12px 32px rgba(0,0,0,.6); display: flex; align-items: flex-end; padding: 10px; color: #fff; font-weight: bold; overflow: hidden; }
.carte-infos { width: 320px; background: #1a110a; color: #eee; border-radius: 12px; padding: 24px; box-shadow: 0 12px 40px rgba(0,0,0,.6); border: 1px solid #4a3826; }
.carte-infos h2 { margin: 0 0 2px; font-size: 22px; }
.carte-infos .aut { color: #c9a880; margin: 0 0 16px; }
.carte-infos p { margin: 6px 0; font-size: 15px; }
.carte-infos .note { color: #b8860b; font-size: 18px; }
.carte-infos .com { font-style: italic; color: #9a8a6a; margin-top: 14px; }
.carte-infos .crayon { margin-top: 18px; background: #2b1d12; border: 1px solid #5a4a35; color: #c9a880; border-radius: 8px; padding: 6px 12px; opacity: .6; cursor: not-allowed; pointer-events: none; }

.vide { padding: 40px; text-align: center; color: #b59a78; }
```

- [ ] **Step 2: Non-régression serveur**

Run: `$env:PYTHONIOENCODING='utf-8'; .venv\Scripts\python.exe test_webapp.py` → `OK : tests webapp passent.`

- [ ] **Step 3: Commit**

```bash
git add static/shelf.css
git commit -m "feat: style the level-2 overlay (3D book zone + info card); drop animated-book styles"
```
(append trailer)

---

## Task 5 : Vérification

- [ ] **Step 1: Suite serveur complète**

```bash
$env:PYTHONIOENCODING='utf-8'
.venv\Scripts\python.exe test_book.py
.venv\Scripts\python.exe test_database.py
.venv\Scripts\python.exe test_migration.py
.venv\Scripts\python.exe test_scanner.py
.venv\Scripts\python.exe test_shelf.py
.venv\Scripts\python.exe test_webapp.py
```
Expected : chaque fichier affiche sa ligne `OK`.

- [ ] **Step 2: Vérification manuelle au navigateur**

Run: `.venv\Scripts\python.exe webapp.py` puis ouvrir http://127.0.0.1:8000 :
1. Niveaux 0 et 1 inchangés (étagère sans titres → clic saga → vue focalisée + retour).
2. Clic sur un livre → overlay : **livre 3D fermé** à gauche (vraie couverture si ISBN connu, sinon couverture générée colorée), **carte d'infos** à droite.
3. Le livre se **balance** doucement ; **glisser** le fait tourner.
4. **Clic en dehors** → fermeture ; rouvrir un autre livre fonctionne (pas de fuite de contexte WebGL).
5. Sur fenêtre étroite, livre et infos s'**empilent**.
6. `/wishlist` se comporte pareil.
Fermer avec Ctrl+C.

- [ ] **Step 3: `git status` propre**, `library.db` toujours ignoré.
