# C2 — Remplissage par ISBN (OpenLibrary + BnF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depuis la modale d'ajout, retrouver titre/auteur/année/saga/tome d'un livre par ISBN via une fonction Edge Supabase qui interroge OpenLibrary puis la BnF côté serveur.

**Architecture:** Une fonction Edge Deno (`supabase/functions/lookup`) fait les `fetch` OL/BnF (pas de CORS navigateur) et délègue le parsing/normalisation à un module **pur** `lookup-core.mjs` (sans I/O, testable en node). Côté client, `web/isbn.js` (script classique) gère le bouton/statut et appelle la fonction via `client.functions.invoke('lookup', …)` exposé par `app.js` (`window.lookupIsbn`), puis remplit les champs.

**Tech Stack:** Deno (Edge Function), JavaScript ESM pur (`lookup-core.mjs`), supabase-js v2 (`functions.invoke`), tests node (`node:assert`).

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `supabase/functions/lookup/lookup-core.mjs` | **Nouveau.** Logique **pure** : `nettoyerIsbn`, `isbnValide`, `extraireAnnee`, `normaliserOpenLibrary`, `parserUnimarc`. Aucune I/O. ESM JS (pas de types) → importable par Deno **et** node. |
| `supabase/functions/lookup/index.ts` | **Nouveau.** `Deno.serve` : valide l'ISBN, `fetch` OpenLibrary puis BnF, appelle les fonctions pures, renvoie JSON + en-têtes CORS, gère `OPTIONS`. |
| `web/test_lookup_core.mjs` | **Nouveau.** Tests node des fonctions pures (importe `../supabase/functions/lookup/lookup-core.mjs`). |
| `web/app.js` | **Modif.** Expose `window.lookupIsbn(isbn)` (appelle `client.functions.invoke('lookup', …)`). |
| `web/isbn.js` | **Nouveau.** Script classique : handler du bouton « 🔍 Rechercher », validation 13 chiffres, garde-fou hors-ligne, statut, remplit les champs via `.value`. |
| `web/index.html` | **Modif.** Bouton `#btn-isbn` + statut `#isbn-statut` autour de `#f-isbn` ; inclusion de `isbn.js`. |
| `web/shelf.css` | **Modif.** Style de la ligne ISBN (bouton + statut). |

> `lookup-core.mjs` est en **JavaScript pur** (pas de `.ts`) exprès : un seul fichier source sert à la fois la fonction Deno et le test node, donc pas de logique dupliquée à maintenir en double.

> Le parsing Unimarc se fait par **extraction regex** (datafield→subfield) en JS pur : aucune dépendance XML externe, identique en Deno et node. Acceptable car les notices SRU de la BnF sont générées et régulières.

---

### Task 1 : Module pur — nettoyage ISBN, validation, année

**Files:**
- Create: `supabase/functions/lookup/lookup-core.mjs`
- Test: `web/test_lookup_core.mjs`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `web/test_lookup_core.mjs` :

```js
import assert from 'node:assert';
import {
  nettoyerIsbn, isbnValide, extraireAnnee,
} from '../supabase/functions/lookup/lookup-core.mjs';

// nettoyerIsbn : retire espaces et tirets
assert.strictEqual(nettoyerIsbn('978-2-290-42455-1'), '9782290424551');
assert.strictEqual(nettoyerIsbn('  9782290424551 '), '9782290424551');

// isbnValide : 13 chiffres exactement
assert.strictEqual(isbnValide('9782290424551'), true);
assert.strictEqual(isbnValide('2290424551'), false, '10 chiffres rejeté');
assert.strictEqual(isbnValide('97822904245xx'), false, 'lettres rejetées');
assert.strictEqual(isbnValide(''), false, 'vide rejeté');

// extraireAnnee : premier nombre à 4 chiffres, sinon null
assert.strictEqual(extraireAnnee('August 1996'), 1996);
assert.strictEqual(extraireAnnee('impr. 2014'), 2014);
assert.strictEqual(extraireAnnee('1998-2000'), 1998, 'premier des deux');
assert.strictEqual(extraireAnnee(''), null);
assert.strictEqual(extraireAnnee(null), null);
assert.strictEqual(extraireAnnee('sans date'), null);

console.log('OK : Task 1 (isbn + année) passe.');
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `node web/test_lookup_core.mjs`
Expected: FAIL — `Cannot find module '.../lookup-core.mjs'`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `supabase/functions/lookup/lookup-core.mjs` :

```js
// Logique pure (sans réseau) pour la recherche par ISBN — partagée Deno + tests node.

