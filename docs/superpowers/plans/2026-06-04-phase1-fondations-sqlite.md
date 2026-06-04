# Phase 1 — Fondations SQLite : Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le stockage JSON par une base SQLite, enrichir le modèle de données, et isoler l'accès aux données dans une couche testée et sécurisée, sans casser la console existante.

**Architecture:** Une couche d'accès aux données (`database.py`) encapsule tout le SQL via le module `sqlite3` intégré (requêtes paramétrées). Le modèle `Book` devient une dataclass enrichie. `Library` délègue à `database.py` au lieu de porter un dictionnaire en mémoire. Un script `migrate.py` convertit `inventory.json` vers `library.db` une seule fois.

**Tech Stack:** Python 3.14, `sqlite3` (intégré), `dataclasses` (intégré), Rich + InquirerPy (console existante). Tests : scripts d'assertions exécutés avec le Python du venv (convention existante de `test_scanner.py`), base SQLite en mémoire (`:memory:`).

**Convention de test du projet :** les tests sont des scripts autonomes (pas de pytest), exécutés via `.venv\Scripts\python.exe test_xxx.py`. Un test « échoue » en levant une `AssertionError` ; il « passe » en affichant sa ligne `OK`.

**Convention de commit :** messages en anglais, terminés par la ligne `Co-Authored-By` (voir le dernier step).

---

## Structure des fichiers

| Fichier | Responsabilité | Action |
|---|---|---|
| `book.py` | Modèle de données `Book` (dataclass) | Modifier |
| `database.py` | Couche d'accès SQLite : schéma, CRUD, recherche, doublons, validation | Créer |
| `migrate.py` | Conversion unique `inventory.json` → `library.db` | Créer |
| `library.py` | Opérations console, délègue à `database.py` | Modifier |
| `main.py` | Boucle principale, `init_db` au démarrage, nouveaux champs | Modifier |
| `scanner.py` | Ajout extraction du tome (`461$v`) | Modifier |
| `file.py` | Ancienne persistance JSON | Supprimer |
| `requirements.txt` | Dépendances épinglées (SEC-6) | Créer |
| `test_book.py` | Tests du modèle | Créer |
| `test_database.py` | Tests CRUD, recherche, doublons, validation, injection (SEC-1/2) | Créer |
| `test_migration.py` | Tests de la migration | Créer |

---

## Task 1 : Modèle Book enrichi (dataclass)

**Files:**
- Modify: `book.py` (remplacement complet)
- Test: `test_book.py` (créer)

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test_book.py` :

```python
#! /usr/bin/env python3
# Tests du modèle Book enrichi.
from book import Book


def test_valeurs_par_defaut():
    b = Book("Dune", "Herbert")
    assert b.titre == "Dune"
    assert b.auteur == "Herbert"
    assert b.annee_publication == ""
    assert b.isbn == ""
    assert b.saga == "Aucune"
    assert b.tome is None
    assert b.statut_lecture == "non_lu"
    assert b.possede is False
    assert b.wishlist is False
    assert b.note is None
    assert b.commentaire == ""
    assert b.date_ajout == ""
    assert b.date_lecture is None
    assert b.id is None


def test_tous_les_champs():
    b = Book(
        "Le vaisseau magique", "Robin Hobb", "2025",
        isbn="9782290424551", saga="Les aventuriers de la mer", tome=1,
        statut_lecture="lu", possede=True, wishlist=False, note=5,
        commentaire="Excellent", date_ajout="2026-06-04",
        date_lecture="2026-06-03", id=42,
    )
    assert b.tome == 1
    assert b.statut_lecture == "lu"
    assert b.note == 5
    assert b.id == 42


