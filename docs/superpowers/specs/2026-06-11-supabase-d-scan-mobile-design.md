# Sous-projet D — Scan code-barres mobile (caméra)

**Date :** 2026-06-11
**Statut :** Brouillon — à valider
**Auteur :** Nicolas Rossel (avec Claude)

## Contexte

Le frontend statique sur Supabase est complet : lecture privée (B1), PWA hors-ligne (B2),
écriture CRUD (C1) et pré-remplissage par ISBN via la fonction Edge `lookup` (C2). D ajoute
la **dernière brique du plan d'origine** (Phase 5 « scan mobile ») : lire le **code-barres
EAN-13** d'un livre avec la **caméra du téléphone** pour ne plus saisir l'ISBN à la main.

### Rappel de la décomposition (re-plateformage Supabase)

- A — Socle Supabase + migration. ✅
- B1 — Frontend statique privé (lecture). ✅
- B2 — PWA hors-ligne + installable. ✅
- C1 — Écriture web (CRUD manuel). ✅
- C2 — Remplissage par ISBN (OpenLibrary/BnF). ✅
- **D — Scan mobile (caméra).** *(ce document)*

## Objectif de D

Deux flux, livrés en **deux lots** :

- **D1 — Scan unique (modale d'ajout)** : un bouton 📷 à côté du champ ISBN ouvre la
  caméra ; le code-barres détecté remplit `#f-isbn` et **déclenche automatiquement la
  recherche C2**. L'utilisateur vérifie/complète, puis Enregistrer (validation + dédup C1
  inchangées).
- **D2 — Mode rafale (encoder une pile)** : une vue caméra persistante ; chaque
  code-barres scanné fait **lookup + ajout direct** à la collection (avec anti-doublon et
  retour visuel), pour encoder une pile de livres d'un coup.

## Décisions d'architecture (issues du brainstorming)

