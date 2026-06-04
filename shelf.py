#! /usr/bin/env python3
# Présentation pure de l'étagère : aucune dépendance web, facilement testable.
import hashlib


def _hsl_vers_hex(h: float, s: float, l: float) -> str:
    """Convertit une couleur HSL (h in [0,360), s/l in [0,1]) en '#rrggbb'."""
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = l - c / 2
    if h < 60:
        r, g, b = c, x, 0
    elif h < 120:
        r, g, b = x, c, 0
    elif h < 180:
        r, g, b = 0, c, x
    elif h < 240:
        r, g, b = 0, x, c
    elif h < 300:
        r, g, b = x, 0, c
    else:
        r, g, b = c, 0, x
    R, G, B = int((r + m) * 255), int((g + m) * 255), int((b + m) * 255)
    return f"#{R:02x}{G:02x}{B:02x}"


def couleur_tranche(titre: str, auteur: str) -> str:
    """Couleur stable et lisible d'une tranche, dérivée d'un hash du titre + auteur.
    Utilise hashlib (pas hash() qui est salé par processus) pour rester identique
    d'une exécution à l'autre. Teinte variable, saturation/luminosité fixes (tranche
    sombre, texte clair lisible)."""
    graine = f"{titre}|{auteur}".encode("utf-8")
    h = int(hashlib.md5(graine).hexdigest(), 16)
    teinte = h % 360
    return _hsl_vers_hex(teinte, 0.45, 0.38)


def grouper_livres(livres: list) -> list:
    """Groupe les livres par auteur puis par saga, dans un ordre stable.
    Tri : auteur, puis sagas nommées avant 'Aucune', puis tome (numérotés croissants,
    sans tome ensuite), puis titre. Retourne une liste de dicts :
    [{'auteur': str, 'sagas': [{'nom': str, 'livres': [Book, ...]}, ...]}, ...]"""
    livres_tries = sorted(livres, key=lambda b: (
        b.auteur.casefold(),
        (b.saga == "Aucune", b.saga.casefold()),   # sagas nommées d'abord, 'Aucune' en dernier
        (b.tome is None, b.tome or 0),              # tomes numérotés croissants, None ensuite
        b.titre.casefold(),
    ))
    groupes = []
    for b in livres_tries:
        if not groupes or groupes[-1]["auteur"] != b.auteur:
            groupes.append({"auteur": b.auteur, "sagas": []})
        sagas = groupes[-1]["sagas"]
        if not sagas or sagas[-1]["nom"] != b.saga:
            sagas.append({"nom": b.saga, "livres": []})
        sagas[-1]["livres"].append(b)
    return groupes
