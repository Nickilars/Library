#! /usr/bin/env python3
# Tests de la couche d'accès aux données. Base SQLite en mémoire : chaque appel
# à init_db(":memory:") repart d'une base vierge, sans toucher les vraies données.
import database
from book import Book


def test_init_cree_table_vide():
    database.init_db(":memory:")
    assert database.get_all_books() == []


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


if __name__ == "__main__":
    test_init_cree_table_vide()
    test_validation_note_hors_domaine()
    test_validation_statut_invalide()
    test_validation_isbn_non_numerique()
    test_validation_titre_vide()
    test_validation_ok_normalise()
    print("OK : tests database (init) passent.")
