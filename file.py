#! /usr/bin/env python3
# Auteur : Nicolas Rossel
# Date : 2024-06-01
# Fichier pour la gestion des fichiers json pour la bibliothèque

import os
import json
import time
from book import Book
from library import Library

# Importation de la console Rich pour les animations de chargement
from rich.console import Console

console = Console()

def load_library() -> Library:
    library = Library()

    # Création du spinner animé pour le chargement
    with console.status("[bold cyan]Chargement de la bibliothèque en cours...", spinner="dots") as status:
        time.sleep(1.5)  # Laisse l'animation tourner pour le visuel

        try:
            with open('inventory.json', 'r', encoding="utf-8") as fichier_json:
                donnee_brut = json.load(fichier_json)

                for key, book_infos in donnee_brut.items():
                    library.books[key] = Book(**book_infos)

                # Changement du message du spinner juste avant de finir
                status.update("[bold green]Finalisation de l'importation...")
                time.sleep(0.5)
                
            console.print("[bold green]✔[/bold green] Bibliothèque chargée avec succès !")
            time.sleep(1.5)
            os.system('clear')
            return library

        except FileNotFoundError:
            console.print("[bold yellow]⚠️ Fichier 'inventory.json' introuvable. Initialisation d'une bibliothèque vide.[/bold yellow]")
            time.sleep(2)
            os.system('clear')
            return library
        except PermissionError:
            console.print("[bold red]❌ Erreur : permissions insuffisantes pour ouvrir le fichier.[/bold red]")
            time.sleep(2)
            os.system('clear')
            return library
        except Exception as e:
            console.print("[bold magenta]Fichier vide ou corrompu. Création d'une nouvelle base.[/bold magenta]")
            time.sleep(2)
            os.system('clear')
            return library
    
def save_library(library: Library) -> None:
    os.system('clear')
    
    # Création du spinner animé pour la sauvegarde
    with console.status("[bold green]Sauvegarde de la bibliothèque en cours...", spinner="bouncingBar") as status:
        time.sleep(1.5)  # Laisse le visuel s'afficher

        dictionary_export = {
            key: book.__dict__ for key, book in library.books.items()
        }

        with open('inventory.json', 'w', encoding="utf-8") as fichier_json:
            json.dump(dictionary_export, fichier_json, indent=4, ensure_ascii=False)
            
    console.print("[bold green]✔[/bold green] Bibliothèque sauvegardée avec succès !")
    time.sleep(1.5)
    os.system('clear')
