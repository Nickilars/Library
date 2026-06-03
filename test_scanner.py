#! /usr/bin/env python3
# Tests de la logique d'extraction d'ISBN du scanner (sans webcam).
# Lancer avec : python test_scanner.py

from scanner import extraire_isbn, nettoyer_titre_bnf, nettoyer_auteur_bnf

# Un vrai ISBN-13 est retourné tel quel
assert extraire_isbn(("9782070360024",)) == "9782070360024"

# L'ISBN est trouvé même s'il n'est pas en première position
# (cas réel : le petit code prix EAN-5 est décodé avant l'ISBN)
assert extraire_isbn(("12345", "9782070360024")) == "9782070360024"

# Les codes qui ne sont pas des ISBN sont rejetés
assert extraire_isbn(("12345",)) is None            # EAN-5 (code prix)
assert extraire_isbn(("[123. 456.]",)) is None      # garbage (ancien bug : coordonnées)
assert extraire_isbn(("1234567890123",)) is None    # 13 chiffres mais pas 978/979
assert extraire_isbn(()) is None                    # rien de décodé
assert extraire_isbn(("",)) is None                 # chaîne vide

# Les ISBN 979 (livres récents) sont acceptés aussi
assert extraire_isbn(("9791035204860",)) == "9791035204860"

# --- Nettoyage des données BnF (format bibliothécaire -> format lisible) ---

# Titre : on retire la mention de genre et la responsabilité (après " / ")
assert nettoyer_titre_bnf(
    "Le vaisseau magique : roman / Robin Hobb ; traduit de l'anglais (États-Unis) par A. Mousnier-Lompré"
) == "Le vaisseau magique"
assert nettoyer_titre_bnf("Dune") == "Dune"

# Auteur : "Nom, Prénom (dates). Rôle" -> "Prénom Nom"
assert nettoyer_auteur_bnf("Hobb, Robin (1952-....). Auteur du texte") == "Robin Hobb"
assert nettoyer_auteur_bnf("Camus, Albert (1913-1960)") == "Albert Camus"
assert nettoyer_auteur_bnf("Homère") == "Homère"

print("OK : tous les tests du scanner passent.")
