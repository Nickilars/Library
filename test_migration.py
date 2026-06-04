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