export function nettoyerIsbn(brut) {
  return String(brut ?? '').replace(/[\s-]/g, '');
}

export function isbnValide(isbn) {
  return /^\d{13}$/.test(String(isbn ?? ''));
}

// Premier nombre à 4 chiffres trouvé dans la chaîne, en Number ; sinon null.
export function extraireAnnee(texte) {
  if (!texte) return null;
  const m = String(texte).match(/\d{4}/);
  return m ? Number(m[0]) : null;
}
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `node web/test_lookup_core.mjs`
Expected: PASS — `OK : Task 1 (isbn + année) passe.`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/lookup/lookup-core.mjs web/test_lookup_core.mjs
git commit -m "feat: C2 pure core — nettoyerIsbn, isbnValide, extraireAnnee (node tests)"
```

---

### Task 2 : Normalisation OpenLibrary

**Files:**
- Modify: `supabase/functions/lookup/lookup-core.mjs`
- Test: `web/test_lookup_core.mjs`

OpenLibrary (`jscmd=data`) renvoie un objet dont la clé est `"ISBN:<isbn>"`, par ex. :
`{ "ISBN:9780553573404": { "title": "...", "authors": [{ "name": "..." }], "publish_date": "August 1996" } }`.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `web/test_lookup_core.mjs`, avant la ligne `console.log` finale (et ajouter `normaliserOpenLibrary` à l'import du haut) :

```js
// normaliserOpenLibrary : extrait titre/auteur/année, saga/tome vides
const olJson = {
  'ISBN:9780553573404': {
    title: 'A Game of Thrones',
    authors: [{ name: 'George R. R. Martin' }],
    publish_date: 'August 1996',
  },
};
const ol = normaliserOpenLibrary(olJson, '9780553573404');
assert.strictEqual(ol.titre, 'A Game of Thrones');
assert.strictEqual(ol.auteur, 'George R. R. Martin');
assert.strictEqual(ol.annee, 1996);
assert.strictEqual(ol.saga, '');
assert.strictEqual(ol.tome, '');

// ISBN absent de la réponse -> null
assert.strictEqual(normaliserOpenLibrary({}, '9780553573404'), null);
// entrée sans titre -> null (on ne renvoie pas un livre sans titre)
assert.strictEqual(normaliserOpenLibrary({ 'ISBN:9780553573404': { authors: [] } }, '9780553573404'), null);

