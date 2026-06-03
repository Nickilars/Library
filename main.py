#! /usr/bin/env python3
# Auteur : Nicolas Rossel
# Date : 2024-06-01
# Projet de bibliothèque

import os
import time
import file
import scanner
from book import Book
from library import Library
from rich.panel import Panel
from InquirerPy import inquirer
from rich.console import Console

console = Console()

if __name__ == "__main__":

    library = file.load_library()

    while True:
        os.system('cls' if os.name == 'nt' else 'clear')
        console.print(Panel("✨ [bold cyan]GESTIONNAIRE DE BIBLIOTHÈQUE[/bold cyan] ✨", expand=False, border_style="blue"))
        
        # Sélection du menu principal avec les flèches du clavier
        choice = inquirer.select(
            message="Sélectionnez une action :",
            choices=[
                {"name": "➕ Ajouter un livre", "value": "1"},
                {"name": "📝 Modifier un livre", "value": "2"},
                {"name": "🔍 Rechercher un livre", "value": "3"},
                {"name": "🗑️ Supprimer un livre", "value": "4"},
                {"name": "📚 Afficher l'inventaire", "value": "5"},
                {"name": "❌ Quitter", "value": "6"},
            ],
            pointer="👉"
        ).execute()

        match choice:
            case "1":
                os.system('cls' if os.name == 'nt' else 'clear')
                console.print("[bold green]--- AJOUTER UN LIVRE ---[/bold green]\n")
                
                # Menu pour choisir la méthode d'ajout
                mode_ajout = inquirer.select(
                    message="Comment souhaitez-vous ajouter le livre ?",
                    choices=[
                        {"name": "📷 Scanner le code-barres (Webcam)", "value": "scan"},
                        {"name": "⌨️ Saisie manuelle au clavier", "value": "manuel"}
                    ],
                    pointer="👉"
                ).execute()

                titre, auteur, annee_publication, saga = "", "", "", "Aucune"
                continuer_ajout = True

                if mode_ajout == "scan":
                    isbn = scanner.scanner_code_barre()
                    if isbn:
                        with console.status("[bold yellow]Recherche du livre sur internet...[/bold yellow]"):
                            infos_internet = scanner.recuperer_infos_livre(isbn)
                        
                        if infos_internet:
                            console.print(f"\n[bold green]✔ Livre identifié ![/bold green]")
                            console.print(f"📖 [bold cyan]{infos_internet['titre']}[/bold cyan] par {infos_internet['auteur']} ({infos_internet['annee']})\n")
                            
                            # On récupère les infos trouvées
                            titre = infos_internet['titre']
                            auteur = infos_internet['auteur']
                            annee_publication = infos_internet['annee']
                            saga_trouvee = infos_internet.get('saga', "Aucune")

                            # Si la saga a été trouvée en ligne, on la propose par défaut
                            if saga_trouvee != "Aucune":
                                console.print(f"📚 Saga détectée : [bold cyan]{saga_trouvee}[/bold cyan]")
                                saga = input(f"Nom de la saga (Entrée pour garder '{saga_trouvee}') : ").strip() or saga_trouvee
                            else:
                                saga = input("Nom de la saga (Laissez vide si aucune) : ").strip() or "Aucune"
                        else:
                            console.print("\n[bold red]❌ Impossible de trouver ce livre sur internet.[/bold red]")
                            input("Appuyez sur Entrée pour basculer en saisie manuelle...")
                            mode_ajout = "manuel"
                    else:
                        console.print("\n[bold yellow]⚠️ Scan annulé.[/bold yellow]")
                        continuer_ajout = False
                        time.sleep(1.5)

                # Si l'utilisateur a choisi manuel OU si le scan internet a échoué
                if mode_ajout == "manuel":
                    os.system('cls' if os.name == 'nt' else 'clear')
                    console.print("[bold green]--- SAISIE MANUELLE ---[/bold green]\n")
                    titre = input("Titre du livre : ").strip()
                    auteur = input("Auteur du livre : ").strip()
                    annee_publication = input("Année de publication : ").strip()
                    saga = input("Nom de la saga (Laissez vide si aucune) : ").strip() or "Aucune"

                # Étape finale commune : statuts de possession et de lecture
                if continuer_ajout:
                    posseder = inquirer.select(
                        message=f"Le possédez-vous ({titre}) ?",
                        choices=[{"name": "Oui", "value": True}, {"name": "Non", "value": False}]
                    ).execute()
                    
                    deja_lu = inquirer.select(
                        message=f"L'avez-vous déjà lu ?",
                        choices=[{"name": "Oui", "value": True}, {"name": "Non", "value": False}]
                    ).execute()
                    
                    # Création et ajout final du livre (arguments nommés pour éviter toute inversion)
                    book = Book(titre, auteur, annee_publication, saga=saga, posseder=posseder, deja_lu=deja_lu)
                    library.add_book(book)
                    time.sleep(2.5)
                
                os.system('cls' if os.name == 'nt' else 'clear')
                
            case "2":
                library.modify_book() # Plus besoin de lui passer un objet Book temporaire
                os.system('cls' if os.name == 'nt' else 'clear')
                
            case "3":
                print("Rechercher par titre (a), par saga (b), par auteur (c), par livre possédé (d) ou par livre lu (e) ?")
                order = input("Choisissez une option: ").strip().lower()
                
                match order:
                    case "a":
                        titre = input("Titre du livre à rechercher : ")
                        book = Book(titre, "", "")
                        library.search_book(book)
                    case "b":
                        saga = input("Saga à rechercher : ")
                        book = Book("", "", "", saga=saga)
                        library.search_book(book)
                    case "c":
                        auteur = input("Auteur du livre à rechercher : ")
                        book = Book("", auteur, "")
                        library.search_book(book)
                    case "d":
                        book = Book("", "", "", posseder=True)
                        library.search_book(book)
                    case "e":
                        book = Book("", "", "", deja_lu=True)
                        library.search_book(book)
                    case _:
                        console.print("[bold red]Option invalide, aucune recherche effectuée.[/bold red]")
                        
                time.sleep(4)
                os.system('cls' if os.name == 'nt' else 'clear')
                
            case "4":
                library.remove_book() # Plus besoin de demander le titre au clavier ici
                os.system('cls' if os.name == 'nt' else 'clear')

                
            case "5":
                os.system('cls' if os.name == 'nt' else 'clear')
                library.display_inventory()  # Tout se passe de manière autonome ici
                input("\nAppuyez sur Entrée pour revenir au menu...")
                os.system('cls' if os.name == 'nt' else 'clear')
                
            case "6":
                file.save_library(library)
                os.system('cls' if os.name == 'nt' else 'clear')
                console.print("[bold yellow]Au revoir ![/bold yellow]")
                time.sleep(2)
                os.system('cls' if os.name == 'nt' else 'clear')
                break
                
            case _:
                console.print("[bold red]Option invalide, veuillez réessayer.[/bold red]")
                time.sleep(1.5)
                os.system('cls' if os.name == 'nt' else 'clear')