- **`BarcodeDetector` natif** (pas de librairie vendorée) :
  - zéro dépendance, détection performante et 100 % locale (le flux vidéo ne quitte
    jamais l'appareil) ;
  - supporté sur **Chrome Android**, la cible déclarée du projet (B2 : « Android
    d'abord ») ;
  - **indisponible** sur Chrome Windows desktop et Safari/iOS → le bouton de scan est
    **masqué** si l'API manque ; la saisie manuelle + 🔍 Rechercher (C2) restent le
    repli universel. Une bascule vers ZXing vendoré reste possible plus tard sans
    changer l'UX (l'abstraction `demarrerScan(onIsbn)` l'isole).
  - garde-fou : `'BarcodeDetector' in window` **et** `getSupportedFormats()` contient
    `'ean_13'`.
- **Détection EAN-13 = ISBN** : seuls les codes à 13 chiffres commençant par **978/979**
  sont acceptés ; tout autre code-barres (EAN produit, QR…) est ignoré et le scan
  continue.
- **Caméra arrière** : `getUserMedia({ video: { facingMode: 'environment' } })`.
  HTTPS requis par l'API → couvert par GitHub Pages (et `localhost` en dev).
- **Réutilisation de C2 telle quelle** : le scan ne fait que produire un ISBN ; la
  recherche passe par `window.lookupIsbn` (fonction Edge `lookup`), inchangée.

```
Caméra (getUserMedia) ──frames──► BarcodeDetector (local) ──EAN 978/979──► onIsbn(isbn)
                                                                              │
              D1 : remplit #f-isbn ──► rechercherIsbn() (C2) ◄────────────────┤
              D2 : lookup ──► anti-doublon ──► insert direct ──► toast ◄──────┘
```

## Composants & fichiers

| Fichier | Changement |
|---|---|
| `web/scan-logic.mjs` | **Nouveau.** Logique **pure** (sans DOM/caméra) : `estIsbnScanne(code)` (13 chiffres, préfixe 978/979), `antiRebond(isbn, etat)` (ignorer les redétections du même code), `livreDepuisScan(livreLookup, isbn)` (payload d'insertion D2 avec valeurs par défaut). Testable avec node. |
| `web/scan.js` | **Nouveau.** Caméra + détection : overlay vidéo plein écran avec cadre de visée et bouton ✕, boucle `detector.detect(video)` (~5 fps), arrêt **systématique** des pistes caméra à la fermeture. Expose `demarrerScan(onIsbn, options)`. Classic script (comme `isbn.js`). |
| `web/isbn.js` | D1 : bouton 📷 appelle `demarrerScan` ; à la détection → remplit `#f-isbn`, ferme la caméra, lance `rechercherIsbn()`. |
| `web/app.js` | D2 : expose `window.ajouterLivreScan(livre)` — insert direct réutilisant `validerLivre` + détection de doublon de C1, puis rechargement. |
| `web/index.html` | Bouton 📷 dans `.ligne-isbn` (D1) ; bouton « 📷 Scanner une pile » dans l'en-tête (D2) ; les deux **masqués si `BarcodeDetector` indisponible**. |
| `web/shelf.css` | Styles : overlay caméra, cadre de visée, toasts de résultat (D2). |
| `web/sw.js` | Ajouter `scan.js` + `scan-logic.mjs` à la coquille ; **bump `biblio-v3`**. |
| `web/test_scan_logic.mjs` | **Nouveau.** Tests node de la logique pure. |
| `.github/workflows/tests.yml` | Ajouter `node web/test_scan_logic.mjs`. |

## Flux D1 — scan unique (modale)

1. Modale d'ajout ouverte ; si `BarcodeDetector` + caméra disponibles, le bouton **📷**
   est visible à côté de 🔍 Rechercher.
2. Clic 📷 → overlay caméra (permission navigateur demandée au premier usage).
3. Détection d'un EAN 978/979 → **vibration brève** (`navigator.vibrate`, si dispo),
   fermeture de l'overlay, `#f-isbn` rempli, **recherche C2 lancée automatiquement**.
4. Permission refusée / aucune caméra → message court dans `#isbn-statut`, overlay fermé ;
   la saisie manuelle reste.
5. ✕ ou clic hors zone → fermeture sans rien modifier. Les pistes caméra sont **toujours
   arrêtées** (pas de LED caméra fantôme).

## Flux D2 — mode rafale

1. Bouton « 📷 Scanner une pile » dans l'en-tête (connecté, en ligne uniquement).
2. Vue caméra persistante + zone de toasts. Chaque EAN 978/979 détecté :
   - **anti-rebond** : un même ISBN n'est retraité qu'après détection d'un autre code
     (ou ~3 s d'écart) ;
   - **doublon** (même ISBN ou titre+auteur déjà en collection, y compris ajoutés
     pendant la session de scan) → toast « Déjà dans la collection », pas d'écriture ;
   - **lookup trouvé** → insertion directe avec les valeurs par défaut ci-dessous →
     toast « Ajouté : *Titre* » + vibration ;
   - **lookup introuvable** → toast « Introuvable : *isbn* — ajout manuel », pas
     d'écriture.
3. Valeurs par défaut d'insertion (pile de livres qu'on possède) : `statut_lecture =
   'non_lu'`, `possede = true`, `wishlist = false`, `note/commentaire` vides ;
   titre/auteur/année/saga/tome depuis le lookup.
4. Fermeture de la vue → arrêt caméra + **un seul** rechargement de l'étagère.
5. Hors-ligne → bouton désactivé (lookup et insert exigent le réseau, comme C1/C2).

## Sécurité

- **Flux vidéo 100 % local** : `BarcodeDetector` travaille sur l'appareil ; aucune image
  n'est envoyée au réseau. Seul l'**ISBN extrait** (chiffres validés) circule.
- **Entrée non sûre** : le code scanné est traité comme une saisie utilisateur —
  validation 13 chiffres + préfixe 978/979 **avant** tout appel ; la fonction Edge
  revalide de son côté (C2 inchangé).
- **Écritures D2** : passent par `validerLivre` + dédup + RLS (`user_id` de la session),
  exactement comme C1.
- **SEC-W1 maintenu** : titres affichés dans les toasts via `textContent`, jamais
  `innerHTML`.
- **Permission caméra** : demandée à l'usage, jamais au chargement ; pistes arrêtées dès
  fermeture.

## Tests

- **Automatisé** : `web/test_scan_logic.mjs` (node) couvre la logique pure :
  - `estIsbnScanne` : `9782290424551` OK ; `9772290424556` (977) rejeté ; EAN-8, QR texte,
    vide rejetés ;
  - `antiRebond` : même ISBN consécutif ignoré ; autre ISBN accepté ; même ISBN après
    expiration accepté ;
  - `livreDepuisScan` : payload complet avec défauts (`non_lu`, `possede=true`), champs
    lookup repris, ISBN inclus.
- **Manuel (sur téléphone Android, site déployé)** :
  1. D1 : modale → 📷 → scanner un livre français → ISBN rempli + champs C2 remplis (BnF).
  2. D1 : refuser la permission → message, saisie manuelle possible.
  3. D1 : ✕ → fermeture, LED caméra éteinte.
  4. D2 : scanner une pile de 3 livres → 3 toasts « Ajouté », étagère à jour à la sortie.
  5. D2 : re-scanner un livre déjà ajouté → « Déjà dans la collection ».
  6. D2 : code-barres non-ISBN (boîte de céréales) → ignoré, scan continue.
  7. Desktop Windows : boutons 📷 absents, C2 manuel intact.
  8. Hors-ligne : D2 désactivé ; D1 scan possible mais recherche → « en ligne uniquement ».

## Hors périmètre (D)

- Repli **ZXing vendoré** (desktop/iOS) → non ; bascule possible plus tard derrière
  `demarrerScan`.
- iOS/Safari → non ciblé (inchangé depuis B2).
- Scan **hors-ligne** avec file d'attente de lookups → non (en ligne uniquement).
- Upload/photo d'une image de code-barres → non (caméra live uniquement).
- Lecture des ISBN-10 (vieux livres, code-barres non EAN-13) → non (saisie manuelle).

## Critères de succès

- Sur Android : scanner le code-barres d'un livre remplit la modale (D1) sans saisie ;
  une pile de livres s'encode en série (D2) avec retours clairs.
- Aucun envoi du flux vidéo ; caméra toujours relâchée à la fermeture.
- Sur desktop : l'app reste **identique à aujourd'hui** (boutons masqués, zéro régression).
- Logique pure couverte par les tests node (CI) ; checklist manuelle validée.
- B1/B2/C1/C2 inchangés : RLS, SEC-W1, hors-ligne lecture seule respectés.