console.log('OK : Task 2 (OpenLibrary) passe.');
```

(Remplacer l'ancien `console.log` de Task 1 par celui-ci.)

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `node web/test_lookup_core.mjs`
Expected: FAIL — `normaliserOpenLibrary is not a function` (ou import indéfini).

- [ ] **Step 3: Écrire l'implémentation minimale**

Ajouter à `supabase/functions/lookup/lookup-core.mjs` :

```js
// data = JSON OpenLibrary (jscmd=data). Renvoie {titre,auteur,annee,saga,tome} ou null.
export function normaliserOpenLibrary(data, isbn) {
  const entree = data && data['ISBN:' + isbn];
  if (!entree || !entree.title) return null;
  const auteur = (entree.authors && entree.authors[0] && entree.authors[0].name) || '';
  return {
    titre: entree.title,
    auteur,
    annee: extraireAnnee(entree.publish_date),
    saga: '',
    tome: '',
  };
}
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `node web/test_lookup_core.mjs`
Expected: PASS — `OK : Task 2 (OpenLibrary) passe.`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/lookup/lookup-core.mjs web/test_lookup_core.mjs
git commit -m "feat: C2 normaliserOpenLibrary (node tests)"
```

---

### Task 3 : Parsing Unimarc (BnF)

**Files:**
- Modify: `supabase/functions/lookup/lookup-core.mjs`
- Test: `web/test_lookup_core.mjs`

Champs Unimarc visés : `200$a` titre, `700$a`+`700$b` auteur (`$b $a` → « Prénom Nom »),
`214$d`/`210$d` année, `461$t` saga + `461$v` tome (repli saga `225$a`).

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `web/test_lookup_core.mjs` (et ajouter `parserUnimarc` à l'import) :

```js
// parserUnimarc : notice avec saga (461) + tome
const xmlAvecSaga = `
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
 <srw:records><srw:record><srw:recordData>
  <mxc:record xmlns:mxc="info:lc/xmlns/marcxchange-v2">
   <mxc:datafield tag="200"><mxc:subfield code="a">L'Apprenti assassin</mxc:subfield></mxc:datafield>
   <mxc:datafield tag="700"><mxc:subfield code="a">Hobb</mxc:subfield><mxc:subfield code="b">Robin</mxc:subfield></mxc:datafield>
   <mxc:datafield tag="210"><mxc:subfield code="d">1998</mxc:subfield></mxc:datafield>
   <mxc:datafield tag="461"><mxc:subfield code="t">L'Assassin royal</mxc:subfield><mxc:subfield code="v">1</mxc:subfield></mxc:datafield>
  </mxc:record>
 </srw:recordData></srw:record></srw:records>
</srw:searchRetrieveResponse>`;
const u = parserUnimarc(xmlAvecSaga);
assert.strictEqual(u.titre, "L'Apprenti assassin");
assert.strictEqual(u.auteur, 'Robin Hobb');
assert.strictEqual(u.annee, 1998);
assert.strictEqual(u.saga, "L'Assassin royal");
assert.strictEqual(u.tome, '1');

// notice sans 461 -> saga/tome vides, repli année sur 214$d
const xmlSansSaga = `
<mxc:record xmlns:mxc="info:lc/xmlns/marcxchange-v2">
 <mxc:datafield tag="200"><mxc:subfield code="a">Le Hobbit</mxc:subfield></mxc:datafield>
 <mxc:datafield tag="700"><mxc:subfield code="a">Tolkien</mxc:subfield></mxc:datafield>
 <mxc:datafield tag="214"><mxc:subfield code="d">impr. 2012</mxc:subfield></mxc:datafield>
</mxc:record>`;
const u2 = parserUnimarc(xmlSansSaga);
assert.strictEqual(u2.titre, 'Le Hobbit');
assert.strictEqual(u2.auteur, 'Tolkien');
assert.strictEqual(u2.annee, 2012);
assert.strictEqual(u2.saga, '');
assert.strictEqual(u2.tome, '');

// décodage d'entités + repli saga sur 225$a
const xmlEntites = `
<mxc:record xmlns:mxc="info:lc/xmlns/marcxchange-v2">
 <mxc:datafield tag="200"><mxc:subfield code="a">Pierre &amp; Jean</mxc:subfield></mxc:datafield>
 <mxc:datafield tag="225"><mxc:subfield code="a">Classiques</mxc:subfield></mxc:datafield>
</mxc:record>`;
const u3 = parserUnimarc(xmlEntites);
assert.strictEqual(u3.titre, 'Pierre & Jean');
assert.strictEqual(u3.saga, 'Classiques');

// aucune notice (pas de 200$a) -> null
assert.strictEqual(parserUnimarc('<vide/>'), null);

