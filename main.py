#! /usr/bin/env python3
# Auteur : Nicolas Rossel
# Date : 2024-06-01
# Projet de bibliothèque

import os
import time
import database
import scanner
from book import Book
from library import Library
from rich.panel import Panel
from InquirerPy import inquirer
from rich.console import Console

console = Console()

if __name__ == "__main__":

    database.init_db()
    library = Library()

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
                    statut = inquirer.select(
                        message=f"Statut de lecture pour « {titre} » ?",
                        choices=[{"name": "À lire", "value": "non_lu"},
                                 {"name": "En cours", "value": "en_cours"},
                                 {"name": "Lu", "value": "lu"}]).execute()
                    possede = inquirer.select(
                        message="Le possédez-vous ?",
                        choices=[{"name": "Oui", "value": True},
                                 {"name": "Non", "value": False}]).execute()

                    book = Book(titre, auteur, annee_publication, saga=saga,
                                statut_lecture=statut, possede=possede)
                    library.add_book(book)
                    time.sleep(2.5)
                
                os.system('cls' if os.name == 'nt' else 'clear')
                
            case "2":
                library.modify_book() # Plus besoin de lui passer un objet Book temporaire
                os.system('cls' if os.name == 'nt' else 'clear')
                
            case "3":
                os.system('cls' if os.name == 'nt' else 'clear')
                critere = inquirer.select(
                    message="Rechercher par :",
                    choices=[{"name": "Titre", "value": "titre"},
                             {"name": "Auteur", "value": "auteur"},
                             {"name": "Saga", "value": "saga"},
                             {"name": "Statut de lecture", "value": "statut"}],
                    pointer="👉").execute()

                if critere == "titre":
                    library.search_book(titre=input("Titre : ").strip())
                elif critere == "auteur":
                    library.search_book(auteur=input("Auteur : ").strip())
                elif critere == "saga":
                    library.search_book(saga=input("Saga : ").strip())
                elif critere == "statut":
                    statut = inquirer.select(
                        message="Quel statut ?",
                        choices=[{"name": "À lire", "value": "non_lu"},
                                 {"name": "En cours", "value": "en_cours"},
                                 {"name": "Lu", "value": "lu"}]).execute()
                    library.search_book(statut_lecture=statut)

                input("\nAppuyez sur Entrée pour revenir au menu...")
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
                os.system('cls' if os.name == 'nt' else 'clear')
                console.print("[bold yellow]Au revoir ![/bold yellow]")
                time.sleep(1.5)
                os.system('cls' if os.name == 'nt' else 'clear')
                break
                
            case _:
                console.print("[bold red]Option invalide, veuillez réessayer.[/bold red]")
                time.sleep(1.5)
                os.system('cls' if os.name == 'nt' else 'clear')
