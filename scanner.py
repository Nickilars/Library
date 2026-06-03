import cv2
from pyzbar.pyzbar import decode
import requests
from rich.console import Console

console = Console()

def scanner_code_barre() -> str:
    """Ouvre la webcam, détecte un code-barres et retourne l'ISBN."""
    # 0 est l'index de la webcam par défaut de votre ordinateur
    cap = cv2.VideoCapture(0)
    console.print("[bold cyan]📷 Ouverture de la caméra... Présentez le code-barres du livre.[/bold cyan]")
    console.print("[dim]Appuyez sur 'q' pour annuler.[/dim]")

    isbn = None
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Chercher des codes-barres dans l'image de la caméra
        codes = decode(frame)
        for code in codes:
            # Le type EAN13 est le format standard des livres
            if code.type == 'EAN13':
                isbn = code.data.decode('utf-8')
                break

        # Afficher le flux vidéo à l'écran
        cv2.imshow('Scanner de Bibliotheque', frame)

        # Si un code est trouvé ou si l'utilisateur appuie sur 'q'
        if isbn or cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    return isbn

def recuperer_infos_livre(isbn: str) -> dict:
    """Interroge l'API Open Library avec l'ISBN et retourne les infos structurées."""
    if not isbn:
        return None

    url = f"https://openlibrary.org:{isbn}&format=json&jscmd=data"
    try:
        response = requests.get(url)
        data = response.json()
        
        cle_livre = f"ISBN:{isbn}"
        if cle_livre in data:
            infos = data[cle_livre]
            
            # Extraction propre des données avec des valeurs par défaut
            titre = infos.get("title", "Titre Inconnu")
            
            # Les auteurs sont souvent une liste dans l'API
            auteurs_liste = infos.get("authors", [])
            auteur = auteurs_liste[0].get("name", "Auteur Inconnu") if auteurs_liste else "Auteur Inconnu"
            
            # Récupération de la date de publication
            date_pub = infos.get("publish_date", "Inconnue")
            # Extraction de l'année (4 chiffres) si possible
            annee = "".join(filter(str.isdigit, date_pub))[:4] or "Inconnue"
            
            return {
                "titre": titre,
                "auteur": auteur,
                "annee": annee,
                "saga": "Aucune" # L'API ne gère pas toujours bien les sagas, on l'initialise
            }
    except Exception:
        pass
    
    return None
