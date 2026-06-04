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
