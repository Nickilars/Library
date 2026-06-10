# Sous-projet C1 — Écriture web (CRUD manuel) · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter l'ajout / modification / suppression de livres depuis le web (modale), avec validation + détection de doublon, écrits dans Supabase (RLS propriétaire) ; réactiver le bouton ✏️.

**Architecture:** `validerLivre` (pure) rejoint `shelf-logic.mjs` (testée node). `app.js` (qui détient le client Supabase + le rendu + le rechargement) gère la modale, la validation, la détection de doublon (sur la liste déjà chargée), et les `insert`/`update`/`delete` ; il expose `window.ouvrirEdition(id)` que le ✏️ de `shelf.js` appelle. Écriture **en ligne uniquement**.

**Tech Stack:** JS vanilla, supabase-js (déjà vendoré), `node` pour le test pur. Le CRUD/modale se vérifie manuellement (nécessite tes identifiants Supabase).

**Conventions :** Windows/PowerShell. Commits en anglais terminés par :
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Structure des fichiers

| Fichier | Changement |
|---|---|
| `web/shelf-logic.mjs` | Ajout `validerLivre(livre)` (pure, exportée) |
| `web/test_shelf_logic.mjs` | Cas de test `validerLivre` |
| `web/index.html` | Bouton « ➕ Ajouter » + modale `#modale-edition` |
| `web/shelf.css` | Styles modale + bouton « ➕ Ajouter » ; rend le ✏️ cliquable |
| `web/app.js` | Modale + CRUD + doublon + garde-fou hors-ligne + `window.ouvrirEdition` (remplacement complet) |
| `web/shelf.js` | Réactive le ✏️ → `window.ouvrirEdition(d.id)` |

---

## Task 1 : `validerLivre` (pure) + test node

**Files:** Modify `web/shelf-logic.mjs`, `web/test_shelf_logic.mjs`

- [ ] **Step 1: Ajouter les tests** dans `web/test_shelf_logic.mjs` — ajouter `validerLivre` à l'import existant et insérer les assertions AVANT la ligne finale `console.log(...)`.

Remplacer la ligne d'import :
```javascript
import { grouperLivres, couleurTranche } from './shelf-logic.mjs';
```
par :
```javascript
import { grouperLivres, couleurTranche, validerLivre } from './shelf-logic.mjs';
```

Insérer avant `console.log('OK : tests shelf-logic passent.');` :
```javascript
// validerLivre : champs requis
assert.strictEqual(validerLivre({ titre: '', auteur: 'A', statut_lecture: 'lu' }).ok, false, 'titre requis');
assert.strictEqual(validerLivre({ titre: 'T', auteur: '', statut_lecture: 'lu' }).ok, false, 'auteur requis');
// statut invalide
assert.strictEqual(validerLivre({ titre: 'T', auteur: 'A', statut_lecture: 'zzz' }).ok, false, 'statut');
// note hors bornes
assert.strictEqual(validerLivre({ titre: 'T', auteur: 'A', statut_lecture: 'lu', note: 9 }).ok, false, 'note');
// isbn non 13 chiffres
assert.strictEqual(validerLivre({ titre: 'T', auteur: 'A', statut_lecture: 'lu', isbn: 'abc' }).ok, false, 'isbn');
// tome négatif
assert.strictEqual(validerLivre({ titre: 'T', auteur: 'A', statut_lecture: 'lu', tome: -1 }).ok, false, 'tome');
// cas valide normalisé
const rv = validerLivre({ titre: '  Dune ', auteur: ' Herbert ', statut_lecture: 'lu', saga: '', note: '', tome: '', isbn: '' });
assert.strictEqual(rv.ok, true, 'valide');
assert.strictEqual(rv.livre.titre, 'Dune');
assert.strictEqual(rv.livre.saga, 'Aucune');
assert.strictEqual(rv.livre.note, null);
assert.strictEqual(rv.livre.tome, null);
assert.strictEqual(rv.livre.possede, false);
```

- [ ] **Step 2: Lancer le test (échec attendu)** — `node web/test_shelf_logic.mjs` → erreur d'import (`validerLivre` n'existe pas encore).

