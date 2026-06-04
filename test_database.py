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
