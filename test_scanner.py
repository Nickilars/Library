#! /usr/bin/env python3
# Tests de la logique d'extraction d'ISBN du scanner (sans webcam).
# Lancer avec : python test_scanner.py

from scanner import extraire_isbn, extraire_annee, parser_notice_unimarc

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

# --- Extraction de l'année dans une date au format libre ---

assert extraire_annee("1972") == "1972"
assert extraire_annee("07-01-1972") == "1972"      # date jour-mois-année d'Open Library
assert extraire_annee("DL 2025") == "2025"         # format "dépôt légal" de la BnF
assert extraire_annee("June 1997") == "1997"
assert extraire_annee("") == "Inconnue"
assert extraire_annee("Inconnue") == "Inconnue"
assert extraire_annee(None) == "Inconnue"

# --- Parsing des notices Unimarc de la BnF ---

# Notice complète typique (structure réelle, simplifiée) :
# 200 = titre, 214 = éditeur/date, 225 = collections, 461 = série mère, 700 = auteur
NOTICE_COMPLETE = """<racine>
  <datafield tag="200">
    <subfield code="a">Le vaisseau magique</subfield>
    <subfield code="e">roman</subfield>
  </datafield>
  <datafield tag="214">
    <subfield code="a">Paris</subfield>
    <subfield code="c">J'ai lu</subfield>
    <subfield code="d">DL 2025</subfield>
  </datafield>
  <datafield tag="225">
    <subfield code="a">Les aventuriers de la mer</subfield>
    <subfield code="v">1</subfield>
  </datafield>
  <datafield tag="225">
    <subfield code="a">J'ai lu</subfield>
    <subfield code="v">6736</subfield>
  </datafield>
  <datafield tag="461">
    <subfield code="t">Les aventuriers de la mer</subfield>
    <subfield code="v">1</subfield>
  </datafield>
  <datafield tag="700">
    <subfield code="a">Hobb</subfield>
    <subfield code="b">Robin</subfield>
  </datafield>
</racine>"""

infos = parser_notice_unimarc(NOTICE_COMPLETE)
assert infos["titre"] == "Le vaisseau magique"
assert infos["auteur"] == "Robin Hobb"
assert infos["annee"] == "2025"
assert infos["saga"] == "Les aventuriers de la mer"   # via le champ 461
assert infos["tome"] == 1   # via 461$v

# Sans champ 461 : repli sur le 225 qui n'est PAS la collection de l'éditeur
NOTICE_SANS_461 = """<racine>
  <datafield tag="200"><subfield code="a">Un titre</subfield></datafield>
  <datafield tag="214"><subfield code="c">J'ai lu</subfield><subfield code="d">2020</subfield></datafield>
  <datafield tag="225"><subfield code="a">J'ai lu</subfield></datafield>
  <datafield tag="225"><subfield code="a">Ma saga</subfield></datafield>
  <datafield tag="700"><subfield code="a">Nom</subfield><subfield code="b">Prénom</subfield></datafield>
</racine>"""
infos = parser_notice_unimarc(NOTICE_SANS_461)
assert infos["saga"] == "Ma saga"

# Sans saga du tout : "Aucune" (valeur par défaut du projet)
NOTICE_SANS_SAGA = """<racine>
  <datafield tag="200"><subfield code="a">Roman isolé</subfield></datafield>
  <datafield tag="214"><subfield code="c">Gallimard</subfield><subfield code="d">1999</subfield></datafield>
  <datafield tag="700"><subfield code="a">Camus</subfield><subfield code="b">Albert</subfield></datafield>
</racine>"""
infos = parser_notice_unimarc(NOTICE_SANS_SAGA)
assert infos["titre"] == "Roman isolé"
assert infos["auteur"] == "Albert Camus"
assert infos["annee"] == "1999"
assert infos["saga"] == "Aucune"
assert infos["tome"] is None

# Notice sans titre (livre absent du catalogue) : None
assert parser_notice_unimarc("<racine></racine>") is None

print("OK : tous les tests du scanner passent.")