if __name__ == "__main__":
    test_valeurs_par_defaut()
    test_tous_les_champs()
    print("OK : tests du modèle Book passent.")
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `.venv\Scripts\python.exe test_book.py`
Expected: `TypeError` ou `AssertionError` (le modèle actuel n'a ni `isbn`, ni `tome`, ni `statut_lecture`).

- [ ] **Step 3: Réécrire `book.py` comme dataclass enrichie**

Remplacer **tout** le contenu de `book.py` par :

```python
from dataclasses import dataclass


@dataclass
class Book:
    """Un livre de la bibliothèque. Les booléens sont stockés en 0/1 dans SQLite ;
    statut_lecture vaut 'non_lu', 'en_cours' ou 'lu'."""
    titre: str
    auteur: str
    annee_publication: str = ""
    isbn: str = ""
    saga: str = "Aucune"
    tome: "int | None" = None
    statut_lecture: str = "non_lu"
    possede: bool = False
    wishlist: bool = False
    note: "int | None" = None
    commentaire: str = ""
    date_ajout: str = ""
    date_lecture: "str | None" = None
    id: "int | None" = None
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `.venv\Scripts\python.exe test_book.py`
Expected: `OK : tests du modèle Book passent.`

- [ ] **Step 5: Commit**

```bash
git add book.py test_book.py
git commit -m "feat: enrich Book model as dataclass with new fields"
```

---

## Task 2 : Couche database — connexion, schéma, permissions (SEC-3)

**Files:**
- Create: `database.py`
- Test: `test_database.py` (créer)

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test_database.py` :

```python
#! /usr/bin/env python3
# Tests de la couche d'accès aux données. Base SQLite en mémoire : chaque appel
# à init_db(":memory:") repart d'une base vierge, sans toucher les vraies données.
import database


def test_init_cree_table_vide():
    database.init_db(":memory:")
    assert database.get_all_books() == []


if __name__ == "__main__":
    test_init_cree_table_vide()
    print("OK : tests database (init) passent.")
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `.venv\Scripts\python.exe test_database.py`
Expected: `ModuleNotFoundError: No module named 'database'`.

- [ ] **Step 3: Créer `database.py` (connexion + schéma + permissions)**

```python
#! /usr/bin/env python3
# Couche d'accès aux données (DAL). Encapsule tout le SQL : le reste du code
# n'appelle que ces fonctions, jamais sqlite3 directement.
import os
import stat
import sqlite3
from book import Book

DEFAULT_PATH = "library.db"

# Connexion unique du processus, initialisée par init_db().
_conn = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS books (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    titre             TEXT NOT NULL,
    auteur            TEXT NOT NULL,
    annee_publication TEXT DEFAULT '',
    isbn              TEXT DEFAULT '',
    saga              TEXT DEFAULT 'Aucune',
    tome              INTEGER,
    statut_lecture    TEXT DEFAULT 'non_lu',
    possede           INTEGER DEFAULT 0,
    wishlist          INTEGER DEFAULT 0,
    note              INTEGER,
    commentaire       TEXT DEFAULT '',
    date_ajout        TEXT NOT NULL,
    date_lecture      TEXT
);
"""


def init_db(db_path: str = DEFAULT_PATH) -> None:
    """Ouvre (ou crée) la base et garantit que la table existe.
    Réinitialise la connexion du module — utilisé aussi par les tests avec ':memory:'."""
    global _conn

    fichier_neuf = db_path != ":memory:" and not os.path.exists(db_path)

    _conn = sqlite3.connect(db_path)
    _conn.row_factory = sqlite3.Row  # accès colonne par nom (row["titre"])
    _conn.execute("PRAGMA foreign_keys = ON")
    _conn.executescript(SCHEMA)
    _conn.commit()

    # SEC-3 : restreindre l'accès au fichier dès sa création (propriétaire seul).
    # Sur Windows, chmod ne gère que le bit lecture seule ; l'appel reste sans danger
    # et correct sur les systèmes POSIX (futur hébergement Linux).
    if fichier_neuf:
        try:
            os.chmod(db_path, stat.S_IRUSR | stat.S_IWUSR)
        except OSError:
            pass


def _get_conn() -> sqlite3.Connection:
    if _conn is None:
        raise RuntimeError("Base non initialisée : appelez init_db() d'abord.")
    return _conn


def _book_from_row(row: sqlite3.Row) -> Book:
    """Convertit une ligne SQLite en objet Book (0/1 -> booléens)."""
    return Book(
        titre=row["titre"],
        auteur=row["auteur"],
        annee_publication=row["annee_publication"],
        isbn=row["isbn"],
        saga=row["saga"],
        tome=row["tome"],
        statut_lecture=row["statut_lecture"],
        possede=bool(row["possede"]),
        wishlist=bool(row["wishlist"]),
        note=row["note"],
        commentaire=row["commentaire"],
        date_ajout=row["date_ajout"],
        date_lecture=row["date_lecture"],
        id=row["id"],
    )


def get_all_books() -> list:
    """Retourne tous les livres, triés par titre."""
    rows = _get_conn().execute("SELECT * FROM books ORDER BY titre COLLATE NOCASE").fetchall()
    return [_book_from_row(r) for r in rows]
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `.venv\Scripts\python.exe test_database.py`
Expected: `OK : tests database (init) passent.`

- [ ] **Step 5: Commit**

```bash
git add database.py test_database.py
git commit -m "feat: add database layer with schema, connection and file perms (SEC-3)"
```

---

## Task 3 : Validation centralisée des entrées (SEC-2)

**Files:**
- Modify: `database.py` (ajouter `valider_book`)
- Test: `test_database.py` (ajouter)

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `test_database.py`, avant le bloc `if __name__`, ces fonctions et leurs appels :

```python
def test_validation_note_hors_domaine():
    database.init_db(":memory:")
    mauvais = Book("T", "A", note=9)
    try:
        database.valider_book(mauvais)
        assert False, "note=9 aurait dû être rejetée"
    except ValueError:
        pass


def test_validation_statut_invalide():
    database.init_db(":memory:")
    mauvais = Book("T", "A", statut_lecture="zzz")
    try:
        database.valider_book(mauvais)
        assert False, "statut invalide aurait dû être rejeté"
    except ValueError:
        pass


def test_validation_isbn_non_numerique():
    database.init_db(":memory:")
    mauvais = Book("T", "A", isbn="abc")
    try:
        database.valider_book(mauvais)
        assert False, "ISBN non numérique aurait dû être rejeté"
    except ValueError:
        pass


def test_validation_titre_vide():
    database.init_db(":memory:")
    try:
        database.valider_book(Book("   ", "A"))
        assert False, "titre vide aurait dû être rejeté"
    except ValueError:
        pass


def test_validation_ok_normalise():
    database.init_db(":memory:")
    b = database.valider_book(Book("  Dune  ", "  Herbert  ", isbn="9782070360024"))
    assert b.titre == "Dune"       # espaces retirés
    assert b.auteur == "Herbert"
```

Et ajouter leurs appels dans le bloc `if __name__ == "__main__":` :

```python
    test_validation_note_hors_domaine()
    test_validation_statut_invalide()
    test_validation_isbn_non_numerique()
    test_validation_titre_vide()
    test_validation_ok_normalise()
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `.venv\Scripts\python.exe test_database.py`
Expected: `AttributeError: module 'database' has no attribute 'valider_book'`.

- [ ] **Step 3: Ajouter `valider_book` dans `database.py`**

Ajouter après `DEFAULT_PATH` les constantes, et après `_get_conn` la fonction :

```python
STATUTS_VALIDES = {"non_lu", "en_cours", "lu"}
LONGUEUR_MAX = 500
```

```python
def valider_book(book: Book) -> Book:
    """SEC-2 : valide et normalise un Book avant écriture. Lève ValueError si invalide.
    Retourne un Book normalisé (champs texte strip()és)."""
    titre = (book.titre or "").strip()
    auteur = (book.auteur or "").strip()
    if not titre:
        raise ValueError("Le titre est obligatoire.")
    if not auteur:
        raise ValueError("L'auteur est obligatoire.")

    for nom, valeur in (("titre", titre), ("auteur", auteur),
                        ("saga", book.saga), ("commentaire", book.commentaire)):
        if valeur and len(valeur) > LONGUEUR_MAX:
            raise ValueError(f"Le champ {nom} dépasse {LONGUEUR_MAX} caractères.")

    if book.statut_lecture not in STATUTS_VALIDES:
        raise ValueError(f"statut_lecture invalide : {book.statut_lecture!r}")

    if book.note is not None and not (0 <= book.note <= 5):
        raise ValueError("La note doit être comprise entre 0 et 5.")

    isbn = (book.isbn or "").strip()
    if isbn and not (isbn.isdigit() and len(isbn) == 13):
        raise ValueError("L'ISBN doit comporter 13 chiffres.")

    if book.tome is not None and book.tome < 0:
        raise ValueError("Le tome ne peut pas être négatif.")

    return Book(
        titre=titre, auteur=auteur,
        annee_publication=(book.annee_publication or "").strip(),
        isbn=isbn, saga=(book.saga or "Aucune").strip() or "Aucune",
        tome=book.tome, statut_lecture=book.statut_lecture,
        possede=bool(book.possede), wishlist=bool(book.wishlist),
        note=book.note, commentaire=(book.commentaire or "").strip(),
        date_ajout=book.date_ajout, date_lecture=book.date_lecture, id=book.id,
    )
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `.venv\Scripts\python.exe test_database.py`
Expected: `OK : tests database (init) passent.`

- [ ] **Step 5: Commit**

```bash
git add database.py test_database.py
git commit -m "feat: add centralized input validation (SEC-2)"
```

---

## Task 4 : add_book, get_book + test d'injection (SEC-1)

**Files:**
- Modify: `database.py`
- Test: `test_database.py` (ajouter)

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `test_database.py` :

```python
def test_add_puis_get():
    database.init_db(":memory:")
    nouvel_id = database.add_book(Book("Dune", "Herbert", "1965", statut_lecture="lu"))
    assert isinstance(nouvel_id, int)
    b = database.get_book(nouvel_id)
    assert b.titre == "Dune"
    assert b.statut_lecture == "lu"
    assert b.id == nouvel_id
    assert b.date_ajout != ""  # rempli automatiquement


def test_get_book_inexistant():
    database.init_db(":memory:")
    assert database.get_book(999) is None


def test_deux_livres_meme_titre():
    # Régression : le bug d'origine écrasait les homonymes.
    database.init_db(":memory:")
    database.add_book(Book("Le Cycle", "Auteur A"))
    database.add_book(Book("Le Cycle", "Auteur B"))
    assert len(database.get_all_books()) == 2


def test_injection_sql_inoffensive():
    # SEC-1 : une valeur piégée est traitée comme une donnée littérale.
    database.init_db(":memory:")
    piege = "Dune'); DROP TABLE books;--"
    database.add_book(Book(piege, "Herbert"))
    livres = database.get_all_books()
    assert len(livres) == 1
    assert livres[0].titre == piege  # stocké tel quel, table intacte
```

Ajouter les appels correspondants dans le bloc `if __name__`.

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `.venv\Scripts\python.exe test_database.py`
Expected: `AttributeError: module 'database' has no attribute 'add_book'`.

- [ ] **Step 3: Ajouter `add_book` et `get_book` dans `database.py`**

Ajouter l'import en haut du fichier (avec les autres imports) :

```python
import datetime
```

Ajouter les fonctions :

```python
def add_book(book: Book) -> int:
    """Valide puis insère un livre. Retourne l'id généré.
    Remplit date_ajout (date du jour) si absent."""
    book = valider_book(book)
    date_ajout = book.date_ajout or datetime.date.today().isoformat()

    conn = _get_conn()
    cur = conn.execute(
        """INSERT INTO books
           (titre, auteur, annee_publication, isbn, saga, tome, statut_lecture,
            possede, wishlist, note, commentaire, date_ajout, date_lecture)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (book.titre, book.auteur, book.annee_publication, book.isbn, book.saga,
         book.tome, book.statut_lecture, int(book.possede), int(book.wishlist),
         book.note, book.commentaire, date_ajout, book.date_lecture),
    )
    conn.commit()
    return cur.lastrowid