console.log('OK : Task 3 (Unimarc) passe.');
```

(Remplacer le `console.log` de Task 2 par celui-ci.)

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `node web/test_lookup_core.mjs`
Expected: FAIL — `parserUnimarc is not a function`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Ajouter à `supabase/functions/lookup/lookup-core.mjs` :

```js
function decoderEntites(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

// Contenu brut du premier datafield au tag donné (préfixe de namespace optionnel).
function datafield(xml, tag) {
  const re = new RegExp(
    '<(?:\\w+:)?datafield\\b[^>]*\\btag="' + tag + '"[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?datafield>',
  );
  const m = xml.match(re);
  return m ? m[1] : null;
}

// Valeur du premier subfield au code donné dans un bloc datafield.
function subfield(bloc, code) {
  if (!bloc) return '';
  const re = new RegExp(
    '<(?:\\w+:)?subfield\\b[^>]*\\bcode="' + code + '"[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?subfield>',
  );
  const m = bloc.match(re);
  return m ? decoderEntites(m[1]).trim() : '';
}

// xml = réponse SRU Unimarc (texte). Renvoie {titre,auteur,annee,saga,tome} ou null.
export function parserUnimarc(xml) {
  if (!xml) return null;
  const titre = subfield(datafield(xml, '200'), 'a');
  if (!titre) return null;

  const champAuteur = datafield(xml, '700');
  const nom = subfield(champAuteur, 'a');
  const prenom = subfield(champAuteur, 'b');
  const auteur = `${prenom} ${nom}`.trim();

  const dateBloc = datafield(xml, '214') || datafield(xml, '210');
  const annee = extraireAnnee(subfield(dateBloc, 'd'));

  const lien = datafield(xml, '461');
  const saga = subfield(lien, 't') || subfield(datafield(xml, '225'), 'a');
  const tome = subfield(lien, 'v');

  return { titre, auteur, annee, saga, tome };
}
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `node web/test_lookup_core.mjs`
Expected: PASS — `OK : Task 3 (Unimarc) passe.`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/lookup/lookup-core.mjs web/test_lookup_core.mjs
git commit -m "feat: C2 parserUnimarc — BnF datafield/subfield + décodage entités (node tests)"
```

---

### Task 4 : Fonction Edge `index.ts` (fetch OL + BnF, CORS)

**Files:**
- Create: `supabase/functions/lookup/index.ts`

Pas de test unitaire (I/O réseau + runtime Deno) ; vérification au déploiement (Task 8).
L'origine CORS doit être celle du site Pages : `https://nrossaa.github.io` (host du compte
`NRossAA`, sans le sous-chemin `/Library/`). À confirmer par l'utilisateur au déploiement.

- [ ] **Step 1: Écrire la fonction**

Créer `supabase/functions/lookup/index.ts` :

```ts
// Fonction Edge "lookup" : ISBN -> OpenLibrary puis BnF (côté serveur, pas de CORS navigateur).
import {
  nettoyerIsbn, isbnValide, normaliserOpenLibrary, parserUnimarc,
} from "./lookup-core.mjs";

const ORIGINE = "https://nrossaa.github.io"; // origine du site GitHub Pages (sans /Library/)

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ORIGINE,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

function reponse(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function chercherOpenLibrary(isbn: string) {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  return normaliserOpenLibrary(await res.json(), isbn);
}

async function chercherBnf(isbn: string) {
  const query = `bib.isbn all "${isbn}"`;
  const url = "https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve"
    + `&query=${encodeURIComponent(query)}&recordSchema=unimarcxchange&maximumRecords=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return parserUnimarc(await res.text());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reponse({ trouve: false, erreur: "methode" }, 405);

  try {
    const corps = await req.json().catch(() => ({}));
    const isbn = nettoyerIsbn(corps.isbn);
    if (!isbnValide(isbn)) return reponse({ trouve: false, erreur: "isbn_invalide" }, 400);

    let livre = await chercherOpenLibrary(isbn);
    if (!livre || !livre.titre) {
      const bnf = await chercherBnf(isbn);
      if (bnf && bnf.titre) livre = bnf;
    }
    if (!livre || !livre.titre) return reponse({ trouve: false });
    return reponse({ trouve: true, livre });
  } catch (_e) {
    return reponse({ trouve: false, erreur: "erreur_serveur" }, 500);
  }
});
```

- [ ] **Step 2: Vérifier qu'il n'y a pas d'erreur de syntaxe évidente**

Run: `node --check supabase/functions/lookup/index.ts` *(échouera sur la syntaxe TS comme `: string` — c'est attendu ; sauter cette vérif si node n'accepte pas le TS).* La validation réelle se fait au déploiement (Task 8).
Expected: soit OK, soit erreur de **type** TS uniquement (pas d'erreur de logique).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/lookup/index.ts
git commit -m "feat: C2 fonction Edge lookup — fetch OpenLibrary + BnF, CORS restreint"
```

