#! /usr/bin/env python3
# Tests des fonctions de présentation de l'étagère (pures, sans web).
import re
from shelf import couleur_tranche


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


if __name__ == "__main__":
    test_couleur_deterministe()
    test_couleur_format_hex()
    test_couleurs_differentes_selon_livre()
    print("OK : tests couleur_tranche passent.")
