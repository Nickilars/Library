import cv2
import requests
from rich.console import Console

console = Console()

def scanner_code_barre() -> str:
    """Ouvre la webcam et détecte un code-barres en utilisant UNIQUEMENT OpenCV.
    Solution moderne compatible avec Python 3.14 (sans aucune DLL externe)."""
    
    # 1. Initialisation de la caméra Windows
    cap = cv2.VideoCapture(0)
    
    # 2. Initialisation du détecteur de code-barres natif d'OpenCV
    detecteur_barre = cv2.barcode.BarcodeDetector()
    
    console.print("\n[bold cyan]📷 Ouverture de la caméra Windows... Présentez le code-barres du livre.[/bold cyan]")
    console.print("[dim]Appuyez sur 'q' pour annuler.[/dim]\n")

    isbn = None
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Analyse de l'image vidéo pour chercher un code-barres
        # On stocke tout dans une seule variable pour éviter l'erreur de déballage (unpack)
        resultat = detecteur_barre.detectAndDecode(frame)
        
        # On extrait les deux premiers éléments : le succès (True/False) et les infos décodées
        success = resultat[0]
        decoded_info = resultat[1]
        
        # Si le scan a réussi
        if success:
            # OpenCV renvoie parfois les codes sous forme de liste/tuple, on extrait le premier élément
            if isinstance(decoded_info, (tuple, list)) and len(decoded_info) > 0:
                code_potentiel = str(decoded_info[0]).strip()
            else:
                code_potentiel = str(decoded_info).strip()

            # On vérifie si la chaîne de caractères contient un code-barres valide
            if code_potentiel and code_potentiel != "":
                isbn = code_potentiel
                break

        # Affichage du flux vidéo dans une petite fenêtre Windows
        cv2.imshow('Scanner de Bibliotheque - Alignez le code', frame)

        # Quitter si l'utilisateur appuie sur la touche 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # Fermeture propre de la caméra et de la fenêtre visuelle
    cap.release()
    cv2.destroyAllWindows()
    return isbn



def recuperer_infos_livre(isbn: str) -> dict:
    """Interroge l'API Open Library avec l'ISBN et retourne les infos structurées."""
    if not isbn:
        return None

    url = f"https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data"
    try:
        response = requests.get(url, timeout=5)
        data = response.json()
        
        cle_livre = f"ISBN:{isbn}"
        if cle_livre in data:
            infos = data[cle_livre]
            
            titre = infos.get("title", "Titre Inconnu")
            
            auteurs_liste = infos.get("authors", [])
            auteur = auteurs_liste[0].get("name", "Auteur Inconnu") if auteurs_liste else "Auteur Inconnu"
            
            date_pub = infos.get("publish_date", "Inconnue")
            annee = "".join(filter(str.isdigit, date_pub))[:4] or "Inconnue"
            
            return {
                "titre": titre,
                "auteur": auteur,
                "annee": annee,
                "saga": "Aucune"
            }
    except Exception:
        pass
    return None
