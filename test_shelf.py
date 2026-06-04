#! /usr/bin/env python3
# Tests des fonctions de présentation de l'étagère (pures, sans web).
import re
from shelf import couleur_tranche, grouper_livres
from book import Book


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


def test_groupement_insensible_casse():
    # Même auteur/saga avec une casse différente -> un seul groupe, pas deux.
    livres = [
        Book("Tome 1", "Tolkien", saga="Le Seigneur des anneaux", tome=1, possede=True),
        Book("Tome 2", "tolkien", saga="le seigneur des anneaux", tome=2, possede=True),
    ]
    groupes = grouper_livres(livres)
    assert len(groupes) == 1, f"attendu 1 auteur, obtenu {len(groupes)}"
    assert len(groupes[0]["sagas"]) == 1, "attendu 1 saga"
    assert len(groupes[0]["sagas"][0]["livres"]) == 2


if __name__ == "__main__":
    test_couleur_deterministe()
    test_couleur_format_hex()
    test_couleurs_differentes_selon_livre()
    test_groupement_structure()
    test_groupement_vide()
    test_groupement_insensible_casse()
    print("OK : tests couleur_tranche passent.")
