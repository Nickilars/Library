# Phase 2.1 — Navigation 3 niveaux + livre animé · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer l'interaction de l'étagère web (lecture seule) en une navigation à 3 niveaux — étagère sans titres → vue focalisée d'une saga → livre qui s'ouvre avec animation et affiche ses infos sur ses pages — sans toucher au serveur ni aux données.

**Architecture:** Raffinement 100 % front-end. `static/shelf.js` devient une petite machine à états (niveaux 0/1/2) et construit l'overlay du livre ouvert ; `static/shelf.css` porte les 3 états et l'animation 3D du livre ; `templates/base.html` perd son panneau latéral au profit d'une barre de focus et d'un conteneur d'overlay. `webapp.py`, `shelf.py`, `database.py` et `templates/_shelf.html` ne changent pas (les `data-*` portent déjà les infos).

**Tech Stack:** HTML/CSS/JS vanilla servis par FastAPI/Jinja2 (existant). Pas de build, pas de framework JS. Tests : la vérification est **manuelle** (navigateur) pour le front ; les suites serveur existantes (`test_webapp.py`, `test_shelf.py`) doivent rester vertes.

**Conventions :** Windows/PowerShell. Python via `.venv\Scripts\python.exe`. Pour les tests à accents : préfixer `$env:PYTHONIOENCODING='utf-8'`. Commits en anglais, terminés par :
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Structure des fichiers

| Fichier | Changement |
|---|---|
| `templates/base.html` | Retirer l'`<aside id="panneau">` ; ajouter `#barre-focus` (retour + nom) et `#livre-ouvert` (overlay). En-tête (recherche/chips) conservé. |
| `static/shelf.js` | Réécriture complète : machine à états 3 niveaux + ouverture animée du livre. |
| `static/shelf.css` | Réécriture complète : tranches sans titre (niv. 0), vue focalisée (niv. 1), overlay + animation du livre (niv. 2). |
| `templates/_shelf.html` | **Inchangé** (garde les `data-*` et les `onclick="basculerSaga(this)"` / `onclick="choisirLivre(this)"`, dont le comportement JS change). |
| `webapp.py`, `shelf.py`, `database.py` | **Inchangés.** |

Note : `_shelf.html` appelle déjà `basculerSaga(this)` (en-tête de saga) et `choisirLivre(this)` (tranche). On **garde ces noms** et on change leur implémentation — donc `_shelf.html` n'est pas modifié.

---

## Task 1 : DOM + comportement (base.html + shelf.js)

**Files:**
- Modify: `templates/base.html` (retrait aside, ajout barre focus + overlay)
- Modify: `static/shelf.js` (réécriture complète)

Le front n'a pas de tests unitaires ; la garde de cette tâche est : l'app importe et les **tests serveur restent verts** (ils ne dépendent pas du JS, mais on vérifie qu'aucune erreur de template n'est introduite).

- [ ] **Step 1: Remplacer le `<body>` de `templates/base.html`**

Remplacer tout le bloc depuis `<body>` jusqu'à `</body>` par :

```html
<body>
  <header class="entete">
    <h1>📚 Ma bibliothèque</h1>
    <nav>
      <a href="/">Collection</a>
      <a href="/wishlist">Wishlist</a>
    </nav>
    <div class="controles">
      <input id="recherche" type="search" placeholder="Rechercher titre, auteur, saga…">
      <div class="filtres">
        <button class="chip actif" data-statut="">Tous</button>
        <button class="chip" data-statut="non_lu">À lire</button>
        <button class="chip" data-statut="en_cours">En cours</button>
        <button class="chip" data-statut="lu">Lu</button>
      </div>
    </div>
  </header>

  <div id="barre-focus" class="barre-focus">
    <button id="btn-retour">← Retour</button>
    <span id="focus-nom"></span>
  </div>

  <main id="etagere">
    {% block contenu %}{% endblock %}
  </main>

  <!-- Overlay du livre ouvert (niveau 2), rempli par shelf.js -->
  <div id="livre-ouvert" class="livre-ouvert cache"></div>

  <script src="/static/shelf.js"></script>
</body>
```

(Le `<head>` ne change pas : il garde `<meta name="referrer" content="no-referrer">` et le lien CSS.)

- [ ] **Step 2: Remplacer tout le contenu de `static/shelf.js`** par :