- [ ] **Step 3: Ajouter `validerLivre` à `web/shelf-logic.mjs`** (à la fin du fichier) :

```javascript

// --- Validation d'un livre avant écriture (miroir de la Phase 1, SEC-2) ---
const STATUTS_VALIDES = new Set(['non_lu', 'en_cours', 'lu']);
const LONGUEUR_MAX = 500;

export function validerLivre(livre) {
  const titre = (livre.titre || '').trim();
  const auteur = (livre.auteur || '').trim();
  if (!titre) return { ok: false, erreur: 'Le titre est obligatoire.' };
  if (!auteur) return { ok: false, erreur: "L'auteur est obligatoire." };
  for (const [nom, val] of [['titre', titre], ['auteur', auteur], ['saga', livre.saga], ['commentaire', livre.commentaire]]) {
    if (val && val.length > LONGUEUR_MAX) return { ok: false, erreur: `Le champ ${nom} dépasse ${LONGUEUR_MAX} caractères.` };
  }
  if (!STATUTS_VALIDES.has(livre.statut_lecture)) return { ok: false, erreur: 'Statut de lecture invalide.' };

  let noteNorm = null;
  if (livre.note !== '' && livre.note !== null && livre.note !== undefined) {
    const n = Number(livre.note);
    if (!Number.isInteger(n) || n < 0 || n > 5) return { ok: false, erreur: 'La note doit être un entier entre 0 et 5.' };
    noteNorm = n;
  }

  const isbn = (livre.isbn || '').trim();
  if (isbn && !/^\d{13}$/.test(isbn)) return { ok: false, erreur: "L'ISBN doit comporter 13 chiffres." };

  let tomeNorm = null;
  if (livre.tome !== '' && livre.tome !== null && livre.tome !== undefined) {
    const t = Number(livre.tome);
    if (!Number.isInteger(t) || t < 0) return { ok: false, erreur: 'Le tome doit être un entier positif.' };
    tomeNorm = t;
  }

  return {
    ok: true,
    livre: {
      titre, auteur,
      annee_publication: (livre.annee_publication || '').trim(),
      isbn,
      saga: (livre.saga || '').trim() || 'Aucune',
      tome: tomeNorm,
      statut_lecture: livre.statut_lecture,
      possede: !!livre.possede,
      wishlist: !!livre.wishlist,
      note: noteNorm,
      commentaire: (livre.commentaire || '').trim(),
    },
  };
}
```

- [ ] **Step 4: Lancer le test (succès attendu)** — `node web/test_shelf_logic.mjs` → `OK : tests shelf-logic passent.`

- [ ] **Step 5: Commit** :
```powershell
git add web/shelf-logic.mjs web/test_shelf_logic.mjs
git commit -m "feat: add validerLivre (pure book validation) with node tests"
```
(append trailer)

---

## Task 2 : Modale + bouton Ajouter (index.html) et styles (shelf.css)

**Files:** Modify `web/index.html`, `web/shelf.css`

- [ ] **Step 1: Dans `web/index.html`, ajouter le bouton « ➕ Ajouter »** dans `#controles`, juste avant le bouton de déconnexion. Remplacer :
```html
      <button id="btn-deconnexion">Déconnexion</button>
```
par :
```html
      <button id="btn-ajouter">➕ Ajouter</button>
      <button id="btn-deconnexion">Déconnexion</button>
```