def get_book(book_id: int) -> "Book | None":
    row = _get_conn().execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
    return _book_from_row(row) if row else None
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `.venv\Scripts\python.exe test_database.py`
Expected: `OK : tests database (init) passent.`

- [ ] **Step 5: Commit**

```bash
git add database.py test_database.py
git commit -m "feat: add add_book/get_book; verify SQL injection safety (SEC-1)"
```

---

## Task 5 : update_book, delete_book

**Files:**
- Modify: `database.py`
- Test: `test_database.py` (ajouter)

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `test_database.py` :

```python
def test_update():
    database.init_db(":memory:")
    bid = database.add_book(Book("Dune", "Herbert", statut_lecture="non_lu"))
    b = database.get_book(bid)
    b.statut_lecture = "lu"
    b.note = 5
    database.update_book(b)
    relu = database.get_book(bid)
    assert relu.statut_lecture == "lu"
    assert relu.note == 5


def test_delete():
    database.init_db(":memory:")
    bid = database.add_book(Book("Dune", "Herbert"))
    database.delete_book(bid)
    assert database.get_book(bid) is None
    assert database.get_all_books() == []
```

Ajouter les appels dans le bloc `if __name__`.

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `.venv\Scripts\python.exe test_database.py`
Expected: `AttributeError: module 'database' has no attribute 'update_book'`.

