#! /usr/bin/env python3
# Migration unique : inventory.json -> library.db.
# Lancer avec : python migrate.py
# inventory.json n'est jamais modifié (conservé comme sauvegarde).
import json
import database
from book import Book

CHEMIN_JSON = "inventory.json"


def migrer_donnees(donnees: dict) -> int:
    """Insère les livres de l'ancien format dans la base déjà initialisée.
    Refuse de s'exécuter si la base contient déjà des livres (anti-double-migration).
    Retourne le nombre de livres migrés."""
    if database.get_all_books():
        raise RuntimeError("La base contient déjà des livres : migration annulée.")

    nb = 0
    for infos in donnees.values():
        book = Book(
            titre=infos.get("titre", ""),
            auteur=infos.get("auteur", ""),
            annee_publication=infos.get("annee_publication", ""),
            saga=infos.get("saga", "Aucune"),
            statut_lecture="lu" if infos.get("deja_lu") else "non_lu",
            possede=bool(infos.get("posseder", False)),
        )
        database.add_book(book)
        nb += 1
    return nb


def main() -> None:
    database.init_db()
    try:
        with open(CHEMIN_JSON, "r", encoding="utf-8") as f:
            donnees = json.load(f)
    except FileNotFoundError:
        print(f"Aucun {CHEMIN_JSON} trouvé : rien à migrer (base vide prête).")
        return
    except json.JSONDecodeError:
        print(f"{CHEMIN_JSON} illisible ou corrompu : migration annulée, rien écrit.")
        return

    try:
        nb = migrer_donnees(donnees)
        print(f"OK : {nb} livre(s) migré(s) vers {database.DEFAULT_PATH}.")
        print(f"{CHEMIN_JSON} a été conservé intact comme sauvegarde.")
    except RuntimeError as e:
        print(f"Migration non effectuée : {e}")


if __name__ == "__main__":
    main()