- [ ] **Step 2: Ajouter la modale** juste avant la ligne `<div id="livre-ouvert" class="livre-ouvert cache"></div>` :
```html
  <div id="modale-edition" class="modale cache">
    <form id="form-edition" class="form-edition">
      <h2 id="form-titre-modale">Ajouter un livre</h2>
      <input id="f-titre" placeholder="Titre *" required>
      <input id="f-auteur" placeholder="Auteur *" required>
      <input id="f-annee" placeholder="Année">
      <input id="f-isbn" placeholder="ISBN (13 chiffres)">
      <input id="f-saga" placeholder="Saga">
      <input id="f-tome" type="number" min="0" placeholder="Tome">
      <select id="f-statut">
        <option value="non_lu">À lire</option>
        <option value="en_cours">En cours</option>
        <option value="lu">Lu</option>
      </select>
      <label><input id="f-possede" type="checkbox"> Possédé</label>
      <label><input id="f-wishlist" type="checkbox"> Wishlist</label>
      <input id="f-note" type="number" min="0" max="5" placeholder="Note (0–5)">
      <textarea id="f-commentaire" placeholder="Commentaire"></textarea>
      <p id="form-erreur" class="form-erreur" hidden></p>
      <div class="form-actions">
        <button type="submit">Enregistrer</button>
        <button type="button" id="btn-supprimer" class="btn-supprimer" hidden>🗑️ Supprimer</button>
        <button type="button" id="btn-annuler">Annuler</button>
      </div>
    </form>
  </div>
```

- [ ] **Step 3: Dans `web/shelf.css`, rendre le ✏️ cliquable.** Lis le fichier, trouve la règle `.carte-infos .crayon { ... }` (elle contient `cursor: not-allowed; pointer-events: none;`) et remplace-la par :
```css
.carte-infos .crayon { margin-top: 18px; background: #2b1d12; border: 1px solid #5a4a35; color: #c9a880; border-radius: 8px; padding: 6px 12px; cursor: pointer; }
```

- [ ] **Step 4: Ajouter à la fin de `web/shelf.css`** les styles de la modale et du bouton Ajouter :
```css

/* ---------- Modale d'édition (C1) ---------- */
#btn-ajouter { background: #2b1d12; border: 1px solid #5a4a35; color: #c9a880; border-radius: 6px; padding: 6px 12px; cursor: pointer; }
.modale { position: fixed; inset: 0; z-index: 60; background: rgba(10,7,4,.8); display: flex; align-items: center; justify-content: center; padding: 20px; }
.modale.cache { display: none; }
.form-edition { width: 340px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: #1a110a; border: 1px solid #4a3826; border-radius: 12px; padding: 20px; }
.form-edition h2 { margin: 0; color: #c9a880; font-size: 18px; }
.form-edition input, .form-edition select, .form-edition textarea { padding: 8px; border-radius: 6px; border: 1px solid #5a4a35; background: #2b1d12; color: #eee; font: inherit; }
.form-edition textarea { min-height: 60px; resize: vertical; }
.form-edition label { color: #eee; font-size: 14px; display: flex; gap: 8px; align-items: center; }
.form-erreur { color: #ff6b6b; margin: 0; }
.form-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
.form-actions button { padding: 8px 12px; border-radius: 6px; border: none; cursor: pointer; }
.form-actions button[type=submit] { background: #c9a880; color: #1a110a; font-weight: 600; }
.btn-supprimer { background: #7a2a2a; color: #fff; }
#btn-annuler { background: #2b1d12; color: #c9a880; border: 1px solid #5a4a35; }
```

- [ ] **Step 5: Vérifier** — `Select-String -Path web/index.html -Pattern "btn-ajouter|modale-edition|f-titre"` → les trois apparaissent ; `Select-String -Path web/shelf.css -Pattern "pointer-events: none"` ne doit **plus** matcher dans la règle `.crayon` (il ne doit rester aucune occurrence de `pointer-events: none`).

- [ ] **Step 6: Commit** :
```powershell
git add web/index.html web/shelf.css
git commit -m "feat: add edit modal + Add button; make the edit pencil clickable"
```
(append trailer)

---

## Task 3 : Logique CRUD dans app.js

**Files:** Modify `web/app.js` (remplacement complet)

- [ ] **Step 1: Remplacer TOUT `web/app.js`** par EXACTEMENT :

