import os
import time
from book import Book
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from InquirerPy import inquirer

console = Console()

class Library:
    def __init__(self) -> None:
        self.books = {}

    def add_book(self, book: Book) -> None:
        if book.titre in self.books and self.books[book.titre].auteur == book.auteur:
            console.print(Panel(f"[yellow]⚠️ {book.titre}[/yellow] de {book.auteur} est déjà dans la bibliothèque.", border_style="yellow"))
        else:
            self.books[book.titre] = book
            console.print(Panel(f"[green]✔ {book.titre}[/green] de {book.auteur} ajouté à la bibliothèque.", border_style="green"))
    
    def search_book(self, search_criteria: Book) -> None:
        table = Table(title="🔍 Résultats de la recherche", style="bold blue", header_style="bold cyan")
        table.add_column("Possédé", justify="center", width=8)
        table.add_column("Lu", justify="center", width=6)
        table.add_column("Titre", style="white bold")
        table.add_column("Saga", style="italic cyan")
        table.add_column("Auteur", style="yellow")
        table.add_column("Année", justify="center", style="green")

        trouve = False
        for b in self.books.values():
            match_titre = search_criteria.titre and search_criteria.titre.lower() in b.titre.lower()
            match_auteur = search_criteria.auteur and search_criteria.auteur.lower() in b.auteur.lower()
            match_posseder = search_criteria.posseder is True and b.posseder is True
            match_saga = search_criteria.saga != "Aucune" and search_criteria.saga and search_criteria.saga.lower() in getattr(b, "saga", "Aucune").lower()
            match_lu = search_criteria.deja_lu is True and b.deja_lu is True

            if match_titre or match_auteur or match_saga or match_posseder or match_lu:
                icon_possede = "[green]☑[/green]" if b.posseder else "[red]☐[/red]"
                icon_lu = "[green]☑[/green]" if b.deja_lu else "[red]☐[/red]"
                table.add_row(icon_possede, icon_lu, b.titre, getattr(b, "saga", "Aucune"), b.auteur, str(b.annee_publication))
                trouve = True

        if trouve:
            console.print(table)
        else:
            console.print("[bold red]❌ Aucun livre ne correspond à votre recherche.[/bold red]")

    def modify_book(self, book: Book = None) -> None:
        '''Modifie un livre en le sélectionnant graphiquement avec les flèches'''
        if not self.books:
            console.print("[bold red]❌ La bibliothèque est vide, rien à modifier.[/bold red]")
            return

        # 1. Menu de sélection du livre avec les flèches
        # On crée une liste de choix lisibles pour l'utilisateur
        choix_livres = [f"{b.titre} (par {b.auteur})" for b in self.books.values()]
        
        os.system('cls' if os.name == 'nt' else 'clear')
        livre_selectionne_texte = inquirer.select(
            message="Sélectionnez le livre à modifier (Flèches + Entrée) :",
            choices=choix_livres,
            pointer="👉"
        ).execute()

        # Retrouver le vrai titre (ce qui est avant la parenthèse) pour cibler le dictionnaire
        titre_cle = livre_selectionne_texte.split(" (par ")[0]
        target_book = self.books[titre_cle]

        # 2. Menu de sélection de la modification avec les flèches
        os.system('cls' if os.name == 'nt' else 'clear')
        console.print(f"[bold cyan]Modification du livre :[/bold cyan] {target_book.titre}\n")
        
        option_choisie = inquirer.select(
            message="Que voulez-vous modifier ?",
            choices=[
                {"name": "Modifier le titre", "value": "a"},
                {"name": "Modifier l'auteur", "value": "b"},
                {"name": "Modifier l'année de publication", "value": "c"},
                {"name": "Modifier le nom de la saga", "value": "d"},
                {"name": "Modifier le statut d'acquisition (Possédé)", "value": "e"},
                {"name": "Modifier le statut de lecture (Lu)", "value": "f"},
            ],
            pointer="👉"
        ).execute()

        # 3. Traitement du choix
        match option_choisie:
            case "a":
                new_titre = input("\nNouveau titre : ").strip()
                if new_titre:
                    target_book.titre = new_titre
                    self.books[new_titre] = self.books.pop(titre_cle)
                    console.print(f"\n[green]✔[/green] Titre modifié en : [bold]{new_titre}[/bold].")
            case "b":
                new_auteur = input("\nNouvel auteur : ").strip()
                target_book.auteur = new_auteur
                console.print(f"\n[green]✔[/green] Auteur modifié en : [bold]{new_auteur}[/bold].")
            case "c":
                new_annee = input("\nNouvelle année de publication : ").strip()
                target_book.annee_publication = new_annee
                console.print(f"\n[green]✔[/green] Année modifiée en : [bold]{new_annee}[/bold].")
            case "d":
                new_saga = input("\nNom de la saga : ").strip()
                target_book.saga = new_saga
                console.print(f"\n[green]✔[/green] Saga modifiée : [bold]{new_saga}[/bold].")
            case "e":
                was_acquired = inquirer.select(
                    message="Le possédez-vous maintenant ?",
                    choices=[{"name": "Oui", "value": True}, {"name": "Non", "value": False}]
                ).execute()
                target_book.posseder = was_acquired
                status_text = "acquis" if was_acquired else "a acheter"
                console.print(f"\n[green]✔[/green] Statut mis à jour : Vous [bold]{status_text}[/bold] ce livre.")
            case "f":
                was_read = inquirer.select(
                    message="L'avez-vous lu ?",
                    choices=[{"name": "Oui", "value": True}, {"name": "Non", "value": False}]
                ).execute()
                target_book.deja_lu = was_read
                status_text = "lu" if was_read else "pas encore lu"
                console.print(f"\n[green]✔[/green] Statut mis à jour : Vous avez [bold]{status_text}[/bold] ce livre.")

        input("\nAppuyez sur Entrée pour continuer...")

    def remove_book(self, book: Book = None) -> None:
        """Supprime un livre en le sélectionnant graphiquement avec les flèches"""
        if not self.books:
            console.print("[bold red]❌ La bibliothèque est vide, aucun livre à supprimer.[/bold red]")
            time.sleep(2)
            return

        # 1. Sélection du livre à supprimer avec les flèches
        choix_livres = [f"{b.titre} (par {b.auteur})" for b in self.books.values()]
        
        os.system('cls' if os.name == 'nt' else 'clear')
        livre_selectionne_texte = inquirer.select(
            message="Sélectionnez le livre à supprimer (Flèches + Entrée) :",
            choices=choix_livres,
            pointer="👉"
        ).execute()

        # Retrouver la clé du dictionnaire (le titre)
        titre_cle = livre_selectionne_texte.split(" (par ")[0]
        deleted_book = self.books[titre_cle]

        # 2. Confirmation de sécurité avant suppression
        confirmation = inquirer.select(
            message=f"Êtes-vous sûr de vouloir supprimer définitivement '{deleted_book.titre}' ?",
            choices=[{"name": "Non, annuler", "value": False}, {"name": "Oui, supprimer", "value": True}]
        ).execute()

        if confirmation:
            self.books.pop(titre_cle)
            console.print(Panel(f"[red]🗑️ {deleted_book.titre}[/red] de {deleted_book.auteur} a été supprimé de l'inventaire.", border_style="red"))
        else:
            console.print("[bold yellow]⚠️ Suppression annulée.[/bold yellow]")
            
        time.sleep(2)


    def display_inventory(self) -> None:
        if not self.books:
            console.print("[yellow]La bibliothèque est vide.[/yellow]")
            return
            
        # Sélection de l'ordre de tri avec les flèches du clavier
        order = inquirer.select(
            message="Choisissez une option de tri :",
            choices=[
                {"name": "🔤 Par ordre alphabétique des titres", "value": "a"},
                {"name": "👤 Par nom d'auteur", "value": "b"},
                {"name": "🎬 Par nom de saga / série", "value": "d"},
                {"name": "📥 Par ordre d'ajout (défaut)", "value": "c"},
            ],
            pointer="👉"
        ).execute()
        
        if order == "a":
            books_list = sorted(self.books.values(), key=lambda x: x.titre.lower())
        elif order == "b":
            books_list = sorted(self.books.values(), key=lambda x: x.auteur.lower())
        elif order == "d":
            books_list = sorted(self.books.values(), key=lambda x: (getattr(x, "saga", "Aucune").lower(), x.titre.lower()))
        else:
            books_list = list(self.books.values())
            
        os.system('cls' if os.name == 'nt' else 'clear')
        tableau = Table(title="📚 Liste des livres en stock", style="bold magenta", header_style="bold cyan")
        
        tableau.add_column("Titre", style="white bold")
        tableau.add_column("Saga / Série", style="italic cyan", width=20)
        tableau.add_column("Auteur", style="yellow")
        tableau.add_column("Année", justify="center", style="green")
        tableau.add_column("Possédé", justify="center", width=8)
        tableau.add_column("Lu", justify="center", width=6)

        for b in books_list:
            icon_possede = "[green]☑[/green]" if getattr(b, "posseder", False) else "[red]☐[/red]"
            icon_lu = "[green]☑[/green]" if getattr(b, "deja_lu", False) else "[red]☐[/red]"
            saga_text = getattr(b, "saga", "Aucune")
            
            if saga_text == "Aucune":
                saga_text = "[dim]Aucune[/dim]"

            tableau.add_row(
                b.titre, 
                saga_text,
                b.auteur, 
                str(b.annee_publication),
                icon_possede,
                icon_lu
            )

        console.print(tableau)

