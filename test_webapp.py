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