```javascript
// Frontend Supabase : auth, lecture (RLS), rendu, cache hors-ligne (B2), et écriture (C1).
import { grouperLivres, couleurTranche, validerLivre } from './shelf-logic.mjs';

const client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const elLogin = document.getElementById('login');
const elEtagere = document.getElementById('etagere');
const elControles = document.getElementById('controles');
const elErreur = document.getElementById('login-erreur');
const elBandeau = document.getElementById('bandeau-hors-ligne');

const elModale = document.getElementById('modale-edition');
const elForm = document.getElementById('form-edition');
const elFormErreur = document.getElementById('form-erreur');
const elFormTitre = document.getElementById('form-titre-modale');
const elBtnSupprimer = document.getElementById('btn-supprimer');

const CLE_LIVRES = 'biblio:livres';
const CLE_DATE = 'biblio:livres:date';

let livresCharges = [];   // dernière liste chargée (pour pré-remplir l'édition + détecter les doublons)
let editionId = null;     // null = ajout ; sinon id du livre en cours d'édition

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
    livresCharges = data;
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
    livresCharges = JSON.parse(cache);
    afficherBandeau(localStorage.getItem(CLE_DATE));
    construireEtagere(livresCharges);
  } else {
    livresCharges = [];
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

// ---------- Connexion ----------
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
  livresCharges = [];
  masquerBandeau();
  elEtagere.replaceChildren();
  montrerLogin();
});

// ---------- Édition (C1) ----------
function champ(id) { return document.getElementById(id); }
function erreurForm(msg) { elFormErreur.textContent = msg; elFormErreur.hidden = false; }

function ouvrirModale(livre) {
  editionId = livre ? livre.id : null;
  elFormTitre.textContent = livre ? 'Modifier le livre' : 'Ajouter un livre';
  champ('f-titre').value = livre ? (livre.titre || '') : '';
  champ('f-auteur').value = livre ? (livre.auteur || '') : '';
  champ('f-annee').value = livre ? (livre.annee_publication || '') : '';
  champ('f-isbn').value = livre ? (livre.isbn || '') : '';
  champ('f-saga').value = (livre && livre.saga && livre.saga !== 'Aucune') ? livre.saga : '';
  champ('f-tome').value = (livre && livre.tome != null) ? livre.tome : '';
  champ('f-statut').value = livre ? (livre.statut_lecture || 'non_lu') : 'non_lu';
  champ('f-possede').checked = !!(livre && livre.possede);
  champ('f-wishlist').checked = !!(livre && livre.wishlist);
  champ('f-note').value = (livre && livre.note != null) ? livre.note : '';
  champ('f-commentaire').value = livre ? (livre.commentaire || '') : '';
  elFormErreur.hidden = true;
  elBtnSupprimer.hidden = !livre;
  elModale.classList.remove('cache');
}
function fermerModale() { elModale.classList.add('cache'); editionId = null; }

// Appelé par le ✏️ de shelf.js
window.ouvrirEdition = (id) => {
  const l = livresCharges.find(b => String(b.id) === String(id));
  if (l) ouvrirModale(l);
};

function doublon(livre) {
  const isbn = (livre.isbn || '').trim();
  if (isbn) {
    const parIsbn = livresCharges.find(b => (b.isbn || '') === isbn);
    if (parIsbn) return parIsbn;
  }
  const t = livre.titre.toLowerCase(), a = livre.auteur.toLowerCase();
  return livresCharges.find(b => (b.titre || '').toLowerCase() === t && (b.auteur || '').toLowerCase() === a) || null;
}

elForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  elFormErreur.hidden = true;
  if (!navigator.onLine) { erreurForm('Action impossible hors-ligne.'); return; }
  const v = validerLivre({
    titre: champ('f-titre').value, auteur: champ('f-auteur').value,
    annee_publication: champ('f-annee').value, isbn: champ('f-isbn').value,
    saga: champ('f-saga').value, tome: champ('f-tome').value,
    statut_lecture: champ('f-statut').value,
    possede: champ('f-possede').checked, wishlist: champ('f-wishlist').checked,
    note: champ('f-note').value, commentaire: champ('f-commentaire').value,
  });
  if (!v.ok) { erreurForm(v.erreur); return; }

  if (editionId === null) {
    const dup = doublon(v.livre);
    if (dup) { erreurForm(`Doublon : « ${dup.titre} » de ${dup.auteur} est déjà dans la collection.`); return; }
    const { data: { session } } = await client.auth.getSession();
    const { error } = await client.from('books').insert({ ...v.livre, user_id: session.user.id });
    if (error) { erreurForm("Échec de l'ajout : " + error.message); return; }
  } else {
    const { error } = await client.from('books').update(v.livre).eq('id', editionId);
    if (error) { erreurForm('Échec de la modification : ' + error.message); return; }
  }
  fermerModale();
  await chargerLivres();
});

elBtnSupprimer.addEventListener('click', async () => {
  if (editionId === null) return;
  if (!navigator.onLine) { erreurForm('Action impossible hors-ligne.'); return; }
  if (!confirm('Supprimer définitivement ce livre ?')) return;
  const { error } = await client.from('books').delete().eq('id', editionId);
  if (error) { erreurForm('Échec de la suppression : ' + error.message); return; }
  fermerModale();
  await chargerLivres();
});

document.getElementById('btn-ajouter').addEventListener('click', () => ouvrirModale(null));
document.getElementById('btn-annuler').addEventListener('click', fermerModale);

// ---------- Démarrage ----------
(async function init() {
  const { data: { session } } = await client.auth.getSession();
  if (session) await montrerApp(); else montrerLogin();
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
```

