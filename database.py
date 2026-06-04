#! /usr/bin/env python3
# Couche d'accès aux données (DAL). Encapsule tout le SQL : le reste du code
# n'appelle que ces fonctions, jamais sqlite3 directement.
import os
import stat
import sqlite3
from book import Book

DEFAULT_PATH = "library.db"

STATUTS_VALIDES = {"non_lu", "en_cours", "lu"}
LONGUEUR_MAX = 500

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