- [ ] **Step 3: Ajouter `update_book` et `delete_book`**

```python
def update_book(book: Book) -> None:
    """Valide puis met à jour le livre identifié par book.id."""
    if book.id is None:
        raise ValueError("update_book nécessite un id.")
    valide = valider_book(book)
    conn = _get_conn()
    conn.execute(
        """UPDATE books SET
             titre=?, auteur=?, annee_publication=?, isbn=?, saga=?, tome=?,
             statut_lecture=?, possede=?, wishlist=?, note=?, commentaire=?,
             date_ajout=?, date_lecture=?
           WHERE id=?""",
        (valide.titre, valide.auteur, valide.annee_publication, valide.isbn,
         valide.saga, valide.tome, valide.statut_lecture, int(valide.possede),
         int(valide.wishlist), valide.note, valide.commentaire,
         book.date_ajout, valide.date_lecture, book.id),
    )
    conn.commit()


def delete_book(book_id: int) -> None:
    conn = _get_conn()
    conn.execute("DELETE FROM books WHERE id = ?", (book_id,))
    conn.commit()
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `.venv\Scripts\python.exe test_database.py`
Expected: `OK : tests database (init) passent.`

- [ ] **Step 5: Commit**

```bash
git add database.py test_database.py
git commit -m "feat: add update_book/delete_book"
```

---

## Task 6 : search_books

**Files:**
- Modify: `database.py`
- Test: `test_database.py` (ajouter)

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `test_database.py` :

```python
def _jeu_de_test():
    database.init_db(":memory:")
    database.add_book(Book("Dune", "Frank Herbert", saga="Dune", statut_lecture="lu"))
    database.add_book(Book("1984", "George Orwell", statut_lecture="non_lu"))
    database.add_book(Book("Les Messies de Dune", "Frank Herbert", saga="Dune",
                           statut_lecture="en_cours"))


def test_search_par_titre():
    _jeu_de_test()
    res = database.search_books(titre="dune")
    assert {b.titre for b in res} == {"Dune", "Les Messies de Dune"}


def test_search_par_auteur():
    _jeu_de_test()
    res = database.search_books(auteur="orwell")
    assert len(res) == 1 and res[0].titre == "1984"


def test_search_par_saga():
    _jeu_de_test()
    res = database.search_books(saga="Dune")
    assert len(res) == 2


def test_search_par_statut():
    _jeu_de_test()
    res = database.search_books(statut_lecture="lu")
    assert len(res) == 1 and res[0].titre == "Dune"
```

Ajouter les appels dans le bloc `if __name__`.

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `.venv\Scripts\python.exe test_database.py`
Expected: `AttributeError: module 'database' has no attribute 'search_books'`.

- [ ] **Step 3: Ajouter `search_books`**

```python
def search_books(titre: str = "", auteur: str = "", saga: str = "",
                 statut_lecture: str = "") -> list:
    """Recherche par critères combinables (ET). Les champs texte sont en sous-chaîne
    insensible à la casse. Critères vides = ignorés. Requête entièrement paramétrée (SEC-1)."""
    clauses = []
    params = []
    if titre.strip():
        clauses.append("titre LIKE ? COLLATE NOCASE")
        params.append(f"%{titre.strip()}%")
    if auteur.strip():
        clauses.append("auteur LIKE ? COLLATE NOCASE")
        params.append(f"%{auteur.strip()}%")
    if saga.strip():
        clauses.append("saga LIKE ? COLLATE NOCASE")
        params.append(f"%{saga.strip()}%")
    if statut_lecture.strip():
        clauses.append("statut_lecture = ?")
        params.append(statut_lecture.strip())

    sql = "SELECT * FROM books"
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY titre COLLATE NOCASE"

    rows = _get_conn().execute(sql, params).fetchall()
    return [_book_from_row(r) for r in rows]
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `.venv\Scripts\python.exe test_database.py`
Expected: `OK : tests database (init) passent.`

- [ ] **Step 5: Commit**

```bash
git add database.py test_database.py
git commit -m "feat: add search_books with combinable criteria"
```

---

## Task 7 : Détection de doublon

**Files:**
- Modify: `database.py`
- Test: `test_database.py` (ajouter)

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `test_database.py` :

```python
def test_doublon_par_isbn():
    database.init_db(":memory:")
    database.add_book(Book("Dune", "Herbert", isbn="9782070360024"))
    trouve = database.trouver_doublon(isbn="9782070360024", titre="Autre", auteur="X")
    assert trouve is not None and trouve.titre == "Dune"


def test_doublon_par_titre_auteur_insensible_casse():
    database.init_db(":memory:")
    database.add_book(Book("Dune", "Frank Herbert"))
    trouve = database.trouver_doublon(isbn="", titre="DUNE", auteur="frank herbert")
    assert trouve is not None


def test_pas_de_doublon():
    database.init_db(":memory:")
    database.add_book(Book("Dune", "Herbert"))
    assert database.trouver_doublon(isbn="", titre="1984", auteur="Orwell") is None
```

Ajouter les appels dans le bloc `if __name__`.

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `.venv\Scripts\python.exe test_database.py`
Expected: `AttributeError: module 'database' has no attribute 'trouver_doublon'`.

- [ ] **Step 3: Ajouter `trouver_doublon`**

