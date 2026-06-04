from dataclasses import dataclass


@dataclass
class Book:
    """Un livre de la bibliothèque. Les booléens sont stockés en 0/1 dans SQLite ;
    statut_lecture vaut 'non_lu', 'en_cours' ou 'lu'."""
    titre: str
    auteur: str
    annee_publication: str = ""
    isbn: str = ""
    saga: str = "Aucune"
    tome: "int | None" = None
    statut_lecture: str = "non_lu"
    possede: bool = False
    wishlist: bool = False
    note: "int | None" = None
    commentaire: str = ""
    date_ajout: str = ""
    date_lecture: "str | None" = None
    id: "int | None" = None
