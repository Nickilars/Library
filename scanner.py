import cv2
import requests
import xml.etree.ElementTree as ET
from rich.console import Console

console = Console()

def extraire_isbn(codes_decodes) -> str:
    """Retourne le premier code décodé qui ressemble à un ISBN-13 (13 chiffres,
    commençant par 978 ou 979). Ignore les autres codes présents sur le livre,
    comme le petit code prix EAN-5 imprimé à côté du code-barres principal."""
    for code in codes_decodes:
        code = str(code).strip()
        if len(code) == 13 and code.isdigit() and code.startswith(("978", "979")):
            return code
    return None


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

        # Analyse de l'image vidéo : detectAndDecodeWithType renvoie clairement
        # (succès, textes décodés, types de codes, coordonnées)
        success, infos, types, points = detecteur_barre.detectAndDecodeWithType(frame)

        # Si le scan a réussi, on cherche un vrai ISBN parmi les codes décodés
        if success:
            isbn = extraire_isbn(infos)
            if isbn:
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
    """Interroge les sources de données dans l'ordre : Open Library (mondiale),
    puis la BnF (quasi exhaustive pour l'édition française). Retourne les infos
    du premier service qui connaît le livre, ou None."""
    if not isbn:
        return None
    return interroger_open_library(isbn) or interroger_bnf(isbn)


def interroger_open_library(isbn: str) -> dict:
    """Interroge l'API Open Library avec l'ISBN et retourne les infos structurées."""
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


def nettoyer_titre_bnf(titre_brut: str) -> str:
    """Simplifie un titre au format bibliothécaire de la BnF.
    Ex : 'Le vaisseau magique : roman / Robin Hobb ; traduit...' -> 'Le vaisseau magique'"""
    return titre_brut.split(" / ")[0].split(" : ")[0].strip()


def nettoyer_auteur_bnf(auteur_brut: str) -> str:
    """Convertit un auteur au format BnF en format lisible.
    Ex : 'Hobb, Robin (1952-....). Auteur du texte' -> 'Robin Hobb'"""
    nom = auteur_brut.split("(")[0].strip().rstrip(".")
    if "," in nom:
        famille, prenom = nom.split(",", 1)
        return f"{prenom.strip()} {famille.strip()}"
    return nom


def interroger_bnf(isbn: str) -> dict:
    """Interroge le catalogue de la Bibliothèque nationale de France (API SRU,
    XML Dublin Core) et retourne les infos structurées du livre."""
    url = "https://catalogue.bnf.fr/api/SRU"
    params = {
        "version": "1.2",
        "operation": "searchRetrieve",
        "query": f'bib.isbn any "{isbn}"',
        "recordSchema": "dublincore",
    }
    ns = {
        "srw": "http://www.loc.gov/zing/srw/",
        "dc": "http://purl.org/dc/elements/1.1/",
    }
    try:
        response = requests.get(url, params=params, timeout=10)
        racine = ET.fromstring(response.text)

        record = racine.find(".//srw:recordData", ns)
        if record is None:
            return None

        titre_xml = record.find(".//dc:title", ns)
        if titre_xml is None or not titre_xml.text:
            return None

        auteur_xml = record.find(".//dc:creator", ns)
        auteur = nettoyer_auteur_bnf(auteur_xml.text) if (auteur_xml is not None and auteur_xml.text) else "Auteur Inconnu"

        date_xml = record.find(".//dc:date", ns)
        date_pub = date_xml.text if (date_xml is not None and date_xml.text) else ""
        annee = "".join(filter(str.isdigit, date_pub))[:4] or "Inconnue"

        return {
            "titre": nettoyer_titre_bnf(titre_xml.text),
            "auteur": auteur,
            "annee": annee,
            "saga": "Aucune"
        }
    except Exception:
        pass
    return None
