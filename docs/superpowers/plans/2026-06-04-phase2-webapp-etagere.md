# Phase 2 — Web : étagère de consultation · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire une application web FastAPI **en lecture seule** qui affiche la collection sous forme d'« étagère » (tranches debout groupées auteur → saga → tome), avec recherche, filtres, vue wishlist et une API JSON, en réutilisant la couche `database.py` de la Phase 1.

**Architecture:** `webapp.py` (FastAPI) sert des pages Jinja2 et une API JSON, en appelant `database.py` en lecture seule. La logique de présentation pure (groupement, couleur de tranche) vit dans `shelf.py`, testée isolément. L'interaction visuelle (déplier saga, pivoter livre, panneau d'infos, recherche/filtres) est 100 % côté client dans `static/shelf.js` + `static/shelf.css`.

**Tech Stack:** Python 3.14, FastAPI + Uvicorn + Jinja2, le module `database.py` existant (SQLite), tests via `fastapi.testclient.TestClient` sur base `:memory:`. Convention de test du projet : scripts d'assertions autonomes lancés avec `.venv\Scripts\python.exe test_xxx.py` (pas pytest).

**Conventions :** Windows/PowerShell ; pour les tests qui impriment des accents/emoji, préfixer `$env:PYTHONIOENCODING='utf-8'`. Messages de commit en anglais, terminés par :
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Structure des fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `shelf.py` | Présentation pure : `couleur_tranche()`, `grouper_livres()` | Créer |
| `webapp.py` | App FastAPI : lifespan, routes HTML + API JSON, lancement | Créer |
| `database.py` | Ajout d'un helper `is_initialized()` | Modifier |
| `templates/base.html` | Gabarit commun (en-tête, CSS/JS) | Créer |
| `templates/_shelf.html` | Partial : rendu d'une étagère (réutilisé) | Créer |
| `templates/shelf.html` | Page collection possédée | Créer |
| `templates/wishlist.html` | Page wishlist | Créer |
| `static/shelf.css` | Style étagère / tranches / panneau | Créer |
| `static/shelf.js` | Interaction client | Créer |
| `requirements.txt` | Ajout fastapi / uvicorn / jinja2 (+ httpx pour tests) | Modifier |
| `test_shelf.py` | Tests des fonctions pures | Créer |
| `test_webapp.py` | Tests des routes (TestClient) | Créer |
| `README.md` | Section lancement web | Modifier |

---

## Task 1 : Dépendances web

**Files:**
- Install dans `.venv`
- Modify: `requirements.txt`

- [ ] **Step 1: Installer les paquets**

Run: `.venv\Scripts\python.exe -m pip install fastapi uvicorn jinja2 httpx`
Expected: installation réussie (httpx est requis par le TestClient de FastAPI).

- [ ] **Step 2: Relever les versions installées**

Run: `.venv\Scripts\python.exe -m pip show fastapi uvicorn jinja2 | findstr /B "Name Version"`
Note les versions exactes affichées.

- [ ] **Step 3: Ajouter les 3 dépendances directes à `requirements.txt`**