```python
def trouver_doublon(isbn: str, titre: str, auteur: str) -> "Book | None":
    """Retourne un livre existant considéré comme doublon, sinon None.
    Règle : même ISBN (s'il est renseigné), sinon même (titre + auteur) à la casse près."""
    conn = _get_conn()
    isbn = (isbn or "").strip()
    if isbn:
        row = conn.execute("SELECT * FROM books WHERE isbn = ? AND isbn != ''",
                           (isbn,)).fetchone()
        if row:
            return _book_from_row(row)

    row = conn.execute(
        "SELECT * FROM books WHERE titre = ? COLLATE NOCASE AND auteur = ? COLLATE NOCASE",
        ((titre or "").strip(), (auteur or "").strip()),
    ).fetchone()
    return _book_from_row(row) if row else None
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `.venv\Scripts\python.exe test_database.py`
Expected: `OK : tests database (init) passent.`

- [ ] **Step 5: Commit**

```bash
git add database.py test_database.py
git commit -m "feat: add duplicate detection by ISBN or title+author"
```

---

## Task 8 : Script de migration JSON → SQLite

**Files:**
- Create: `migrate.py`
- Test: `test_migration.py` (créer)

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test_migration.py` :

```python
#! /usr/bin/env python3
# Tests du mapping de migration (sans toucher aux vrais fichiers).
import database
from migrate import migrer_donnees


# Données telles que produites par l'ancien file.py (book.__dict__).
ANCIEN_JSON = {
    "Dune": {
        "titre": "Dune", "auteur": "Herbert", "saga": "Dune",
        "annee_publication": "1965", "posseder": True, "deja_lu": True,
    },
    "1984": {
        "titre": "1984", "auteur": "Orwell", "saga": "Aucune",
        "annee_publication": "1949", "posseder": False, "deja_lu": False,
    },
}


def test_mapping_statut_et_possession():
    database.init_db(":memory:")
    nb = migrer_donnees(ANCIEN_JSON)
    assert nb == 2

    livres = {b.titre: b for b in database.get_all_books()}
    assert livres["Dune"].statut_lecture == "lu"      # deja_lu True -> "lu"
    assert livres["Dune"].possede is True
    assert livres["1984"].statut_lecture == "non_lu"  # deja_lu False -> "non_lu"
    assert livres["1984"].possede is False
    assert livres["Dune"].date_ajout != ""            # rempli


def test_refus_si_base_non_vide():
    database.init_db(":memory:")
    migrer_donnees(ANCIEN_JSON)
    try:
        migrer_donnees(ANCIEN_JSON)
        assert False, "la 2e migration aurait dû être refusée"
    except RuntimeError:
        pass


if __name__ == "__main__":
    test_mapping_statut_et_possession()
    test_refus_si_base_non_vide()
    print("OK : tests de migration passent.")
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `.venv\Scripts\python.exe test_migration.py`
Expected: `ModuleNotFoundError: No module named 'migrate'`.

- [ ] **Step 3: Créer `migrate.py`**

```python
#! /usr/bin/env python3
# Migration unique : inventory.json -> library.db.
# Lancer avec : python migrate.py
# inventory.json n'est jamais modifié (conservé comme sauvegarde).
import json
import database
from book import Book

CHEMIN_JSON = "inventory.json"


def migrer_donnees(donnees: dict) -> int:
    """Insère les livres de l'ancien format dans la base déjà initialisée.
    Refuse de s'exécuter si la base contient déjà des livres (anti-double-migration).
    Retourne le nombre de livres migrés."""
    if database.get_all_books():
        raise RuntimeError("La base contient déjà des livres : migration annulée.")

    nb = 0
    for infos in donnees.values():
        book = Book(
            titre=infos.get("titre", ""),
            auteur=infos.get("auteur", ""),
            annee_publication=infos.get("annee_publication", ""),
            saga=infos.get("saga", "Aucune"),
            statut_lecture="lu" if infos.get("deja_lu") else "non_lu",
            possede=bool(infos.get("posseder", False)),
        )
        database.add_book(book)
        nb += 1
    return nb


