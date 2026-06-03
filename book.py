class Book:
    def __init__(self, titre, auteur, annee_publication, *, saga="Aucune", posseder=False, deja_lu=False):
        self.titre = titre
        self.auteur = auteur
        self.saga = saga
        self.annee_publication = annee_publication
        self.posseder = posseder
        self.deja_lu = deja_lu