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