def main() -> None:
    database.init_db()
    try:
        with open(CHEMIN_JSON, "r", encoding="utf-8") as f:
            donnees = json.load(f)
    except FileNotFoundError:
        print(f"Aucun {CHEMIN_JSON} trouvé : rien à migrer (base vide prête).")
        return
    except json.JSONDecodeError:
        print(f"{CHEMIN_JSON} illisible ou corrompu : migration annulée, rien écrit.")
        return

    try:
        nb = migrer_donnees(donnees)
        print(f"OK : {nb} livre(s) migré(s) vers {database.DEFAULT_PATH}.")
        print(f"{CHEMIN_JSON} a été conservé intact comme sauvegarde.")
    except RuntimeError as e:
        print(f"Migration non effectuée : {e}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `.venv\Scripts\python.exe test_migration.py`
Expected: `OK : tests de migration passent.`

- [ ] **Step 5: Commit**

```bash
git add migrate.py test_migration.py
git commit -m "feat: add JSON to SQLite migration script with safety guard"
```

---

## Task 9 : Brancher Library sur database.py

**Files:**
- Modify: `library.py` (méthodes `add_book`, `search_book`, `modify_book`, `remove_book`, `display_inventory`, `__init__`)

Cette tâche est une UI console interactive (InquirerPy/Rich), difficile à tester en unitaire : la vérification se fait manuellement à l'étape 4.

- [ ] **Step 1: Réécrire `__init__` et `add_book`**

Dans `library.py`, ajouter l'import en tête :

```python
import database
```

Remplacer `__init__` et `add_book` (lignes ~12-20) par :

```python
    def __init__(self) -> None:
        # Les données vivent désormais dans SQLite (database.py), plus en mémoire.
        pass

    def add_book(self, book: Book) -> None:
        doublon = database.trouver_doublon(book.isbn, book.titre, book.auteur)
        if doublon is not None:
            console.print(Panel(
                f"[yellow]⚠️ {doublon.titre}[/yellow] de {doublon.auteur} est déjà dans la bibliothèque.",
                border_style="yellow"))
            return
        try:
            database.add_book(book)
            console.print(Panel(
                f"[green]✔ {book.titre}[/green] de {book.auteur} ajouté à la bibliothèque.",
                border_style="green"))
        except ValueError as e:
            console.print(Panel(f"[red]❌ Données invalides : {e}[/red]", border_style="red"))
```

- [ ] **Step 2: Réécrire `search_book` pour lire la base**

Remplacer la méthode `search_book` par une version qui prend des critères texte et appelle `database.search_books` :

```python
    def search_book(self, titre="", auteur="", saga="", statut_lecture="") -> None:
        resultats = database.search_books(titre=titre, auteur=auteur,
                                          saga=saga, statut_lecture=statut_lecture)
        table = Table(title="🔍 Résultats de la recherche", style="bold blue",
                      header_style="bold cyan")
        table.add_column("Possédé", justify="center", width=8)
        table.add_column("Statut", justify="center", width=10)
        table.add_column("Titre", style="white bold")
        table.add_column("Saga", style="italic cyan")
        table.add_column("Auteur", style="yellow")
        table.add_column("Année", justify="center", style="green")

        if not resultats:
            console.print("[bold red]❌ Aucun livre ne correspond à votre recherche.[/bold red]")
            return

        for b in resultats:
            icon_possede = "[green]☑[/green]" if b.possede else "[red]☐[/red]"
            statut = {"non_lu": "À lire", "en_cours": "En cours", "lu": "Lu"}.get(
                b.statut_lecture, b.statut_lecture)
            table.add_row(icon_possede, statut, b.titre, b.saga, b.auteur,
                          str(b.annee_publication))
        console.print(table)
```

- [ ] **Step 3: Réécrire `modify_book`, `remove_book`, `display_inventory`**

Remplacer `modify_book` par une version qui charge depuis la base et sauvegarde via `update_book` :

```python
    def modify_book(self) -> None:
        livres = database.get_all_books()
        if not livres:
            console.print("[bold red]❌ La bibliothèque est vide, rien à modifier.[/bold red]")
            return

        choix = {f"{b.titre} (par {b.auteur})": b for b in livres}
        os.system('cls' if os.name == 'nt' else 'clear')
        texte = inquirer.select(message="Sélectionnez le livre à modifier :",
                                choices=list(choix.keys()), pointer="👉").execute()
        target = choix[texte]

        os.system('cls' if os.name == 'nt' else 'clear')
        console.print(f"[bold cyan]Modification de :[/bold cyan] {target.titre}\n")
        option = inquirer.select(
            message="Que voulez-vous modifier ?",
            choices=[
                {"name": "Titre", "value": "titre"},
                {"name": "Auteur", "value": "auteur"},
                {"name": "Année de publication", "value": "annee"},
                {"name": "Saga", "value": "saga"},
                {"name": "Tome (numéro dans la saga)", "value": "tome"},
                {"name": "Statut de lecture", "value": "statut"},
                {"name": "Possédé", "value": "possede"},
                {"name": "Wishlist", "value": "wishlist"},
                {"name": "Note (0-5)", "value": "note"},
                {"name": "Commentaire", "value": "commentaire"},
            ], pointer="👉").execute()

        if option == "titre":
            target.titre = input("\nNouveau titre : ").strip() or target.titre
        elif option == "auteur":
            target.auteur = input("\nNouvel auteur : ").strip() or target.auteur
        elif option == "annee":
            target.annee_publication = input("\nNouvelle année : ").strip()
        elif option == "saga":
            target.saga = input("\nNom de la saga : ").strip() or "Aucune"
        elif option == "tome":
            saisie = input("\nNuméro de tome (vide pour aucun) : ").strip()
            target.tome = int(saisie) if saisie.isdigit() else None
        elif option == "statut":
            target.statut_lecture = inquirer.select(
                message="Statut de lecture :",
                choices=[{"name": "À lire", "value": "non_lu"},
                         {"name": "En cours", "value": "en_cours"},
                         {"name": "Lu", "value": "lu"}]).execute()
        elif option == "possede":
            target.possede = inquirer.select(
                message="Possédé ?",
                choices=[{"name": "Oui", "value": True}, {"name": "Non", "value": False}]).execute()
        elif option == "wishlist":
            target.wishlist = inquirer.select(
                message="Dans la wishlist ?",
                choices=[{"name": "Oui", "value": True}, {"name": "Non", "value": False}]).execute()
        elif option == "note":
            saisie = input("\nNote (0-5, vide pour aucune) : ").strip()
            target.note = int(saisie) if saisie.isdigit() and 0 <= int(saisie) <= 5 else None
        elif option == "commentaire":
            target.commentaire = input("\nCommentaire : ").strip()

        try:
            database.update_book(target)
            console.print("\n[green]✔[/green] Livre mis à jour.")
        except ValueError as e:
            console.print(f"\n[red]❌ Données invalides : {e}[/red]")
        input("\nAppuyez sur Entrée pour continuer...")
```

Remplacer `remove_book` par :

```python
    def remove_book(self) -> None:
        livres = database.get_all_books()
        if not livres:
            console.print("[bold red]❌ La bibliothèque est vide, aucun livre à supprimer.[/bold red]")
            time.sleep(2)
            return

        choix = {f"{b.titre} (par {b.auteur})": b for b in livres}
        os.system('cls' if os.name == 'nt' else 'clear')
        texte = inquirer.select(message="Sélectionnez le livre à supprimer :",
                                choices=list(choix.keys()), pointer="👉").execute()
        cible = choix[texte]

        confirmation = inquirer.select(
            message=f"Supprimer définitivement '{cible.titre}' ?",
            choices=[{"name": "Non, annuler", "value": False},
                     {"name": "Oui, supprimer", "value": True}]).execute()

        if confirmation:
            database.delete_book(cible.id)
            console.print(Panel(
                f"[red]🗑️ {cible.titre}[/red] de {cible.auteur} a été supprimé.",
                border_style="red"))
        else:
            console.print("[bold yellow]⚠️ Suppression annulée.[/bold yellow]")
        time.sleep(2)
```

Remplacer `display_inventory` par :

```python
    def display_inventory(self) -> None:
        livres = database.get_all_books()
        if not livres:
            console.print("[yellow]La bibliothèque est vide.[/yellow]")
            return

        order = inquirer.select(
            message="Choisissez une option de tri :",
            choices=[
                {"name": "🔤 Par titre", "value": "titre"},
                {"name": "👤 Par auteur", "value": "auteur"},
                {"name": "🎬 Par saga", "value": "saga"},
            ], pointer="👉").execute()

        if order == "auteur":
            livres.sort(key=lambda x: x.auteur.lower())
        elif order == "saga":
            livres.sort(key=lambda x: (x.saga.lower(), x.titre.lower()))
        else:
            livres.sort(key=lambda x: x.titre.lower())

        os.system('cls' if os.name == 'nt' else 'clear')
        tableau = Table(title="📚 Liste des livres", style="bold magenta",
                        header_style="bold cyan")
        tableau.add_column("Titre", style="white bold")
        tableau.add_column("Saga / Série", style="italic cyan", width=20)
        tableau.add_column("Tome", justify="center", width=5)
        tableau.add_column("Auteur", style="yellow")
        tableau.add_column("Année", justify="center", style="green")
        tableau.add_column("Possédé", justify="center", width=8)
        tableau.add_column("Statut", justify="center", width=10)
        tableau.add_column("Note", justify="center", width=5)

        for b in livres:
            icon_possede = "[green]☑[/green]" if b.possede else "[red]☐[/red]"
            statut = {"non_lu": "À lire", "en_cours": "En cours", "lu": "Lu"}.get(
                b.statut_lecture, b.statut_lecture)
            saga = "[dim]Aucune[/dim]" if b.saga == "Aucune" else b.saga
            note = "★" * b.note if b.note else "[dim]-[/dim]"
            tableau.add_row(b.titre, saga, str(b.tome or "-"), b.auteur,
                            str(b.annee_publication), icon_possede, statut, note)
        console.print(tableau)
```

- [ ] **Step 4: Vérification manuelle**

Run: `.venv\Scripts\python.exe -m py_compile library.py`
Expected: aucune erreur (compilation OK). Le test fonctionnel complet se fait en Task 10.

- [ ] **Step 5: Commit**

```bash
git add library.py
git commit -m "refactor: wire Library to database layer; surface new fields"
```

---

## Task 10 : Mettre à jour main.py et retirer file.py

**Files:**
- Modify: `main.py`
- Delete: `file.py`

- [ ] **Step 1: Remplacer l'import et le chargement initial**

Dans `main.py`, remplacer la ligne `import file` par `import database`, et supprimer l'import de `scanner`/autres seulement s'ils ne servent plus (garder `scanner`).

Remplacer le bloc de démarrage :

```python
    library = file.load_library()
```

par :

```python
    database.init_db()
    library = Library()
```

- [ ] **Step 2: Adapter le cas "1" (ajout) aux nouveaux champs**

Dans le `case "1"`, remplacer la création finale du livre (le bloc `if continuer_ajout:`) par :

```python
                if continuer_ajout:
                    statut = inquirer.select(
                        message=f"Statut de lecture pour « {titre} » ?",
                        choices=[{"name": "À lire", "value": "non_lu"},
                                 {"name": "En cours", "value": "en_cours"},
                                 {"name": "Lu", "value": "lu"}]).execute()
                    possede = inquirer.select(
                        message="Le possédez-vous ?",
                        choices=[{"name": "Oui", "value": True},
                                 {"name": "Non", "value": False}]).execute()

                    book = Book(titre, auteur, annee_publication, saga=saga,
                                statut_lecture=statut, possede=possede)
                    library.add_book(book)
                    time.sleep(2.5)
```

- [ ] **Step 3: Adapter le cas "3" (recherche) à la nouvelle signature**

Remplacer tout le `case "3":` par :

```python
            case "3":
                os.system('cls' if os.name == 'nt' else 'clear')
                critere = inquirer.select(
                    message="Rechercher par :",
                    choices=[{"name": "Titre", "value": "titre"},
                             {"name": "Auteur", "value": "auteur"},
                             {"name": "Saga", "value": "saga"},
                             {"name": "Statut de lecture", "value": "statut"}],
                    pointer="👉").execute()

                if critere == "titre":
                    library.search_book(titre=input("Titre : ").strip())
                elif critere == "auteur":
                    library.search_book(auteur=input("Auteur : ").strip())
                elif critere == "saga":
                    library.search_book(saga=input("Saga : ").strip())
                elif critere == "statut":
                    statut = inquirer.select(
                        message="Quel statut ?",
                        choices=[{"name": "À lire", "value": "non_lu"},
                                 {"name": "En cours", "value": "en_cours"},
                                 {"name": "Lu", "value": "lu"}]).execute()
                    library.search_book(statut_lecture=statut)

                input("\nAppuyez sur Entrée pour revenir au menu...")
                os.system('cls' if os.name == 'nt' else 'clear')
```

- [ ] **Step 4: Simplifier le cas "6" (quitter)**

Comme les données sont écrites en continu, remplacer le `case "6":` par :

```python
            case "6":
                os.system('cls' if os.name == 'nt' else 'clear')
                console.print("[bold yellow]Au revoir ![/bold yellow]")
                time.sleep(1.5)
                os.system('cls' if os.name == 'nt' else 'clear')
                break
```

- [ ] **Step 5: Si la saga est détectée au scan, pré-remplir le tome**

Dans le `case "1"`, après le bloc où l'on récupère `saga_trouvee`, le tome n'est pas encore exploité côté Book. Laisser tel quel pour l'instant (le tome sera proposé via la modification). Pas de changement de code ici — étape de vérification uniquement : relire le `case "1"` pour confirmer qu'il compile.

- [ ] **Step 6: Supprimer file.py et vérifier**

```bash
git rm file.py
```

Run: `.venv\Scripts\python.exe -m py_compile main.py library.py database.py book.py scanner.py migrate.py`
Expected: aucune erreur.

- [ ] **Step 7: Test fonctionnel manuel**

Run: `.venv\Scripts\python.exe migrate.py`
Expected: `OK : N livre(s) migré(s)...` (ou message « rien à migrer » si pas de JSON).

Run: `.venv\Scripts\python.exe main.py`
Expected : le menu s'ouvre, l'inventaire affiche les livres migrés avec les nouvelles colonnes (Statut, Tome, Note). Tester un ajout manuel, une recherche, une modification, une suppression.

- [ ] **Step 8: Commit**

```bash
git add main.py
git commit -m "feat: use database layer in main.py, drop JSON persistence (file.py)"
```

---

## Task 11 : Extraction du tome dans le scanner (BnF 461$v)

**Files:**
- Modify: `scanner.py` (fonction `parser_notice_unimarc`)
- Test: `test_scanner.py` (ajouter)

- [ ] **Step 1: Écrire le test qui échoue**

Dans `test_scanner.py`, dans le test `parser_notice_unimarc` de la `NOTICE_COMPLETE`, ajouter l'assertion :

```python
assert infos["tome"] == 1   # via 461$v
```

Et pour `NOTICE_SANS_SAGA`, ajouter :

```python
assert infos["tome"] is None
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `.venv\Scripts\python.exe test_scanner.py`
Expected: `KeyError: 'tome'`.

- [ ] **Step 3: Ajouter l'extraction du tome dans `parser_notice_unimarc`**

Dans `scanner.py`, juste avant le `return` final de `parser_notice_unimarc`, ajouter :

```python
    # Tome : numéro de volume dans la série, champ 461$v (ex : "1").
    tome_brut = premier("461", "v")
    tome = int(tome_brut) if tome_brut.isdigit() else None
```

Puis ajouter `"tome": tome,` dans le dictionnaire retourné :

```python
    return {
        "titre": titre,
        "auteur": auteur,
        "annee": annee,
        "saga": saga or "Aucune",
        "tome": tome,
    }
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `.venv\Scripts\python.exe test_scanner.py`
Expected: `OK : tous les tests du scanner passent.`

- [ ] **Step 5: Commit**

```bash
git add scanner.py test_scanner.py
git commit -m "feat: extract volume number (tome) from BnF Unimarc 461\$v"
```

---

## Task 12 : requirements.txt épinglé (SEC-6)

**Files:**
- Create: `requirements.txt`

- [ ] **Step 1: Générer la liste des versions installées**

Run: `.venv\Scripts\python.exe -m pip freeze`
Expected: une liste de paquets avec versions (rich, InquirerPy, opencv-python, requests, et leurs dépendances).

- [ ] **Step 2: Créer `requirements.txt` avec les dépendances directes épinglées**

Créer `requirements.txt` en y reportant les **versions exactes** affichées par `pip freeze` pour les 4 dépendances directes (remplacer les `X.Y.Z` par les valeurs réelles) :

```
rich==X.Y.Z
InquirerPy==X.Y.Z
opencv-python==X.Y.Z
requests==X.Y.Z
```

- [ ] **Step 3: Vérifier l'installation reproductible et auditer**

Run: `.venv\Scripts\python.exe -m pip install -r requirements.txt`
Expected: `Requirement already satisfied` pour chaque ligne (aucune erreur de version).

Run (audit de vulnérabilités SEC-6) : `.venv\Scripts\python.exe -m pip install pip-audit && .venv\Scripts\python.exe -m pip_audit`
Expected: rapport d'audit. Noter toute vulnérabilité signalée (à traiter si présente).

- [ ] **Step 4: Commit**

```bash
git add requirements.txt
git commit -m "chore: pin dependencies in requirements.txt (SEC-6)"
```

---

## Task 13 : Mise à jour du README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Mettre à jour la section installation et fonctionnalités**

Dans `README.md`, remplacer la commande d'installation `pip install ...` par :

```bash
pip install -r requirements.txt
```

Ajouter une section sur la base de données et la migration :

```markdown
## 💾 Données

Les livres sont stockés dans une base SQLite locale (`library.db`).

### Migration depuis l'ancienne version (inventory.json)
Si vous venez d'une version antérieure qui utilisait `inventory.json`, lancez une
seule fois :
```bash
python migrate.py
```
Vos données seront copiées dans `library.db`. Le fichier `inventory.json` est conservé
intact comme sauvegarde.
```

Mettre à jour la liste des fonctionnalités pour mentionner : statut de lecture (à lire /
en cours / lu), tome dans la saga, note personnelle, wishlist, commentaire.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document SQLite storage, migration and new book fields"
```

---

## Vérification finale

- [ ] Lancer toute la suite de tests :

```bash
.venv\Scripts\python.exe test_book.py
.venv\Scripts\python.exe test_database.py
.venv\Scripts\python.exe test_migration.py
.venv\Scripts\python.exe test_scanner.py
```

Expected : chaque fichier affiche sa ligne `OK`.

- [ ] Confirmer que `library.db` est bien ignoré par git :

```bash
git status --short
```

Expected : `library.db` n'apparaît pas dans la liste.

- [ ] Lancer l'application et vérifier le cycle complet (ajout par scan, inventaire enrichi, recherche, modification, suppression).