---

### Task 5 : Exposer `window.lookupIsbn` dans `app.js`

**Files:**
- Modify: `web/app.js` (après le bloc « Édition (C1) », avant « Démarrage »)

- [ ] **Step 1: Ajouter l'exposition de l'appel à la fonction Edge**

Dans `web/app.js`, juste après la ligne `document.getElementById('btn-annuler').addEventListener('click', fermerModale);` (ligne ~214), ajouter :

```js
// ---------- Recherche par ISBN (C2) ----------
// Exposé pour isbn.js (script classique). Renvoie { trouve, livre? } ou lève en cas d'erreur réseau.
window.lookupIsbn = async (isbn) => {
  const { data, error } = await client.functions.invoke('lookup', { body: { isbn } });
  if (error) throw error;
  return data;
};
```

- [ ] **Step 2: Vérifier la syntaxe**

Run: `node --check web/app.js`
Expected: erreur `import` au niveau module est possible selon la version de node ; si c'est le cas, vérifier visuellement que l'ajout est syntaxiquement correct (accolades équilibrées). Aucune erreur attendue dans le bloc ajouté.

- [ ] **Step 3: Commit**

```bash
git add web/app.js
git commit -m "feat: C2 expose window.lookupIsbn (invoke fonction Edge lookup)"
```

---

### Task 6 : UI client `isbn.js` + câblage HTML

**Files:**
- Create: `web/isbn.js`
- Modify: `web/index.html` (ligne 52 zone ISBN ; ligne 77-78 scripts)

- [ ] **Step 1: Créer `web/isbn.js`**

```js
// Recherche par ISBN (C2) — DOM + statut. Délègue l'appel réseau à window.lookupIsbn (app.js).

function remplirChamps(livre) {
  const set = (id, v) => {
    if (v !== null && v !== undefined && String(v).trim() !== '') {
      document.getElementById(id).value = v;
    }
  };
  set('f-titre', livre.titre);
  set('f-auteur', livre.auteur);
  set('f-annee', livre.annee);
  set('f-saga', livre.saga);
  set('f-tome', livre.tome);
}

async function rechercherIsbn() {
  const statut = document.getElementById('isbn-statut');
  const isbn = document.getElementById('f-isbn').value.replace(/[\s-]/g, '');
  if (!/^\d{13}$/.test(isbn)) { statut.textContent = 'ISBN : 13 chiffres attendus.'; return; }
  if (!navigator.onLine) { statut.textContent = 'Recherche en ligne uniquement.'; return; }
  if (!window.lookupIsbn) { statut.textContent = 'Indisponible (recharge la page).'; return; }

  statut.textContent = 'Recherche…';
  try {
    const data = await window.lookupIsbn(isbn);
    if (!data || !data.trouve) { statut.textContent = 'Introuvable — saisis à la main.'; return; }
    remplirChamps(data.livre);
    statut.textContent = 'Trouvé ✓';
  } catch (e) {
    statut.textContent = 'Erreur de recherche.';
  }
}

document.getElementById('btn-isbn').addEventListener('click', rechercherIsbn);
```

- [ ] **Step 2: Câbler la zone ISBN dans `web/index.html`**

Remplacer la ligne 52 :

```html
      <input id="f-isbn" placeholder="ISBN (13 chiffres)">
```

par :

```html
      <div class="ligne-isbn">
        <input id="f-isbn" placeholder="ISBN (13 chiffres)">
        <button type="button" id="btn-isbn" class="btn-isbn">🔍 Rechercher</button>
      </div>
      <p id="isbn-statut" class="isbn-statut"></p>
```

- [ ] **Step 3: Inclure `isbn.js`**

Dans `web/index.html`, après `<script src="./shelf.js"></script>` (ligne 77), ajouter :

