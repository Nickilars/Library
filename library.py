import os
import time
import database
from book import Book
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from InquirerPy import inquirer

console = Console()

# Libellés lisibles des statuts de lecture (source unique pour l'affichage).
STATUT_LABELS = {"non_lu": "À lire", "en_cours": "En cours", "lu": "Lu"}

class Library:
    def __init__(self) -> None:
        # Les données vivent désormais dans SQLite (database.py), plus en mémoire.
        pass

    def add_book(self, book: Book) -> None:
        doublon = database.trouver_doublon(book.isbn, book.titre, book.auteur)
        if doublon is not None:
            console.print(Panel(
                f"[yellow]⚠️ {doublon.titre}[/yellow] de {doublon.auteur} est déjà dans la bibliothèque.",
                border_style="yellow"))
            return
        try:
            database.add_book(book)
            console.print(Panel(
                f"[green]✔ {book.titre}[/green] de {book.auteur} ajouté à la bibliothèque.",
                border_style="green"))
        except ValueError as e:
            console.print(Panel(f"[red]❌ Données invalides : {e}[/red]", border_style="red"))

    def search_book(self, titre="", auteur="", saga="", statut_lecture="") -> None:
        resultats = database.search_books(titre=titre, auteur=auteur,
                                          saga=saga, statut_lecture=statut_lecture)
        table = Table(title="🔍 Résultats de la recherche", style="bold blue",
                      header_style="bold cyan")
        table.add_column("Possédé", justify="center", width=8)
        table.add_column("Statut", justify="center", width=10)
        table.add_column("Titre", style="white bold")
        table.add_column("Saga", style="italic cyan")
        table.add_column("Auteur", style="yellow")
        table.add_column("Année", justify="center", style="green")

        if not resultats:
            console.print("[bold red]❌ Aucun livre ne correspond à votre recherche.[/bold red]")
            return

        for b in resultats:
            icon_possede = "[green]☑[/green]" if b.possede else "[red]☐[/red]"
            statut = STATUT_LABELS.get(b.statut_lecture, b.statut_lecture)
            table.add_row(icon_possede, statut, b.titre, b.saga, b.auteur,
                          str(b.annee_publication))
        console.print(table)

    def modify_book(self) -> None:
        livres = database.get_all_books()
        if not livres:
            console.print("[bold red]❌ La bibliothèque est vide, rien à modifier.[/bold red]")
            return

        choix = {f"{b.titre} (par {b.auteur})": b for b in livres}
        os.system('cls' if os.name == 'nt' else 'clear')
        texte = inquirer.select(message="Sélectionnez le livre à modifier :",
                                choices=list(choix.keys()), pointer="👉").execute()
        target = choix[texte]

        os.system('cls' if os.name == 'nt' else 'clear')
        console.print(f"[bold cyan]Modification de :[/bold cyan] {target.titre}\n")
        option = inquirer.select(
            message="Que voulez-vous modifier ?",
            choices=[
                {"name": "Titre", "value": "titre"},
                {"name": "Auteur", "value": "auteur"},
                {"name": "Année de publication", "value": "annee"},
                {"name": "Saga", "value": "saga"},
                {"name": "Tome (numéro dans la saga)", "value": "tome"},
                {"name": "Statut de lecture", "value": "statut"},
                {"name": "Possédé", "value": "possede"},
                {"name": "Wishlist", "value": "wishlist"},
                {"name": "Note (0-5)", "value": "note"},
                {"name": "Commentaire", "value": "commentaire"},
            ], pointer="👉").execute()

        if option == "titre":
            target.titre = input("\nNouveau titre : ").strip() or target.titre
        elif option == "auteur":
            target.auteur = input("\nNouvel auteur : ").strip() or target.auteur
        elif option == "annee":
            target.annee_publication = input("\nNouvelle année : ").strip()
        elif option == "saga":
            target.saga = input("\nNom de la saga : ").strip() or "Aucune"
        elif option == "tome":
            saisie = input("\nNuméro de tome (vide pour aucun) : ").strip()
            target.tome = int(saisie) if saisie.isdigit() else None
        elif option == "statut":
            target.statut_lecture = inquirer.select(
                message="Statut de lecture :",
                choices=[{"name": "À lire", "value": "non_lu"},
                         {"name": "En cours", "value": "en_cours"},
                         {"name": "Lu", "value": "lu"}]).execute()
        elif option == "possede":
            target.possede = inquirer.select(
                message="Possédé ?",
                choices=[{"name": "Oui", "value": True}, {"name": "Non", "value": False}]).execute()
        elif option == "wishlist":
            target.wishlist = inquirer.select(
                message="Dans la wishlist ?",
                choices=[{"name": "Oui", "value": True}, {"name": "Non", "value": False}]).execute()
        elif option == "note":
            saisie = input("\nNote (0-5, vide pour aucune) : ").strip()
            target.note = int(saisie) if saisie.isdigit() and 0 <= int(saisie) <= 5 else None
        elif option == "commentaire":
            target.commentaire = input("\nCommentaire : ").strip()

        try:
            database.update_book(target)
            console.print("\n[green]✔[/green] Livre mis à jour.")
        except ValueError as e:
            console.print(f"\n[red]❌ Données invalides : {e}[/red]")
        input("\nAppuyez sur Entrée pour continuer...")

    def remove_book(self) -> None:
        livres = database.get_all_books()
        if not livres:
            console.print("[bold red]❌ La bibliothèque est vide, aucun livre à supprimer.[/bold red]")
            time.sleep(2)
            return

        choix = {f"{b.titre} (par {b.auteur})": b for b in livres}
        os.system('cls' if os.name == 'nt' else 'clear')
        texte = inquirer.select(message="Sélectionnez le livre à supprimer :",
                                choices=list(choix.keys()), pointer="👉").execute()
        cible = choix[texte]

        confirmation = inquirer.select(
            message=f"Supprimer définitivement '{cible.titre}' ?",
            choices=[{"name": "Non, annuler", "value": False},
                     {"name": "Oui, supprimer", "value": True}]).execute()

        if confirmation:
            database.delete_book(cible.id)
            console.print(Panel(
                f"[red]🗑️ {cible.titre}[/red] de {cible.auteur} a été supprimé.",
                border_style="red"))
        else:
            console.print("[bold yellow]⚠️ Suppression annulée.[/bold yellow]")
        time.sleep(2)

    def display_inventory(self) -> None:
        livres = database.get_all_books()
        if not livres:
            console.print("[yellow]La bibliothèque est vide.[/yellow]")
            return

        order = inquirer.select(
            message="Choisissez une option de tri :",
            choices=[
                {"name": "🔤 Par titre", "value": "titre"},
                {"name": "👤 Par auteur", "value": "auteur"},
                {"name": "🎬 Par saga", "value": "saga"},
            ], pointer="👉").execute()

        if order == "auteur":
            livres.sort(key=lambda x: x.auteur.lower())
        elif order == "saga":
            livres.sort(key=lambda x: (x.saga.lower(), x.titre.lower()))
        else:
            livres.sort(key=lambda x: x.titre.lower())

        os.system('cls' if os.name == 'nt' else 'clear')
        tableau = Table(title="📚 Liste des livres", style="bold magenta",
                        header_style="bold cyan")
        tableau.add_column("Titre", style="white bold")
        tableau.add_column("Saga / Série", style="italic cyan", width=20)
        tableau.add_column("Tome", justify="center", width=5)
        tableau.add_column("Auteur", style="yellow")
        tableau.add_column("Année", justify="center", style="green")
        tableau.add_column("Possédé", justify="center", width=8)
        tableau.add_column("Statut", justify="center", width=10)
        tableau.add_column("Note", justify="center", width=5)

        for b in livres:
            icon_possede = "[green]☑[/green]" if b.possede else "[red]☐[/red]"
            statut = STATUT_LABELS.get(b.statut_lecture, b.statut_lecture)
            saga = "[dim]Aucune[/dim]" if b.saga == "Aucune" else b.saga
            note = "★" * b.note if b.note else "[dim]-[/dim]"
            tableau.add_row(b.titre, saga, str(b.tome or "-"), b.auteur,
                            str(b.annee_publication), icon_possede, statut, note)
        console.print(tableau)