```javascript
// Étagère — navigation à 3 niveaux + livre animé. Lecture seule.
// Niveau 0 : étagère (tranches sans titre). Clic saga -> niveau 1.
// Niveau 1 : vue focalisée d'un groupe de saga (titres visibles). Clic livre -> niveau 2.
// Niveau 2 : livre ouvert animé (couverture -> ouverture -> pages -> infos).

const STATUTS = { non_lu: 'À lire', en_cours: 'En cours', lu: 'Lu' };

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

// Appelé par l'en-tête de saga : onclick="basculerSaga(this)"
function basculerSaga(elNom) {
  focaliser(elNom.closest('.saga'));
}

function quitterFocus() {
  fermerLivre();
  document.body.classList.remove('mode-focus');
  document.querySelectorAll('.saga.focalisee').forEach(s => s.classList.remove('focalisee'));
  document.querySelectorAll('.auteur.auteur-focus').forEach(a => a.classList.remove('auteur-focus'));
}

// ---------- Niveau 1 -> 2 : ouvrir un livre ----------
// Appelé par une tranche : onclick="choisirLivre(this)"
function choisirLivre(el) {
  // On impose de passer d'abord par la saga : hors mode focus, un clic sur une
  // tranche focalise sa saga au lieu d'ouvrir directement le livre.
  if (!document.body.classList.contains('mode-focus')) {
    focaliser(el.closest('.saga'));
    return;
  }
  ouvrirLivre(el);
}

function couvRepli(couv, titre) {
  const s = document.createElement('span');
  s.className = 'couv-repli';
  s.textContent = titre;
  couv.replaceChildren(s);
}

function ajouterLigne(page, texte, classe) {
  const p = document.createElement('p');
  if (classe) p.className = classe;
  p.textContent = texte;   // textContent : jamais d'injection HTML (SEC-W1)
  page.appendChild(p);
}

function ouvrirLivre(el) {
  const d = el.dataset;
  const overlay = document.getElementById('livre-ouvert');
  overlay.replaceChildren();

  const livre = document.createElement('div');
  livre.className = 'livre3d';

  // Double page d'infos (état final, SOUS la couverture/les feuilles) — pas de couverture ici.
  const spread = document.createElement('div');
  spread.className = 'spread';

  const gauche = document.createElement('div');
  gauche.className = 'page page-gauche';
  ajouterLigne(gauche, d.titre, 'titre-livre');
  ajouterLigne(gauche, d.auteur + (d.annee ? ' · ' + d.annee : ''), 'sous');
  if (d.saga && d.saga !== 'Aucune') {
    ajouterLigne(gauche, 'Saga : ' + d.saga + (d.tome ? ' · Tome ' + d.tome : ''), '');
  }

  const droite = document.createElement('div');
  droite.className = 'page page-droite';
  ajouterLigne(droite, 'Statut : ' + (STATUTS[d.statut] || d.statut), '');
  if (d.possede === '1') ajouterLigne(droite, 'Possédé ✓', '');
  if (d.note) ajouterLigne(droite, '★'.repeat(Number(d.note)), 'note');
  if (d.commentaire) ajouterLigne(droite, '« ' + d.commentaire + ' »', 'commentaire');
  const crayon = document.createElement('button');
  crayon.className = 'crayon';
  crayon.disabled = true;
  crayon.title = 'Modification — bientôt (Phase 3)';
  crayon.textContent = '✏️';
  droite.appendChild(crayon);

  spread.appendChild(gauche);
  spread.appendChild(droite);
  livre.appendChild(spread);

  // Feuilles décoratives qui défilent (au-dessus de la double page)
  for (let i = 0; i < 4; i++) {
    const f = document.createElement('div');
    f.className = 'feuille';
    f.style.setProperty('--i', i);
    livre.appendChild(f);
  }

  // Couverture (étapes 1-2), au-dessus de tout : image OL ou couverture générée
  const couv = document.createElement('div');
  couv.className = 'couverture';
  const url = d.isbn ? `https://covers.openlibrary.org/b/isbn/${d.isbn}-L.jpg` : '';
  if (url) {
    couv.style.backgroundImage = `url("${url}")`;
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => {
      couv.style.backgroundImage = 'none';
      couv.style.background = el.style.getPropertyValue('--c');
      couvRepli(couv, d.titre);
    };
    img.src = url;
  } else {
    couv.style.background = el.style.getPropertyValue('--c');
    couvRepli(couv, d.titre);
  }
  livre.appendChild(couv);

  overlay.appendChild(livre);
  overlay.classList.remove('cache');

  // Démarre la séquence (les délais sont gérés en CSS via la classe 'demarre').
  void livre.offsetWidth;  // force un reflow pour que la transition parte de l'état initial
  livre.classList.add('demarre');

  // Clic sur le fond = fermer ; clic sur le livre = sauter directement aux infos.
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      fermerLivre();
    } else {
      livre.classList.add('fini');
    }
  };
}

