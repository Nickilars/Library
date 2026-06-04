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
    assert r.text.count("Ma Saga") >= 1
    assert "Tome 1" in r.text and "Tome 2" in r.text


def test_wishlist():
    client = _client_avec_donnees()
    r = client.get("/wishlist")
    assert r.status_code == 200
    assert "À acheter" in r.text          # le livre wishlist
    assert "Le Hobbit" not in r.text      # un possédé non-wishlist n'y est pas


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


if __name__ == "__main__":
    test_health()
    test_accueil_liste_possedes()
    test_accueil_echappe_le_html()
    test_groupement_saga_dans_page()
    test_wishlist()
    test_api_books()
    test_api_book_par_id()
    test_api_book_inexistant()
    test_api_wishlist()
    print("OK : tests webapp passent.")
