import re
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



def extraire_annee(date_brute: str) -> str:
    """Trouve une année plausible (1500-2099) dans une date au format libre.
    Gère les formats variés des API : '1972', '07-01-1972', 'DL 2025', 'June 1997'."""
    match = re.search(r"\b(1[5-9]\d{2}|20\d{2})\b", date_brute or "")
    return match.group(1) if match else "Inconnue"


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

            annee = extraire_annee(infos.get("publish_date", ""))

            return {
                "titre": titre,
                "auteur": auteur,
                "annee": annee,
                "saga": "Aucune"
            }
    except Exception:
        pass
    return None


def parser_notice_unimarc(xml_texte: str) -> dict:
    """Extrait titre, auteur, année et saga d'une notice Unimarc de la BnF.
    Champs utilisés : 200$a (titre), 700$a/$b (auteur), 214$d ou 210$d (date),
    461$t (série mère) avec repli sur 225$a (collection hors éditeur)."""
    try:
        racine = ET.fromstring(xml_texte)
    except ET.ParseError:
        return None

    # On collecte tous les champs (tag, {code: valeur}) sans se soucier des namespaces
    champs = []
    for elem in racine.iter():
        if elem.tag.split("}")[-1] == "datafield":
            sous_champs = [(sf.get("code"), (sf.text or "").strip()) for sf in elem]
            champs.append((elem.get("tag"), sous_champs))

    def premier(tag_voulu: str, code_voulu: str) -> str:
        """Retourne la première valeur trouvée pour un champ/sous-champ donné."""
        for tag, sous_champs in champs:
            if tag == tag_voulu:
                for code, valeur in sous_champs:
                    if code == code_voulu and valeur:
                        return valeur
        return ""

    # Titre (obligatoire : sans lui, la notice est inexploitable)
    titre = premier("200", "a")
    if not titre:
        return None

    # Auteur : l'Unimarc sépare déjà nom ($a) et prénom ($b)
    nom, prenom = premier("700", "a"), premier("700", "b")
    auteur = f"{prenom} {nom}".strip() or "Auteur Inconnu"

    # Année : champ 214 (récent) ou 210 (anciennes notices), ex : "DL 2025"
    annee = extraire_annee(premier("214", "d") or premier("210", "d"))

    # Saga : le champ 461 (série mère) est le plus fiable.
    # À défaut, on prend un champ 225 (collection) qui n'est pas
    # la collection commerciale de l'éditeur (ex : "J'ai lu ; 6736").
    editeur = premier("214", "c") or premier("210", "c")
    saga = premier("461", "t")
    if not saga:
        for tag, sous_champs in champs:
            if tag == "225":
                for code, valeur in sous_champs:
                    if code == "a" and valeur and valeur.lower() != editeur.lower():
                        saga = valeur
                        break
            if saga:
                break

    # Tome : numéro de volume dans la série, champ 461$v (ex : "1").
    tome_brut = premier("461", "v")
    tome = int(tome_brut) if tome_brut.isdigit() else None

    return {
        "titre": titre,
        "auteur": auteur,
        "annee": annee,
        "saga": saga or "Aucune",
        "tome": tome
    }


def interroger_bnf(isbn: str) -> dict:
    """Interroge le catalogue de la Bibliothèque nationale de France (API SRU,
    notices Unimarc complètes) et retourne les infos structurées du livre,
    y compris la saga / série quand elle est cataloguée."""
    url = "https://catalogue.bnf.fr/api/SRU"
    params = {
        "version": "1.2",
        "operation": "searchRetrieve",
        "query": f'bib.isbn any "{isbn}"',
        "recordSchema": "unimarcxchange",
    }
    try:
        response = requests.get(url, params=params, timeout=10)
        return parser_notice_unimarc(response.text)
    except Exception:
        pass
    return None