Ouvre `requirements.txt` et ajoute ces lignes (remplace `<version>` par les versions RÉELLES de l'étape 2). `httpx` n'est PAS ajouté ici (dépendance de test uniquement, déjà tirée par FastAPI) :

```
fastapi==<version>
uvicorn==<version>
jinja2==<version>
```

- [ ] **Step 4: Vérifier l'import**

Run: `.venv\Scripts\python.exe -c "import fastapi, uvicorn, jinja2; print('ok')"`
Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add requirements.txt
git commit -m "chore: add FastAPI/uvicorn/jinja2 dependencies for web app"
```

---

## Task 2 : shelf.py — couleur de tranche déterministe

**Files:**
- Create: `shelf.py`
- Test: `test_shelf.py`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test_shelf.py` :

```python
#! /usr/bin/env python3
# Tests des fonctions de présentation de l'étagère (pures, sans web).
import re
from shelf import couleur_tranche


def test_couleur_deterministe():
    # Même livre -> toujours la même couleur (hash stable entre exécutions).
    c1 = couleur_tranche("Dune", "Frank Herbert")
    c2 = couleur_tranche("Dune", "Frank Herbert")
    assert c1 == c2


def test_couleur_format_hex():
    c = couleur_tranche("Dune", "Frank Herbert")
    assert re.fullmatch(r"#[0-9a-f]{6}", c), f"format inattendu : {c}"


def test_couleurs_differentes_selon_livre():
    a = couleur_tranche("Dune", "Frank Herbert")
    b = couleur_tranche("Le Hobbit", "Tolkien")
    assert a != b


if __name__ == "__main__":
    test_couleur_deterministe()
    test_couleur_format_hex()
    test_couleurs_differentes_selon_livre()
    print("OK : tests couleur_tranche passent.")
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `.venv\Scripts\python.exe test_shelf.py`
Expected: `ModuleNotFoundError: No module named 'shelf'`.

- [ ] **Step 3: Créer `shelf.py` avec `couleur_tranche`**

```python
#! /usr/bin/env python3
# Présentation pure de l'étagère : aucune dépendance web, facilement testable.
import hashlib


def _hsl_vers_hex(h: float, s: float, l: float) -> str:
    """Convertit une couleur HSL (h in [0,360), s/l in [0,1]) en '#rrggbb'."""
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = l - c / 2
    if h < 60:
        r, g, b = c, x, 0
    elif h < 120:
        r, g, b = x, c, 0
    elif h < 180:
        r, g, b = 0, c, x
    elif h < 240:
        r, g, b = 0, x, c
    elif h < 300:
        r, g, b = x, 0, c
    else:
        r, g, b = c, 0, x
    R, G, B = int((r + m) * 255), int((g + m) * 255), int((b + m) * 255)
    return f"#{R:02x}{G:02x}{B:02x}"


def couleur_tranche(titre: str, auteur: str) -> str:
    """Couleur stable et lisible d'une tranche, dérivée d'un hash du titre + auteur.
    Utilise hashlib (pas hash() qui est salé par processus) pour rester identique
    d'une exécution à l'autre. Teinte variable, saturation/luminosité fixes (tranche
    sombre, texte clair lisible)."""
    graine = f"{titre}|{auteur}".encode("utf-8")
    h = int(hashlib.md5(graine).hexdigest(), 16)
    teinte = h % 360
    return _hsl_vers_hex(teinte, 0.45, 0.38)
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `.venv\Scripts\python.exe test_shelf.py`
Expected: `OK : tests couleur_tranche passent.`

- [ ] **Step 5: Commit**

```bash
git add shelf.py test_shelf.py
git commit -m "feat: add deterministic spine color helper"
```

---

## Task 3 : shelf.py — groupement auteur → saga → tome

**Files:**
- Modify: `shelf.py`
- Test: `test_shelf.py`

- [ ] **Step 1: Ajouter le test qui échoue**

Ajouter dans `test_shelf.py`, avant le bloc `if __name__`, l'import et les tests, puis les appels dans le bloc `if __name__` :

```python
from shelf import grouper_livres
from book import Book


def test_groupement_structure():
    livres = [
        Book("La nef du crépuscule", "Robin Hobb", saga="L'Assassin royal", tome=3, possede=True),
        Book("L'apprenti assassin", "Robin Hobb", saga="L'Assassin royal", tome=1, possede=True),
        Book("Le Hobbit", "Tolkien", possede=True),
    ]
    groupes = grouper_livres(livres)
    # Deux auteurs, triés alphabétiquement : Robin Hobb puis Tolkien
    assert [g["auteur"] for g in groupes] == ["Robin Hobb", "Tolkien"]
    # Hobb a une saga "L'Assassin royal" avec 2 livres, triés par tome (1 puis 3)
    hobb = groupes[0]
    assert hobb["sagas"][0]["nom"] == "L'Assassin royal"
    titres = [b.titre for b in hobb["sagas"][0]["livres"]]
    assert titres == ["L'apprenti assassin", "La nef du crépuscule"]
    # Tolkien a une saga "Aucune"
    assert groupes[1]["sagas"][0]["nom"] == "Aucune"


def test_groupement_vide():
    assert grouper_livres([]) == []
```

Appels à ajouter dans le bloc `if __name__` :

```python
    test_groupement_structure()
    test_groupement_vide()
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `.venv\Scripts\python.exe test_shelf.py`
Expected: `ImportError: cannot import name 'grouper_livres' from 'shelf'`.

- [ ] **Step 3: Ajouter `grouper_livres` dans `shelf.py`**

```python
def grouper_livres(livres: list) -> list:
    """Groupe les livres par auteur puis par saga, dans un ordre stable.
    Tri : auteur, puis sagas nommées avant 'Aucune', puis tome (numérotés croissants,
    sans tome ensuite), puis titre. Retourne une liste de dicts :
    [{'auteur': str, 'sagas': [{'nom': str, 'livres': [Book, ...]}, ...]}, ...]"""
    livres_tries = sorted(livres, key=lambda b: (
        b.auteur.casefold(),
        (b.saga == "Aucune", b.saga.casefold()),   # sagas nommées d'abord, 'Aucune' en dernier
        (b.tome is None, b.tome or 0),              # tomes numérotés croissants, None ensuite
        b.titre.casefold(),
    ))
    groupes = []
    for b in livres_tries:
        if not groupes or groupes[-1]["auteur"] != b.auteur:
            groupes.append({"auteur": b.auteur, "sagas": []})
        sagas = groupes[-1]["sagas"]
        if not sagas or sagas[-1]["nom"] != b.saga:
            sagas.append({"nom": b.saga, "livres": []})
        sagas[-1]["livres"].append(b)
    return groupes
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `.venv\Scripts\python.exe test_shelf.py`
Expected: `OK : tests couleur_tranche passent.` (le print final existant ; tous les tests s'exécutent avant)

- [ ] **Step 5: Commit**

```bash
git add shelf.py test_shelf.py
git commit -m "feat: add author/saga/tome grouping for the shelf"
```

---

## Task 4 : webapp.py — squelette FastAPI, lifespan, /health

**Files:**
- Create: `webapp.py`
- Modify: `database.py` (ajout `is_initialized`)
- Test: `test_webapp.py`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test_webapp.py` :

```python
#! /usr/bin/env python3
# Tests des routes web via le TestClient FastAPI, sur base SQLite en mémoire.
# Note : on n'utilise PAS `with TestClient(...)`, donc le lifespan ne s'exécute pas ;
# on initialise et on peuple la base nous-mêmes avant de créer le client. Le lifespan
# est de toute façon protégé par database.is_initialized().
import database
from book import Book
from fastapi.testclient import TestClient


def _client_avec_donnees():
    database.init_db(":memory:")
    database.add_book(Book("Dune", "Frank Herbert", isbn="9780441172719",
                           saga="Dune", tome=1, statut_lecture="lu", possede=True))
    database.add_book(Book("Le Hobbit", "Tolkien", statut_lecture="non_lu", possede=True))
    database.add_book(Book("À acheter", "Auteur X", wishlist=True, possede=False))
    from webapp import app
    return TestClient(app)


def test_health():
    client = _client_avec_donnees()
    r = client.get("/health")
    assert r.status_code == 200


if __name__ == "__main__":
    test_health()
    print("OK : tests webapp passent.")
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `.venv\Scripts\python.exe test_webapp.py`
Expected: `ModuleNotFoundError: No module named 'webapp'`.

- [ ] **Step 3: Ajouter `is_initialized` dans `database.py`**

Après la fonction `_get_conn` dans `database.py`, ajouter :

```python
def is_initialized() -> bool:
    """True si la connexion a déjà été ouverte par init_db (utile au démarrage web)."""
    return _conn is not None
```

- [ ] **Step 4: Créer `webapp.py` (squelette)**

```python
#! /usr/bin/env python3
# Application web FastAPI — consultation en lecture seule de la bibliothèque.
# Lancement : uvicorn webapp:app   (ou : python webapp.py)
# Hôte/port/chemin base configurables par variables d'environnement.
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
import database


@asynccontextmanager
async def lifespan(app: FastAPI):
    # N'initialise que si ce n'est pas déjà fait (les tests pré-initialisent ':memory:').
    if not database.is_initialized():
        database.init_db(os.environ.get("LIBRARY_DB", database.DEFAULT_PATH))
    yield


app = FastAPI(title="Bibliothèque", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("LIBRARY_HOST", "127.0.0.1")
    port = int(os.environ.get("LIBRARY_PORT", "8000"))
    uvicorn.run("webapp:app", host=host, port=port)
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `.venv\Scripts\python.exe test_webapp.py`
Expected: `OK : tests webapp passent.`

- [ ] **Step 6: Commit**

```bash
git add database.py webapp.py test_webapp.py
git commit -m "feat: add FastAPI app skeleton with lifespan and /health"
```

---

## Task 5 : Templates de base + route `/` (étagère possédée)

**Files:**
- Create: `templates/base.html`, `templates/_shelf.html`, `templates/shelf.html`
- Create: `static/.gitkeep` (le dossier doit exister pour le montage statique)
- Modify: `webapp.py`
- Test: `test_webapp.py`

- [ ] **Step 1: Ajouter les tests qui échouent**

Ajouter dans `test_webapp.py` (avant `if __name__`) puis appeler dans le bloc `if __name__` :

```python
def test_accueil_liste_possedes():
    client = _client_avec_donnees()
    r = client.get("/")
    assert r.status_code == 200
    assert "Dune" in r.text
    assert "Le Hobbit" in r.text
    # Un livre uniquement wishlist n'apparaît pas sur la page collection
    assert "À acheter" not in r.text


def test_accueil_echappe_le_html():
    # SEC-W1 : un titre piégé doit être échappé, jamais rendu comme balise active.
    database.init_db(":memory:")
    database.add_book(Book("<script>alert(1)</script>", "Pirate", possede=True))
    from webapp import app
    client = TestClient(app)
    r = client.get("/")
    assert "<script>alert(1)</script>" not in r.text
    assert "&lt;script&gt;" in r.text


def test_groupement_saga_dans_page():
    database.init_db(":memory:")
    database.add_book(Book("Tome 1", "Auteur", saga="Ma Saga", tome=1, possede=True))
    database.add_book(Book("Tome 2", "Auteur", saga="Ma Saga", tome=2, possede=True))
    from webapp import app
    client = TestClient(app)
    r = client.get("/")
    # L'en-tête de saga apparaît une seule fois, les deux tomes sont présents
    assert r.text.count("Ma Saga") >= 1
    assert "Tome 1" in r.text and "Tome 2" in r.text
```

Appels :

```python
    test_accueil_liste_possedes()
    test_accueil_echappe_le_html()
    test_groupement_saga_dans_page()
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `.venv\Scripts\python.exe test_webapp.py`
Expected: échec (route `/` absente → 404, donc l'assertion 200 échoue).

- [ ] **Step 3: Créer le dossier static**

Créer un fichier vide `static/.gitkeep` (pour que `StaticFiles(directory="static")` trouve le dossier).

- [ ] **Step 4: Créer `templates/base.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- SEC-W4 : ne fuiter aucun référent vers covers.openlibrary.org (couvre aussi les background-image) -->
  <meta name="referrer" content="no-referrer">
  <title>{% block titre %}Ma bibliothèque{% endblock %}</title>
  <link rel="stylesheet" href="/static/shelf.css">
</head>
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

  <main id="etagere">
    {% block contenu %}{% endblock %}
  </main>

  <aside id="panneau" class="panneau ferme" aria-hidden="true">
    <button id="panneau-fermer" class="panneau-fermer" title="Fermer">✕</button>
    <div id="panneau-couverture" class="panneau-couverture"></div>
    <div class="panneau-infos">
      <div class="panneau-titre-ligne">
        <h2 id="p-titre"></h2>
        <button id="p-modifier" class="crayon" disabled title="Modification — bientôt (Phase 3)">✏️</button>
      </div>
      <p id="p-auteur" class="p-auteur"></p>
      <p id="p-saga"></p>
      <p id="p-statut"></p>
      <p id="p-note"></p>
      <p id="p-commentaire" class="p-commentaire"></p>
    </div>
  </aside>

  <script src="/static/shelf.js"></script>
</body>
</html>
```

- [ ] **Step 5: Créer le partial `templates/_shelf.html`**

```html
{% if groupes %}
  {% for groupe in groupes %}
  <section class="auteur">
    <h2 class="auteur-nom">{{ groupe.auteur }}</h2>
    {% for saga in groupe.sagas %}
    <div class="saga" data-saga="{{ saga.nom }}">
      <div class="saga-nom" onclick="basculerSaga(this)">
        {{ saga.nom }}
        {% if saga.nom != "Aucune" %}<span class="saga-compte">({{ saga.livres|length }})</span>{% endif %}
      </div>
      <div class="rangee">
        {% for livre in saga.livres %}
        <div class="livre"
             data-id="{{ livre.id }}"
             data-titre="{{ livre.titre }}"
             data-auteur="{{ livre.auteur }}"
             data-annee="{{ livre.annee_publication }}"
             data-saga="{{ livre.saga }}"
             data-tome="{{ livre.tome if livre.tome is not none else '' }}"
             data-statut="{{ livre.statut_lecture }}"
             data-note="{{ livre.note if livre.note is not none else '' }}"
             data-isbn="{{ livre.isbn }}"
             data-commentaire="{{ livre.commentaire }}"
             data-possede="{{ '1' if livre.possede else '0' }}"
             style="--c: {{ couleur(livre.titre, livre.auteur) }}"
             onclick="choisirLivre(this)">
          <span class="tranche-titre">{{ livre.titre }}</span>
        </div>
        {% endfor %}
      </div>
    </div>
    {% endfor %}
  </section>
  {% endfor %}
{% else %}
  <p class="vide">{{ message_vide }}</p>
{% endif %}
```

- [ ] **Step 6: Créer `templates/shelf.html`**

```html
{% extends "base.html" %}
{% block titre %}Ma bibliothèque{% endblock %}
{% block contenu %}{% include "_shelf.html" %}{% endblock %}
```

- [ ] **Step 7: Étendre `webapp.py` (templates, static, route `/`)**

Ajouter les imports en tête (avec les autres) :

```python
from fastapi import Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from shelf import couleur_tranche, grouper_livres
```

Après la création de `app = FastAPI(...)`, ajouter :

```python
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
```

Et ajouter la route (avant le bloc `if __name__`) :

```python
@app.get("/", response_class=HTMLResponse)
def accueil(request: Request):
    possedes = [b for b in database.get_all_books() if b.possede]
    return templates.TemplateResponse("shelf.html", {
        "request": request,
        "groupes": grouper_livres(possedes),
        "couleur": couleur_tranche,
        "message_vide": "Votre collection est vide.",
    })
```

- [ ] **Step 8: Lancer le test pour vérifier qu'il passe**

Run: `$env:PYTHONIOENCODING='utf-8'; .venv\Scripts\python.exe test_webapp.py`
Expected: `OK : tests webapp passent.`

- [ ] **Step 9: Commit**

```bash
git add webapp.py templates static test_webapp.py
git commit -m "feat: add shelf templates and the home route (owned books)"
```

---

## Task 6 : Route `/wishlist`

**Files:**
- Create: `templates/wishlist.html`
- Modify: `webapp.py`
- Test: `test_webapp.py`

- [ ] **Step 1: Ajouter le test qui échoue**

Ajouter dans `test_webapp.py` puis appeler dans `if __name__` :

```python
def test_wishlist():
    client = _client_avec_donnees()
    r = client.get("/wishlist")
    assert r.status_code == 200
    assert "À acheter" in r.text          # le livre wishlist
    assert "Le Hobbit" not in r.text      # un possédé non-wishlist n'y est pas
```

Appel : `    test_wishlist()`

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `$env:PYTHONIOENCODING='utf-8'; .venv\Scripts\python.exe test_webapp.py`
Expected: échec (route `/wishlist` → 404).

- [ ] **Step 3: Créer `templates/wishlist.html`**

```html
{% extends "base.html" %}
{% block titre %}Wishlist{% endblock %}
{% block contenu %}{% include "_shelf.html" %}{% endblock %}
```

- [ ] **Step 4: Ajouter la route dans `webapp.py`**

```python
@app.get("/wishlist", response_class=HTMLResponse)
def wishlist(request: Request):
    souhaits = [b for b in database.get_all_books() if b.wishlist]
    return templates.TemplateResponse("wishlist.html", {
        "request": request,
        "groupes": grouper_livres(souhaits),
        "couleur": couleur_tranche,
        "message_vide": "Votre wishlist est vide.",
    })
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `$env:PYTHONIOENCODING='utf-8'; .venv\Scripts\python.exe test_webapp.py`
Expected: `OK : tests webapp passent.`

- [ ] **Step 6: Commit**

```bash
git add webapp.py templates/wishlist.html test_webapp.py
git commit -m "feat: add wishlist route and template"
```

---

## Task 7 : API JSON en lecture seule

**Files:**
- Modify: `webapp.py`
- Test: `test_webapp.py`

- [ ] **Step 1: Ajouter les tests qui échouent**

Ajouter dans `test_webapp.py` puis appeler dans `if __name__` :

```python
def test_api_books():
    client = _client_avec_donnees()
    r = client.get("/api/books")
    assert r.status_code == 200
    data = r.json()
    titres = {b["titre"] for b in data}
    assert "Dune" in titres and "Le Hobbit" in titres
    assert "À acheter" not in titres          # API /books = possédés


def test_api_book_par_id():
    client = _client_avec_donnees()
    r = client.get("/api/books/1")
    assert r.status_code == 200
    assert r.json()["titre"] == "Dune"
    assert r.json()["id"] == 1


def test_api_book_inexistant():
    client = _client_avec_donnees()
    r = client.get("/api/books/999")
    assert r.status_code == 404


def test_api_wishlist():
    client = _client_avec_donnees()
    r = client.get("/api/wishlist")
    assert r.status_code == 200
    titres = {b["titre"] for b in r.json()}
    assert titres == {"À acheter"}
```

Appels :

```python
    test_api_books()
    test_api_book_par_id()
    test_api_book_inexistant()
    test_api_wishlist()
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `$env:PYTHONIOENCODING='utf-8'; .venv\Scripts\python.exe test_webapp.py`
Expected: échec (routes `/api/...` → 404).

- [ ] **Step 3: Ajouter les routes API dans `webapp.py`**

Ajouter l'import en tête (avec les autres) :

```python
from dataclasses import asdict
from fastapi import HTTPException
```

Ajouter les routes (avant le bloc `if __name__`) :

```python
@app.get("/api/books")
def api_books():
    return [asdict(b) for b in database.get_all_books() if b.possede]


@app.get("/api/books/{book_id}")
def api_book(book_id: int):
    livre = database.get_book(book_id)
    if livre is None:
        raise HTTPException(status_code=404, detail="Livre introuvable")
    return asdict(livre)


@app.get("/api/wishlist")
def api_wishlist():
    return [asdict(b) for b in database.get_all_books() if b.wishlist]
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `$env:PYTHONIOENCODING='utf-8'; .venv\Scripts\python.exe test_webapp.py`
Expected: `OK : tests webapp passent.`

- [ ] **Step 5: Commit**

```bash
git add webapp.py test_webapp.py
git commit -m "feat: add read-only JSON API (books, book by id, wishlist)"
```

---

## Task 8 : Style et interaction client (étagère vivante)

**Files:**
- Create: `static/shelf.css`, `static/shelf.js`

Cette tâche est purement front (CSS/JS) ; elle se vérifie **manuellement** dans le navigateur (étape finale). Pas de test unitaire.

- [ ] **Step 1: Créer `static/shelf.css`**

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
.entete nav a {
  color: #c9a880; text-decoration: none; margin-right: 16px; font-weight: 600;
}
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
  transition: height .25s, width .25s, transform .25s, margin .25s;
}
.saga.ouverte .livre { height: 160px; }
.livre:hover { transform: translateY(-4px); }
.tranche-titre {
  writing-mode: vertical-rl; transform: rotate(180deg);
  font-size: 10px; color: var(--texte-tranche);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-height: 110px; padding: 4px 0;
}
.livre.selectionne {
  width: 90px; height: 170px;
  background-size: cover; background-position: center;
  transform: translateY(-8px);
}
.livre.selectionne .tranche-titre { display: none; }
/* voisins écartés autour du livre sélectionné */
.livre.voisin-gauche { margin-right: 10px; }
.livre.voisin-droite { margin-left: 10px; }
.livre.masque { display: none; }

/* Panneau d'infos */
.panneau {
  position: fixed; top: 0; right: 0; height: 100%; width: 320px;
  background: #1a110a; box-shadow: -4px 0 16px rgba(0,0,0,.6);
  padding: 20px; overflow-y: auto; transition: transform .3s; z-index: 20;
}
.panneau.ferme { transform: translateX(100%); }
.panneau-fermer { position: absolute; top: 10px; right: 12px; background: none; border: none; color: #c9a880; font-size: 18px; cursor: pointer; }
.panneau-couverture { width: 140px; height: 210px; margin: 10px auto 16px; border-radius: 4px; background: #333 center/cover; box-shadow: 0 6px 18px rgba(0,0,0,.6); display: flex; align-items: flex-end; padding: 8px; }
.panneau-couverture .repli { font-size: 12px; color: #f0e6d2; }
.panneau-titre-ligne { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.panneau h2 { font-size: 18px; margin: 0; }
.crayon { background: #2b1d12; border: 1px solid #5a4a35; color: #c9a880; border-radius: 6px; padding: 4px 8px; cursor: not-allowed; opacity: .6; }
.p-auteur { color: #c9a880; margin: 4px 0 12px; }
.panneau p { font-size: 14px; margin: 4px 0; }
.p-commentaire { color: #aaa; font-style: italic; margin-top: 10px; }
.vide { padding: 40px; text-align: center; color: #b59a78; }
```

- [ ] **Step 2: Créer `static/shelf.js`**

```javascript
// Interaction de l'étagère — 100% côté client, lecture seule.

// Déplier / replier une saga
function basculerSaga(elNom) {
  elNom.closest('.saga').classList.toggle('ouverte');
}

// Sélectionner un livre : pivoter de face (couverture), écarter les voisins, ouvrir le panneau
function choisirLivre(el) {
  // Réinitialiser l'état précédent
  document.querySelectorAll('.livre.selectionne, .livre.voisin-gauche, .livre.voisin-droite')
    .forEach(l => l.classList.remove('selectionne', 'voisin-gauche', 'voisin-droite'));

  el.classList.add('selectionne');
  const precedent = el.previousElementSibling;
  const suivant = el.nextElementSibling;
  if (precedent) precedent.classList.add('voisin-gauche');
  if (suivant) suivant.classList.add('voisin-droite');

  // Couverture : Open Library par ISBN, repli si absente/échec
  const isbn = el.dataset.isbn;
  const couv = document.getElementById('panneau-couverture');
  const titre = el.dataset.titre;
  if (isbn) {
    const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
    couv.style.backgroundImage = `url("${url}")`;
    couv.innerHTML = '';
    // repli si l'image ne charge pas
    const test = new Image();
    test.referrerPolicy = 'no-referrer';
    test.onerror = () => { couv.style.backgroundImage = 'none'; couv.style.background = el.style.getPropertyValue('--c'); couv.innerHTML = `<span class="repli">${titre}</span>`; };
    test.src = url;
    el.style.backgroundImage = `url("${url}")`;
  } else {
    couv.style.backgroundImage = 'none';
    couv.style.background = el.style.getPropertyValue('--c');
    couv.innerHTML = `<span class="repli">${titre}</span>`;
  }

  // Panneau d'infos
  const statuts = { non_lu: 'À lire', en_cours: 'En cours', lu: 'Lu' };
  const d = el.dataset;
  document.getElementById('p-titre').textContent = d.titre;
  document.getElementById('p-auteur').textContent = d.auteur + (d.annee ? ' · ' + d.annee : '');
  document.getElementById('p-saga').textContent =
    d.saga && d.saga !== 'Aucune' ? `Saga : ${d.saga}` + (d.tome ? ` · Tome ${d.tome}` : '') : '';
  document.getElementById('p-statut').textContent =
    `Statut : ${statuts[d.statut] || d.statut}` + (d.possede === '1' ? ' · Possédé ✓' : '');
  document.getElementById('p-note').textContent = d.note ? '★'.repeat(Number(d.note)) : '';
  document.getElementById('p-commentaire').textContent = d.commentaire || '';

  const panneau = document.getElementById('panneau');
  panneau.classList.remove('ferme');
  panneau.setAttribute('aria-hidden', 'false');
}

// Fermeture du panneau
document.getElementById('panneau-fermer').addEventListener('click', () => {
  const panneau = document.getElementById('panneau');
  panneau.classList.add('ferme');
  panneau.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('.livre.selectionne, .livre.voisin-gauche, .livre.voisin-droite')
    .forEach(l => { l.classList.remove('selectionne', 'voisin-gauche', 'voisin-droite'); l.style.backgroundImage = 'none'; });
});

// Recherche + filtre statut (côté client, sur le jeu déjà rendu)
let filtreStatut = '';
function appliquerFiltres() {
  const q = document.getElementById('recherche').value.trim().toLowerCase();
  document.querySelectorAll('.livre').forEach(livre => {
    const d = livre.dataset;
    const correspondTexte = !q ||
      d.titre.toLowerCase().includes(q) ||
      d.auteur.toLowerCase().includes(q) ||
      (d.saga || '').toLowerCase().includes(q);
    const correspondStatut = !filtreStatut || d.statut === filtreStatut;
    livre.classList.toggle('masque', !(correspondTexte && correspondStatut));
  });
  // Masquer les sagas/auteurs devenus vides
  document.querySelectorAll('.saga').forEach(s => {
    const visibles = s.querySelectorAll('.livre:not(.masque)').length;
    s.style.display = visibles ? '' : 'none';
  });
  document.querySelectorAll('.auteur').forEach(a => {
    const visibles = a.querySelectorAll('.livre:not(.masque)').length;
    a.style.display = visibles ? '' : 'none';
  });
}

document.getElementById('recherche').addEventListener('input', appliquerFiltres);
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('actif'));
    chip.classList.add('actif');
    filtreStatut = chip.dataset.statut;
    appliquerFiltres();
  });
});
```

- [ ] **Step 3: Vérification manuelle dans le navigateur**

D'abord migrer/charger des données réelles si besoin (déjà fait en Phase 1 : `library.db` contient des livres). Lancer le serveur :

Run: `.venv\Scripts\python.exe webapp.py`
Puis ouvrir http://127.0.0.1:8000 et vérifier :
- L'étagère affiche les livres possédés, groupés par auteur puis saga (tranches colorées, titre vertical).
- Cliquer un nom de saga la déplie/replie (tranches plus hautes).
- Cliquer un livre : il se met en avant (couverture si ISBN connu), les voisins s'écartent, le panneau d'infos s'ouvre à droite avec titre/auteur/saga/tome/statut/note/commentaire et le bouton ✏️ désactivé.
- La recherche filtre les tranches en direct ; les chips de statut filtrent ; « Tous » réaffiche tout.
- `/wishlist` affiche les livres à acheter.
- Fermer le serveur avec Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add static/shelf.css static/shelf.js
git commit -m "feat: add bookshelf styling and client-side interaction"
```

---

## Task 9 : Lancement configurable + documentation

**Files:**
- Modify: `README.md`

(Le lancement configurable hôte/port/`LIBRARY_DB` a déjà été codé en Task 4. Cette tâche documente.)

- [ ] **Step 1: Ajouter une section au `README.md`**

Ajouter, après la section « Lancement de l'Application » :

```markdown
## 🌐 Application web (consultation)

En plus de la console, une interface web permet de **consulter** la collection sous
forme d'étagère (lecture seule).

### Lancer le serveur
```bash
python webapp.py
```
Puis ouvrir http://127.0.0.1:8000 dans un navigateur.

### Accès depuis un autre appareil du réseau local
Par défaut le serveur n'écoute que sur la machine locale. Pour y accéder depuis un
autre ordinateur de la maison, définissez l'hôte avant de lancer :
```bash
# PowerShell
$env:LIBRARY_HOST = "0.0.0.0"; python webapp.py
```
puis ouvrez `http://<ip-du-serveur>:8000` depuis l'autre appareil.

Variables d'environnement disponibles : `LIBRARY_HOST` (défaut `127.0.0.1`),
`LIBRARY_PORT` (défaut `8000`), `LIBRARY_DB` (défaut `library.db`).

> ⚠️ L'application web est en **lecture seule** : les ajouts et modifications se font
> dans la console. L'écriture depuis le web, l'authentification et l'accès depuis
> internet viendront dans les phases suivantes.

### API JSON (lecture seule)
- `GET /api/books` — livres possédés
- `GET /api/books/{id}` — un livre
- `GET /api/wishlist` — livres à acheter
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document the web app, LAN access and JSON API"
```

---

## Vérification finale

- [ ] Lancer toute la suite de tests :

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

- [ ] Smoke test navigateur (Task 8, Step 3) validé.
- [ ] `git status` propre, `library.db` toujours ignoré.
