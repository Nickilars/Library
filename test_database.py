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


if __name__ == "__main__":
    test_init_cree_table_vide()
    test_validation_note_hors_domaine()
    test_validation_statut_invalide()
    test_validation_isbn_non_numerique()
    test_validation_titre_vide()
    test_validation_ok_normalise()
    test_add_puis_get()
    test_get_book_inexistant()
    test_deux_livres_meme_titre()
    test_injection_sql_inoffensive()
    print("OK : tests database (init) passent.")
