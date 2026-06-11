# D — Scan code-barres mobile (caméra) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scanner le code-barres EAN-13 d'un livre avec la caméra du téléphone : en D1, remplir le champ ISBN de la modale et déclencher la recherche C2 ; en D2, encoder une pile de livres en série (lookup + insertion directe, anti-rebond, anti-doublon, toasts).

**Architecture:** `BarcodeDetector` natif (Chrome Android — boutons masqués si l'API manque, zéro régression desktop/iOS). La logique **pure** (`estIsbnScanne`, `antiRebond`, `livreDepuisScan`) vit dans `web/scan-logic.mjs` (testable node). La caméra + l'overlay vivent dans `web/scan.js` (module ESM qui expose `window.scanDisponible` / `window.demarrerScan`, comme `app.js` expose `window.lookupIsbn`). D1 se câble dans `isbn.js`, D2 dans `app.js` (`window.ajouterLivreScan` réutilise `validerLivre` + dédup C1).

**Tech Stack:** `BarcodeDetector`, `getUserMedia`, JavaScript ESM pur, supabase-js v2, tests node (`node:assert`).

> ⚠️ Node n'est pas installé sur la machine Windows locale : les étapes « Run: node … » sont
> vérifiées par la **CI** (`.github/workflows/tests.yml`) à chaque push, ou localement après
> installation de Node.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `web/scan-logic.mjs` | **Nouveau.** Logique **pure** : `estIsbnScanne` (EAN 978/979), `antiRebond` (fenêtre glissante), `livreDepuisScan` (payload D2 avec défauts). Aucune I/O. |
| `web/test_scan_logic.mjs` | **Nouveau.** Tests node des fonctions pures. |
| `web/scan.js` | **Nouveau.** Module ESM : disponibilité (`BarcodeDetector` + `ean_13` + caméra), overlay vidéo (visée, ✕, toasts), boucle `detect()` ~5 fps, arrêt systématique des pistes. Expose `window.scanDisponible()` et `window.demarrerScan({ continu, surIsbn, surFermeture })`. |
| `web/isbn.js` | **Modif (D1).** Bouton 📷 → `demarrerScan` ; à la détection : remplit `#f-isbn`, ferme, lance `rechercherIsbn()`. |
| `web/app.js` | **Modif (D2).** `window.ajouterLivreScan(brut)` (validerLivre + dédup + insert + maj `livresCharges`) ; câblage du bouton « 📷 Scanner une pile ». |
| `web/index.html` | **Modif.** Bouton `#btn-scan` dans `.ligne-isbn` (D1) ; bouton `#btn-scan-pile` dans l'en-tête (D2) ; les deux `hidden` par défaut ; inclusion de `scan.js` (module). |
| `web/shelf.css` | **Modif.** Overlay caméra, cadre de visée, toasts. |
| `web/sw.js` | **Modif.** `scan.js` + `scan-logic.mjs` dans la coquille ; bump `biblio-v3`. |
| `.github/workflows/tests.yml` | **Modif.** Ajouter `node web/test_scan_logic.mjs`. |

> `antiRebond` est en **fenêtre glissante** : tant que le même code reste devant la caméra,
> l'horodatage est rafraîchi à chaque détection → un livre tenu dans le champ n'est jamais
> retraité ; il faut le retirer ~3 s (ou présenter un autre code) pour qu'il redevienne éligible.

---

### Task 1 : Logique pure — `estIsbnScanne` + `antiRebond`

**Files:**
- Create: `web/scan-logic.mjs`
- Test: `web/test_scan_logic.mjs`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `web/test_scan_logic.mjs` :

```js
import assert from 'node:assert';
import { estIsbnScanne, antiRebond } from './scan-logic.mjs';

// estIsbnScanne : EAN-13 préfixé 978/979 uniquement
assert.strictEqual(estIsbnScanne('9782290424551'), true, '978 accepté');
assert.strictEqual(estIsbnScanne('9791028110109'), true, '979 accepté');
assert.strictEqual(estIsbnScanne('9772290424556'), false, '977 (presse) rejeté');
assert.strictEqual(estIsbnScanne('3017620422003'), false, 'EAN produit rejeté');
assert.strictEqual(estIsbnScanne('97822904'), false, 'EAN-8 rejeté');
assert.strictEqual(estIsbnScanne('https://exemple.fr'), false, 'QR texte rejeté');
assert.strictEqual(estIsbnScanne(''), false, 'vide rejeté');
assert.strictEqual(estIsbnScanne(null), false, 'null rejeté');

// antiRebond : fenêtre glissante de 3 s par défaut
const A = '9782290424551', B = '9791028110109';
let r = antiRebond(A, null, 1000);
assert.strictEqual(r.accepte, true, 'premier scan accepté');
r = antiRebond(A, r.etat, 1200);
assert.strictEqual(r.accepte, false, 'même code immédiat ignoré');
r = antiRebond(A, r.etat, 3500);
assert.strictEqual(r.accepte, false, 'fenêtre glissante : rafraîchie à 1200, 3500-1200 < 3000');
r = antiRebond(B, r.etat, 3600);
assert.strictEqual(r.accepte, true, 'autre code accepté');
r = antiRebond(A, r.etat, 9999);
assert.strictEqual(r.accepte, true, 'même code après expiration accepté');

console.log('OK : Task 1 (estIsbnScanne + antiRebond) passe.');
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `node web/test_scan_logic.mjs`
Expected: FAIL — `Cannot find module '.../scan-logic.mjs'`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `web/scan-logic.mjs` :

```js
// Logique pure du scan code-barres (sans DOM ni caméra). Testable avec node.

// Un code scanné est un ISBN si : 13 chiffres, préfixe GS1 « livre » 978/979.
export function estIsbnScanne(code) {
  return /^97[89]\d{10}$/.test(String(code ?? '').trim());
}

// Anti-rebond à fenêtre glissante : un même code tenu devant la caméra rafraîchit son
// horodatage à chaque détection, donc n'est jamais retraité tant qu'il reste visible.
// etat = { dernier, depuis } ou null. Renvoie { accepte, etat }.
export function antiRebond(isbn, etat, maintenant, delaiMs = 3000) {
  const memeRecent = etat && etat.dernier === isbn && (maintenant - etat.depuis) < delaiMs;
  return { accepte: !memeRecent, etat: { dernier: isbn, depuis: maintenant } };
}
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `node web/test_scan_logic.mjs`
Expected: PASS — `OK : Task 1 (estIsbnScanne + antiRebond) passe.`

- [ ] **Step 5: Commit**

```bash
git add web/scan-logic.mjs web/test_scan_logic.mjs
git commit -m "feat: D pure core — estIsbnScanne (EAN 978/979) + antiRebond fenêtre glissante (node tests)"
```

---

### Task 2 : Logique pure — `livreDepuisScan` (payload D2)

**Files:**
- Modify: `web/scan-logic.mjs`
- Test: `web/test_scan_logic.mjs`

- [ ] **Step 1: Étendre le test (qui échoue)**

Ajouter à `web/test_scan_logic.mjs` (avant le `console.log` final, qu'on remplace) :

```js
import { livreDepuisScan } from './scan-logic.mjs';   // ← fusionner avec l'import existant

// livreDepuisScan : payload d'insertion directe avec défauts « pile de livres possédés »
const payload = livreDepuisScan(
  { titre: " L'Apprenti assassin ", auteur: 'Robin Hobb', annee: 1998, saga: "L'Assassin royal", tome: '1' },
  '9782290424551'
);
assert.strictEqual(payload.titre, "L'Apprenti assassin", 'titre trimé');
assert.strictEqual(payload.auteur, 'Robin Hobb');
assert.strictEqual(payload.annee_publication, '1998', 'année en chaîne (format formulaire)');
assert.strictEqual(payload.isbn, '9782290424551');
assert.strictEqual(payload.saga, "L'Assassin royal");
assert.strictEqual(payload.tome, '1');
assert.strictEqual(payload.statut_lecture, 'non_lu', 'défaut : à lire');
assert.strictEqual(payload.possede, true, 'défaut : possédé');
assert.strictEqual(payload.wishlist, false);
assert.strictEqual(payload.note, '', 'note vide (normalisée par validerLivre)');
assert.strictEqual(payload.commentaire, '');

// champs lookup absents → vides (jamais undefined)
const vide = livreDepuisScan({ titre: 'X', auteur: 'Y' }, '9791028110109');
assert.strictEqual(vide.annee_publication, '');
assert.strictEqual(vide.saga, '');
assert.strictEqual(vide.tome, '');

console.log('OK : Tasks 1-2 (scan-logic) passent.');
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `node web/test_scan_logic.mjs`
Expected: FAIL — `livreDepuisScan` n'est pas exporté.

- [ ] **Step 3: Écrire l'implémentation minimale**

Ajouter à `web/scan-logic.mjs` :

```js
// Payload d'insertion D2 (format formulaire, normalisé ensuite par validerLivre).
// Défauts « pile de livres physiques qu'on possède » : à lire, possédé, pas wishlist.
export function livreDepuisScan(livreLookup, isbn) {
  const l = livreLookup || {};
  return {
    titre: String(l.titre ?? '').trim(),
    auteur: String(l.auteur ?? '').trim(),
    annee_publication: l.annee != null && l.annee !== '' ? String(l.annee) : '',
    isbn,
    saga: String(l.saga ?? '').trim(),
    tome: l.tome != null ? String(l.tome) : '',
    statut_lecture: 'non_lu',
    possede: true,
    wishlist: false,
    note: '',
    commentaire: '',
  };
}
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `node web/test_scan_logic.mjs`
Expected: PASS — `OK : Tasks 1-2 (scan-logic) passent.`

- [ ] **Step 5: Commit**

```bash
git add web/scan-logic.mjs web/test_scan_logic.mjs
git commit -m "feat: D livreDepuisScan — payload insertion directe avec défauts non_lu/possede (node tests)"
```

---

### Task 3 : `scan.js` — caméra, overlay, boucle de détection

**Files:**
- Create: `web/scan.js`
- Modify: `web/index.html`, `web/shelf.css`

- [ ] **Step 1: Créer le module caméra**

Créer `web/scan.js` :

```js
// Scan caméra (BarcodeDetector natif). Boutons masqués si l'API manque (desktop/iOS) :
// la saisie manuelle + 🔍 Rechercher (C2) restent le repli universel.
// Expose window.scanDisponible() et window.demarrerScan({ continu, surIsbn, surFermeture }).
import { estIsbnScanne, antiRebond } from './scan-logic.mjs';

const INTERVALLE_MS = 200;   // ~5 détections/s — suffisant et économe en batterie

let flux = null, minuteur = null, overlay = null;

async function scanDisponible() {
  try {
    if (!('BarcodeDetector' in window)) return false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    const formats = await window.BarcodeDetector.getSupportedFormats();
    return formats.includes('ean_13');
  } catch (e) { return false; }
}

function construireOverlay() {
  const o = document.createElement('div');
  o.id = 'scan-overlay'; o.className = 'scan-overlay';
  const video = document.createElement('video');
  video.className = 'scan-video';
  video.setAttribute('playsinline', '');   // iOS/anciens Chrome : pas de plein écran forcé
  video.muted = true;
  const visee = document.createElement('div'); visee.className = 'scan-visee';
  const toasts = document.createElement('div'); toasts.className = 'scan-toasts';
  const fermer = document.createElement('button');
  fermer.type = 'button'; fermer.className = 'scan-fermer'; fermer.textContent = '✕';
  o.append(video, visee, toasts, fermer);
  document.body.appendChild(o);
  return { o, video, toasts, fermer };
}

function toast(conteneur, texte, type) {
  const t = document.createElement('p');
  t.className = 'scan-toast' + (type ? ' ' + type : '');
  t.textContent = texte;                    // SEC-W1 : jamais innerHTML
  conteneur.prepend(t);
  setTimeout(() => t.remove(), 4000);
  while (conteneur.children.length > 4) conteneur.lastChild.remove();
}

function arreterScan(surFermeture) {
  if (minuteur) { clearInterval(minuteur); minuteur = null; }
  if (flux) { flux.getTracks().forEach(p => p.stop()); flux = null; }   // LED caméra éteinte, toujours
  if (overlay) { overlay.remove(); overlay = null; }
  if (surFermeture) surFermeture();
}

// continu=false (D1) : ferme après le premier ISBN. continu=true (D2) : reste ouvert,
// anti-rebond, surIsbn(isbn, ui) reçoit ui.toast pour le retour visuel.
async function demarrerScan({ continu = false, surIsbn, surFermeture } = {}) {
  if (overlay) return;                      // déjà ouvert
  const ui = construireOverlay();
  overlay = ui.o;
  const fermer = () => arreterScan(surFermeture);
  ui.fermer.addEventListener('click', fermer);

  try {
    flux = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }, audio: false,
    });
  } catch (e) {
    fermer();
    throw new Error('camera_refusee');      // l'appelant affiche son message
  }
  ui.video.srcObject = flux;
  await ui.video.play();

  const detecteur = new window.BarcodeDetector({ formats: ['ean_13'] });
  let etat = null, occupe = false;
  minuteur = setInterval(async () => {
    if (occupe || !flux) return;
    occupe = true;
    try {
      const codes = await detecteur.detect(ui.video);
      for (const c of codes) {
        const brut = (c.rawValue || '').trim();
        if (!estIsbnScanne(brut)) continue;            // EAN produit / QR : ignorés
        const r = antiRebond(brut, etat, Date.now());
        etat = r.etat;
        if (!r.accepte) continue;
        if (navigator.vibrate) navigator.vibrate(80);
        if (!continu) { arreterScan(surFermeture); }
        await surIsbn(brut, { toast: (txt, type) => ui.toasts && toast(ui.toasts, txt, type) });
        if (!continu) return;
      }
    } catch (e) { /* frame illisible : on retente au tick suivant */ }
    occupe = false;
  }, INTERVALLE_MS);
}

// Révèle le bouton D1 si le scan est possible (le D2 est révélé par app.js, module exécuté après).
(async () => {
  if (await scanDisponible()) {
    const btn = document.getElementById('btn-scan');
    if (btn) btn.hidden = false;
  }
})();

window.scanDisponible = scanDisponible;
window.demarrerScan = demarrerScan;
```

> **Ordre de chargement** : `isbn.js` est un script **classique** exécuté avant les modules →
> `window.scanDisponible` n'y existe pas encore. C'est donc `scan.js` qui révèle `#btn-scan`,
> et `scan.js` est inclus **avant** `app.js` (les modules s'exécutent dans l'ordre du document)
> pour qu'`app.js` puisse révéler `#btn-scan-pile`.

- [ ] **Step 2: Boutons (masqués par défaut) + inclusion**

Dans `web/index.html` :

```html
<!-- dans .ligne-isbn, après #btn-isbn -->
<button type="button" id="btn-scan" class="btn-isbn" hidden>📷 Scanner</button>

<!-- dans #controles, avant #btn-deconnexion -->
<button id="btn-scan-pile" hidden>📷 Scanner une pile</button>

<!-- avant isbn.js -->
<script type="module" src="./scan.js"></script>
```

- [ ] **Step 3: Styles**

Dans `web/shelf.css` :

```css
/* --- Scan caméra (D) --- */
.scan-overlay { position: fixed; inset: 0; background: #000; z-index: 60; }
.scan-video { width: 100%; height: 100%; object-fit: cover; }
.scan-visee {
  position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%);
  width: min(72vw, 420px); height: 130px; border: 2px solid rgba(255,255,255,.85);
  border-radius: 10px; box-shadow: 0 0 0 100vmax rgba(0,0,0,.35); pointer-events: none;
}
.scan-fermer {
  position: absolute; top: 14px; right: 14px; width: 44px; height: 44px;
  border-radius: 50%; border: 1px solid #5a4a35; background: #2b1d12; color: #c9a880;
  font-size: 20px; cursor: pointer;
}
.scan-toasts { position: absolute; left: 12px; right: 12px; bottom: 16px; display: flex; flex-direction: column; gap: 6px; }
.scan-toast { margin: 0; padding: 8px 12px; border-radius: 8px; background: rgba(43,29,18,.92); color: #eee; border: 1px solid #5a4a35; }
.scan-toast.ok { border-color: #4a7a4a; }
.scan-toast.erreur { border-color: #8a4a3a; }
```

- [ ] **Step 4: Vérification rapide (desktop)**

Servir `web/` (`python -m http.server 8000 --directory web`) : l'app est **identique à
aujourd'hui** (boutons 📷 absents du rendu, aucune erreur console).

- [ ] **Step 5: Commit**

```bash
git add web/scan.js web/index.html web/shelf.css
git commit -m "feat: D scan.js — overlay caméra + BarcodeDetector + arrêt systématique des pistes"
```

---

### Task 4 : D1 — câblage scan unique dans la modale

**Files:**
- Modify: `web/isbn.js`

- [ ] **Step 1: Câbler le clic (le bouton est révélé par `scan.js`)**

Ajouter à `web/isbn.js` :

```js
// --- Scan caméra (D1) : remplit l'ISBN puis lance la recherche C2 ---
// Le bouton est révélé par scan.js (module) uniquement si BarcodeDetector + caméra dispo.
document.getElementById('btn-scan').addEventListener('click', async () => {
  const statut = document.getElementById('isbn-statut');
  try {
    await window.demarrerScan({
      continu: false,
      surIsbn: async (isbn) => {
        document.getElementById('f-isbn').value = isbn;
        await rechercherIsbn();              // recherche C2 déclenchée automatiquement
      },
    });
  } catch (e) {
    statut.textContent = 'Caméra indisponible ou refusée — saisis l\'ISBN à la main.';
  }
});
```

- [ ] **Step 2: Vérification manuelle (téléphone Android, voir checklist Task 7)**

- [ ] **Step 3: Commit**

```bash
git add web/isbn.js
git commit -m "feat: D1 bouton 📷 modale — scan unique, remplit l'ISBN et lance la recherche C2"
```

---

### Task 5 : D2 — `ajouterLivreScan` + mode rafale

**Files:**
- Modify: `web/app.js`

- [ ] **Step 1: Insertion directe réutilisant validerLivre + dédup**

Ajouter à `web/app.js` (section C1, après le handler de suppression) :

```js
// ---------- Scan en rafale (D2) ----------
import { livreDepuisScan } from './scan-logic.mjs';   // ← fusionner avec l'import existant

// Insertion directe d'un livre scanné. Renvoie { ok, raison?, titre? } — pas d'exception.
window.ajouterLivreScan = async (livreLookup, isbn) => {
  const v = validerLivre(livreDepuisScan(livreLookup, isbn));
  if (!v.ok) return { ok: false, raison: v.erreur };
  const dup = doublon(v.livre);
  if (dup) return { ok: false, raison: 'doublon', titre: dup.titre };
  const { data: { session } } = await client.auth.getSession();
  if (!session) return { ok: false, raison: 'session' };
  const { data, error } = await client.from('books')
    .insert({ ...v.livre, user_id: session.user.id }).select().single();
  if (error) return { ok: false, raison: error.message };
  livresCharges.push(data);                 // dédup à jour pendant la session de scan
  return { ok: true, titre: data.titre };
};

// Bouton « Scanner une pile » : visible si scan dispo, actif en ligne uniquement.
(async () => {
  const btn = document.getElementById('btn-scan-pile');
  if (!(window.scanDisponible && await window.scanDisponible())) return;
  btn.hidden = false;
  btn.addEventListener('click', async () => {
    if (!navigator.onLine) { afficherBandeau(null); return; }
    let ajoutes = 0;
    try {
      await window.demarrerScan({
        continu: true,
        surIsbn: async (isbn, ui) => {
          ui.toast('Recherche ' + isbn + '…');
          let resultat;
          try { resultat = await window.lookupIsbn(isbn); }
          catch (e) { ui.toast('Erreur de recherche — réessaie.', 'erreur'); return; }
          if (!resultat || !resultat.trouve) { ui.toast('Introuvable : ' + isbn + ' — ajout manuel', 'erreur'); return; }
          const r = await window.ajouterLivreScan(resultat.livre, isbn);
          if (r.ok) { ajoutes++; ui.toast('Ajouté : ' + r.titre, 'ok'); }
          else if (r.raison === 'doublon') ui.toast('Déjà dans la collection : ' + r.titre, 'erreur');
          else if (r.raison === 'session') ui.toast('Session expirée — reconnecte-toi.', 'erreur');
          else ui.toast('Échec : ' + r.raison, 'erreur');
        },
        surFermeture: async () => { if (ajoutes > 0) await chargerLivres(); },  // un seul rechargement
      });
    } catch (e) { /* caméra refusée : overlay déjà fermé */ }
  });
})();
```

- [ ] **Step 2: Vérification statique**

Desktop : aucune régression (bouton masqué) ; `node web/test_scan_logic.mjs` passe toujours.

- [ ] **Step 3: Commit**

```bash
git add web/app.js
git commit -m "feat: D2 mode rafale — ajouterLivreScan (validerLivre + dédup + RLS), toasts, rechargement unique"
```

---

### Task 6 : Service worker + CI

**Files:**
- Modify: `web/sw.js`, `.github/workflows/tests.yml`

- [ ] **Step 1: Coquille + bump de cache**

Dans `web/sw.js` :

```js
const CACHE = 'biblio-v3';   // ← bump (nouveaux fichiers dans la coquille)
const COQUILLE = [
  './', './index.html', './config.js', './app.js', './shelf.js', './isbn.js', './shelf-logic.mjs',
  './scan.js', './scan-logic.mjs',
  './book3d.js', './shelf.css', './manifest.webmanifest', './icon.svg',
  './vendor/supabase.js', './vendor/three.module.js',
];
```

- [ ] **Step 2: CI**

Dans `.github/workflows/tests.yml`, ajouter :

```yaml
      - name: Tests logique scan
        run: node web/test_scan_logic.mjs
```

- [ ] **Step 3: Commit**

```bash
git add web/sw.js .github/workflows/tests.yml
git commit -m "chore: D scan.js/scan-logic.mjs dans la coquille SW (biblio-v3) + test scan en CI"
```

---

### Task 7 : Checklist manuelle (Android, site déployé) + PR

- [ ] **D1 :**
  1. Modale d'ajout → 📷 visible → scanner un livre français → ISBN rempli, champs C2
     remplis (BnF), vibration.
  2. Refuser la permission caméra → message dans `#isbn-statut`, saisie manuelle OK.
  3. ✕ → fermeture immédiate, LED caméra éteinte.
- [ ] **D2 :**
  4. « Scanner une pile » → scanner 3 livres → 3 toasts « Ajouté », étagère à jour après ✕.
  5. Re-scanner un livre ajouté → « Déjà dans la collection » (pas d'écriture).
  6. Garder un livre devant la caméra → ajouté **une seule fois** (anti-rebond).
  7. Code-barres non-ISBN (produit) → ignoré, le scan continue.
  8. ISBN introuvable → toast « Introuvable », pas d'écriture.
- [ ] **Non-régression :**
  9. Desktop Windows : aucun bouton 📷, B1/B2/C1/C2 intacts.
  10. Hors-ligne (téléphone) : lecture OK, « Scanner une pile » sans effet d'écriture,
      recherche C2 → message hors-ligne.
- [ ] **PR :** ouvrir la PR `supabase-d-scan` → `main` (la CI doit être verte), merger après
  validation de la checklist.