- [ ] **Step 2: Vérifier la syntaxe** — `node --check web/app.js` → aucune sortie.

- [ ] **Step 3: Commit** :
```powershell
git add web/app.js
git commit -m "feat: web CRUD (add/edit/delete) modal with validation, dedup, RLS writes, online guard"
```
(append trailer)

---

## Task 4 : Réactiver le ✏️ (shelf.js)

**Files:** Modify `web/shelf.js`

- [ ] **Step 1: Remplacer le bloc du crayon** dans `construireCarte` de `web/shelf.js`. Remplacer :
```javascript
  const crayon = document.createElement('button');
  crayon.className = 'crayon'; crayon.disabled = true;
  crayon.title = 'Modification — bientôt (Phase 3)'; crayon.textContent = '✏️ Modifier';
  carte.appendChild(crayon);
```
par :
```javascript
  const crayon = document.createElement('button');
  crayon.className = 'crayon';
  crayon.title = 'Modifier ce livre'; crayon.textContent = '✏️ Modifier';
  crayon.addEventListener('click', () => {
    fermerLivre();
    if (window.ouvrirEdition) window.ouvrirEdition(d.id);
  });
  carte.appendChild(crayon);
```

- [ ] **Step 2: Vérifier la syntaxe** — `node --check web/shelf.js` → aucune sortie.

- [ ] **Step 3: Commit** :
```powershell
git add web/shelf.js
git commit -m "feat: re-enable the edit pencil to open the edit modal"
```
(append trailer)

---

## Task 5 : Vérification

- [ ] **Step 1: Contrôles automatiques** :
```powershell
node web/test_shelf_logic.mjs
node --check web/app.js
node --check web/shelf.js
```
Expected : `OK : tests shelf-logic passent.` puis aucune erreur de syntaxe.

- [ ] **Step 2: Vérification manuelle** (`web/config.js` renseigné) :
```powershell
python -m http.server 8000 --directory web
```
Sur http://127.0.0.1:8000, connecté :
1. **« ➕ Ajouter »** → remplir titre/auteur (+ champs) → **Enregistrer** → le livre apparaît sur l'étagère.
2. Cliquer un livre → **✏️ Modifier** → changer statut/note → **Enregistrer** → modif persistée (recharger la page le confirme).
3. ✏️ → **🗑️ Supprimer** → confirmer → le livre disparaît.
4. Ajouter un **doublon** (même ISBN, ou même titre+auteur) → **bloqué** + message dans la modale.
5. Champ invalide (titre vide, note 9, ISBN « abc ») → **message d'erreur**, pas d'écriture.
6. **Network → Offline** → tenter Ajouter/Enregistrer/Supprimer → message « impossible hors-ligne ».

- [ ] **Step 3: `git status` propre**.