```html
  <script src="./isbn.js"></script>
```

- [ ] **Step 4: Vérifier la syntaxe de isbn.js**

Run: `node --check web/isbn.js`
Expected: PASS (script classique, pas d'import).

- [ ] **Step 5: Commit**

```bash
git add web/isbn.js web/index.html
git commit -m "feat: C2 UI client — bouton Rechercher ISBN, statut, remplissage des champs"
```

---

### Task 7 : Style de la ligne ISBN

**Files:**
- Modify: `web/shelf.css` (ajout en fin de fichier)

- [ ] **Step 1: Ajouter le style**

Ajouter à la fin de `web/shelf.css` :

```css
/* C2 — recherche par ISBN dans la modale */
.ligne-isbn { display: flex; gap: 8px; }
.ligne-isbn #f-isbn { flex: 1; }
.btn-isbn {
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid #888;
  border-radius: 6px;
  background: #2a2a2a;
  color: #eee;
  padding: 0 12px;
}
.btn-isbn:hover { background: #3a3a3a; }
.isbn-statut { margin: 4px 0 0; min-height: 1.2em; font-size: 0.85em; color: #aaa; }
```

> Note : si la palette du projet diffère (vérifier les couleurs existantes dans `shelf.css`),
> aligner `background`/`color`/`border` sur celles des autres boutons de la modale plutôt que
> les valeurs ci-dessus.

- [ ] **Step 2: Commit**

```bash
git add web/shelf.css
git commit -m "style: C2 ligne ISBN (bouton Rechercher + statut)"
```

---

### Task 8 : Déploiement de la fonction Edge + test manuel

**Files:** aucun (étape manuelle de l'utilisateur + checklist).

- [ ] **Step 1: Déployer la fonction Edge**

Au choix de l'utilisateur :
- **Dashboard Supabase** → *Edge Functions* → *Create function* `lookup` → coller le contenu
  de `index.ts` **et** de `lookup-core.mjs` (créer le second fichier dans l'éditeur) → *Deploy*.
- ou **CLI** : `supabase functions deploy lookup` (depuis la racine, avec la CLI installée).

Vérifier/ajuster `ORIGINE` dans `index.ts` si l'URL Pages diffère de `https://nrossaa.github.io`.

- [ ] **Step 2: Checklist manuelle (sur le site déployé, connecté)**

1. **ISBN français connu** (ex. une édition Robin Hobb) → « 🔍 Rechercher » → titre/auteur/
   année (+ saga/tome si dispo) se remplissent ; statut « Trouvé ✓ ». *(repli BnF)*
2. **ISBN anglophone connu** → champs remplis. *(OpenLibrary)*
3. **ISBN inconnu** (13 chiffres bidons) → « Introuvable — saisis à la main. » ; aucun champ modifié.
4. **ISBN à 10 chiffres / « abc »** → « ISBN : 13 chiffres attendus. » ; aucun appel réseau.
5. **Hors-ligne** (DevTools → Network → Offline) → « Recherche en ligne uniquement. »
6. **Après remplissage** : ajuster si besoin → Enregistrer → le livre apparaît sur l'étagère
   (validation + dédup C1 intactes).
7. **Console DevTools** : aucune erreur CORS sur l'appel `functions/v1/lookup`.

- [ ] **Step 3: Vérifier la non-régression**

Run: `node web/test_shelf_logic.mjs && node web/test_lookup_core.mjs`
Expected: les deux suites affichent leur `OK`.

---

## Notes de sécurité (rappel spec)

- La fonction **ne lit pas** la table `books`, n'utilise **pas** `service_role`, ne touche pas la DB.
- `verify_jwt` reste activé (défaut Supabase) : seul un appel authentifié (jeton joint par
  `functions.invoke`) passe.
- ISBN validé (13 chiffres) **avant** tout `fetch` → pas d'injection dans les URL OL/BnF.
- CORS restreint à l'origine du site (pas `*`).
- Remplissage via `.value` uniquement (SEC-W1 : jamais `innerHTML` avec des données distantes).