function fermerLivre() {
  const overlay = document.getElementById('livre-ouvert');
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

- [ ] **Step 3: Vérifier l'import et la non-régression serveur**

Run: `.venv\Scripts\python.exe -c "import webapp; print('import ok')"`
Expected: `import ok` (un avertissement de dépréciation httpx est sans gravité).

Run: `$env:PYTHONIOENCODING='utf-8'; .venv\Scripts\python.exe test_webapp.py`
Expected: `OK : tests webapp passent.`

Run: `$env:PYTHONIOENCODING='utf-8'; .venv\Scripts\python.exe test_shelf.py`
Expected: `OK : tests couleur_tranche passent.`

- [ ] **Step 4: Commit**

```bash
git add templates/base.html static/shelf.js
git commit -m "feat: 3-level shelf navigation and animated open book (DOM + behavior)"
```

---

## Task 2 : Styles des 3 niveaux + animation (shelf.css)

**Files:**
- Modify: `static/shelf.css` (réécriture complète)

Vérification **manuelle** au navigateur (les classes CSS sont pilotées par le JS de la Task 1).

- [ ] **Step 1: Remplacer tout le contenu de `static/shelf.css`** par :

```css
:root {
  --bois: #3a2817;
  --bois-fonce: #2b1d12;
  --texte-tranche: #f0e6d2;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, "Segoe UI", sans-serif;
  background: var(--bois-fonce);
  color: #eee;
}
.entete {
  position: sticky; top: 0; z-index: 10;
  background: #1a110a;
  padding: 12px 20px;
  box-shadow: 0 2px 10px rgba(0,0,0,.5);
}
.entete h1 { margin: 0 0 8px; font-size: 20px; }
.entete nav a { color: #c9a880; text-decoration: none; margin-right: 16px; font-weight: 600; }
.entete nav a:hover { color: #fff; }
.controles { display: flex; gap: 16px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
#recherche {
  padding: 6px 10px; border-radius: 6px; border: 1px solid #5a4a35;
  background: #2b1d12; color: #eee; min-width: 240px;
}
.filtres { display: flex; gap: 6px; }
.chip {
  padding: 5px 12px; border-radius: 14px; border: 1px solid #5a4a35;
  background: transparent; color: #c9a880; cursor: pointer; font-size: 13px;
}
.chip.actif { background: #c9a880; color: #1a110a; font-weight: 600; }

/* ---------- Niveau 0 : étagère, tranches SANS titre ---------- */
.auteur { padding: 18px 20px; }
.auteur-nom { color: #c9a880; font-size: 16px; margin: 0 0 10px; border-bottom: 1px solid #4a3826; padding-bottom: 4px; }
.saga { margin-bottom: 14px; }
.saga-nom { color: #b59a78; font-size: 13px; cursor: pointer; user-select: none; margin-bottom: 6px; }
.saga-nom:hover { color: #fff; }
.saga-compte { opacity: .6; }
.rangee {
  display: flex; align-items: flex-end; gap: 3px;
  background: linear-gradient(var(--bois), var(--bois-fonce));
  border-bottom: 6px solid #1a110a; padding: 10px 8px; border-radius: 3px;
  overflow-x: auto;
}
.livre {
  flex: 0 0 auto;
  width: 26px; height: 120px;
  background: var(--c, #555);
  border-radius: 2px;
  box-shadow: inset -3px 0 6px rgba(0,0,0,.45);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: height .25s, width .25s, transform .25s;
}
.livre:hover { transform: translateY(-4px); }
.tranche-titre {
  writing-mode: vertical-rl; transform: rotate(180deg);
  font-size: 10px; color: var(--texte-tranche);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-height: 110px; padding: 4px 0;
}
.livre.masque { display: none; }
/* Titres masqués au niveau 0 */
.tranche-titre { display: none; }

/* ---------- Niveau 1 : vue focalisée ---------- */
.barre-focus {
  display: none; align-items: center; gap: 14px;
  position: sticky; top: 0; z-index: 8;
  background: #1a110a; padding: 10px 20px;
  box-shadow: 0 2px 10px rgba(0,0,0,.5);
}
body.mode-focus .barre-focus { display: flex; }
#btn-retour { background: #2b1d12; border: 1px solid #5a4a35; color: #c9a880; border-radius: 6px; padding: 6px 12px; cursor: pointer; }
#btn-retour:hover { color: #fff; }
#focus-nom { color: #c9a880; font-weight: 600; font-size: 16px; }

/* En mode focus, ne montrer que l'auteur puis la saga focalisés */
body.mode-focus .auteur { display: none; }
body.mode-focus .auteur.auteur-focus { display: block; }
body.mode-focus .auteur.auteur-focus .auteur-nom { display: none; }
body.mode-focus .auteur.auteur-focus .saga { display: none; }
body.mode-focus .auteur.auteur-focus .saga.focalisee { display: block; }
body.mode-focus .auteur.auteur-focus .saga.focalisee .saga-nom { display: none; }
/* Tranches agrandies + titres visibles en focus */
body.mode-focus .saga.focalisee .rangee { justify-content: center; min-height: 280px; }
body.mode-focus .saga.focalisee .livre { width: 60px; height: 240px; }
body.mode-focus .saga.focalisee .tranche-titre { display: block; font-size: 13px; max-height: 220px; }

/* ---------- Niveau 2 : livre ouvert animé ---------- */
.livre-ouvert {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(0,0,0,.72);
  display: flex; align-items: center; justify-content: center;
  perspective: 2000px;
}
.livre-ouvert.cache { display: none; }

.livre3d { position: relative; width: 320px; height: 340px; }

/* Double page (état final), sous les couches qui s'ouvrent */
.spread { position: absolute; inset: 0; display: flex; }
.page {
  width: 160px; height: 340px; padding: 18px; overflow: auto;
  color: #2b1d12; font-size: 14px;
}
.page-gauche { background: #ece4cf; border-radius: 6px 0 0 6px; border-right: 1px solid #d8cdb0; }
.page-droite { background: #f3ecd9; border-radius: 0 6px 6px 0; }
.page p { margin: 4px 0; }
.titre-livre { font-weight: bold; font-size: 18px; margin: 0 0 6px !important; }
.page .sous { color: #6d5a3a; }
.page .note { color: #b8860b; font-size: 16px; }
.page .commentaire { font-style: italic; color: #7a6a4a; margin-top: 10px; }
.page .crayon { margin-top: 12px; background: #e0d6bf; border: 1px solid #c9bb98; color: #6d5a3a; border-radius: 6px; padding: 4px 8px; cursor: not-allowed; opacity: .7; }

/* Couches qui s'ouvrent vers la gauche (charnière à gauche) en révélant la double page */
.couverture, .feuille {
  position: absolute; left: 0; top: 0;
  width: 320px; height: 340px;
  transform-origin: left center;
  transform: rotateY(0deg);
  backface-visibility: hidden;
  border-radius: 6px;
}
.feuille { background: #fbf6e9; z-index: 3; box-shadow: 0 0 1px #d8cdb0 inset; }
.couverture {
  z-index: 4; background: #555 center/cover;
  box-shadow: 0 12px 32px rgba(0,0,0,.6);
  display: flex; align-items: flex-end; padding: 14px;
}
.couv-repli { color: #fff; font-weight: bold; font-size: 14px; }

/* Séquence : couverture s'ouvre à 2 s, puis les feuilles défilent en cascade */
.livre3d.demarre .couverture {
  transform: rotateY(-168deg);
  transition: transform .8s ease-in;
  transition-delay: 2s;
}
.livre3d.demarre .feuille {
  transform: rotateY(-168deg);
  transition: transform .5s ease-in;
  transition-delay: calc(2.5s + var(--i) * 0.22s);
}

/* Raccourci : un clic sur le livre saute directement à l'état final (ouvert) */
.livre3d.fini .couverture, .livre3d.fini .feuille {
  transition: none;
  transform: rotateY(-168deg);
}

.vide { padding: 40px; text-align: center; color: #b59a78; }
```

- [ ] **Step 2: Vérifier la non-régression serveur**

Run: `$env:PYTHONIOENCODING='utf-8'; .venv\Scripts\python.exe test_webapp.py`
Expected: `OK : tests webapp passent.`

- [ ] **Step 3: Vérification manuelle au navigateur**

Run: `.venv\Scripts\python.exe webapp.py`
Ouvrir http://127.0.0.1:8000 et vérifier :
1. **Niveau 0** : les tranches n'affichent **pas** de titre ; la recherche et les filtres (chips) fonctionnent.
2. **Clic sur un en-tête de saga** → vue focalisée : seule cette saga, **barre « ← Retour » + nom** en haut, tranches agrandies avec **titres complets**. « Retour » revient à l'étagère.
3. **Clic sur un groupe « Aucune »** (auteur sans saga) → focalise sur ses livres, le nom affiché est celui de l'auteur.
4. **Clic sur un livre** (en vue focalisée) → **couverture ~2 s → ouverture → feuilles qui défilent → double page d'infos sans couverture**.
5. Un **clic sur le livre pendant l'animation** saute directement aux infos.
6. Un **clic en dehors du livre** referme et revient à la vue focalisée.
7. `/wishlist` se comporte pareil.
Fermer le serveur avec Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add static/shelf.css
git commit -m "feat: style the 3 shelf levels and the open-book animation"
```

---

## Vérification finale

- [ ] Suite serveur complète au vert :

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

- [ ] Checklist navigateur (Task 2, Step 3) validée de bout en bout.
- [ ] `git status` propre ; `library.db` toujours ignoré.
