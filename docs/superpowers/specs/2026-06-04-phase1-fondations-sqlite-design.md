# Phase 1 — Fondations : migration vers SQLite et modèle enrichi

**Date :** 2026-06-04
**Statut :** Design validé, prêt pour planification
**Auteur :** Nicolas Rossel (avec Claude)

## Contexte

Le gestionnaire de bibliothèque est aujourd'hui une application console (Python 3.14)
qui stocke ses données dans `inventory.json` — un dictionnaire indexé par titre. Le
projet doit évoluer vers une application web/PWA accessible depuis le téléphone et
hébergée en ligne (vision long terme en 5 phases).

Ce document couvre **uniquement la Phase 1 : les fondations**. Les phases suivantes
(app web locale, authentification, hébergement + PWA, scan mobile) feront chacune
l'objet de leur propre spec.

### Objectif de la vision globale

Apprendre Python tout en construisant un outil personnel réellement utilisable et
montrable (portfolio). Approche retenue : FastAPI + SQLite + PWA, construite de manière
incrémentale, chaque phase restant utilisable.

### Phases du projet (rappel, hors périmètre de ce spec sauf Phase 1)

1. **Fondations** — JSON → SQLite, modèle enrichi *(ce document)*
2. App web locale — liste avec couvertures, stats, CRUD
3. Authentification — login mono-utilisateur
4. Hébergement + PWA — mise en ligne, installation sur téléphone
5. Scan mobile — codes-barres via la caméra du téléphone

## Problèmes résolus par la Phase 1

1. **Un seul livre par titre** : le dictionnaire JSON est indexé par titre, donc deux
   livres homonymes (auteurs différents) s'écrasent. → Résolu par une clé primaire `id`.
2. **Perte de données en cas de crash** : la sauvegarde n'a lieu qu'à la sortie via le
   menu. → Résolu par SQLite qui écrit à chaque opération.
3. **Modèle de données pauvre** : pas de tome, note, statut « en cours », dates, wishlist.
   → Résolu par le modèle enrichi.
4. **Couplage stockage / logique** : `file.py` mêle persistance et présentation (spinners
   Rich). → Résolu par une couche d'accès aux données isolée (`database.py`).

## Modèle de données

Table `books` :

| Champ | Type SQLite | Contraintes | Note |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Identité indépendante du contenu |
| `titre` | TEXT | NOT NULL | |
| `auteur` | TEXT | NOT NULL | |
| `annee_publication` | TEXT | | Texte (peut valoir « Inconnue ») |
| `isbn` | TEXT | | Pour couverture + détection de doublon |
| `saga` | TEXT | DEFAULT 'Aucune' | Simple texte en Phase 1 |
| `tome` | INTEGER | NULL | Numéro dans la saga (BnF `461$v`) |
| `statut_lecture` | TEXT | DEFAULT 'non_lu' | `non_lu` / `en_cours` / `lu` |
| `possede` | INTEGER | DEFAULT 0 | Booléen (0/1), possédé physiquement |
| `wishlist` | INTEGER | DEFAULT 0 | Booléen (0/1), à acheter |
| `note` | INTEGER | NULL | Note perso 0–5 |
| `commentaire` | TEXT | DEFAULT '' | Avis libre |
| `date_ajout` | TEXT | NOT NULL | Date ISO, rempli automatiquement |
| `date_lecture` | TEXT | NULL | Date ISO de fin de lecture |

### Décisions de modélisation

- **`statut_lecture` (enum 3 valeurs) remplace `deja_lu` (booléen)** : un booléen ne peut
  représenter « en cours de lecture ». Stocké comme texte contraint à
  `non_lu` / `en_cours` / `lu`.
- **Booléens stockés en INTEGER 0/1** : SQLite n'a pas de type booléen natif ;
  c'est la convention standard.
- **Dates stockées en texte ISO 8601** (`YYYY-MM-DD`) : format trié naturellement,
  lisible, sans dépendance.
- **Saga en simple texte** : une vraie table `sagas` avec progression « 3/7 tomes lus »
  est reportée à une phase ultérieure (YAGNI pour la Phase 1).

## Architecture

### Couche d'accès aux données : `database.py`

Nouvelle couche (DAL / repository) qui remplace `file.py`. Elle encapsule **tout** le SQL
et n'expose que des fonctions de haut niveau. Le reste du code (console aujourd'hui, web
demain) ne parle qu'à cette couche, jamais directement au SQL.

Interface publique (signatures indicatives) :

```
init_db(chemin="library.db") -> None        # crée la table si absente
get_all_books() -> list[Book]
get_book(book_id) -> Book | None
add_book(book) -> int                        # retourne l'id créé
update_book(book) -> None
delete_book(book_id) -> None
search_books(criteres) -> list[Book]
trouver_doublon(isbn, titre, auteur) -> Book | None
```

### Conséquences sur le code existant

- **`Book` (book.py)** gagne les nouveaux champs ; `id` (défaut `None` avant insertion),
  `statut_lecture` remplace `deja_lu`, ajout de `isbn`, `tome`, `wishlist`, `note`,
  `commentaire`, `date_ajout`, `date_lecture`.
- **`Library` (library.py)** ne porte plus un `dict` en mémoire : ses méthodes délèguent
  à `database.py`. Les menus existants sont adaptés aux nouveaux champs (statut à 3 états,
  saisie de la note, du tome…).
- **`file.py`** est retiré. Le script de migration lit `inventory.json` directement
  (il n'a pas besoin des spinners Rich de `file.py`).
- **`scanner.py`** : `interroger_bnf` récupère en plus le tome (`461$v`) pour pré-remplir
  le champ `tome`. La logique d'extraction existante est conservée.
- **`main.py`** : appelle `database.init_db()` au démarrage ; le menu de sortie n'a plus
  besoin de sauvegarder (écriture continue).

### Flux de migration

```
inventory.json  ──[migrate.py, lancé une fois]──►  library.db
   (intact,                                          (table books)
    conservé comme sauvegarde)
```

Le script `migrate.py` :
1. lit `inventory.json` ;
2. mappe les anciens champs : `deja_lu: true → statut_lecture: "lu"` (sinon `non_lu`),
   `posseder → possede`, `saga` conservée, `annee_publication` conservée ;
   les nouveaux champs prennent leurs valeurs par défaut ; `date_ajout` = date du jour ;
3. insère chaque livre avec un `id` auto-généré ;
4. ne modifie jamais `inventory.json`.

Le script est **idempotent en sécurité** : il refuse de s'exécuter si `library.db`
contient déjà des livres (évite les doublons en cas de double lancement).

## Détection de doublon

- Si l'ISBN est renseigné des deux côtés : doublon si même ISBN.
- Sinon : doublon si même `titre` **et** même `auteur` (insensible à la casse).
- Comportement en cas de doublon : avertir l'utilisateur (comme aujourd'hui), ne pas
  insérer en double.

## Gestion des erreurs

- **Base inaccessible / corrompue** : message clair, l'application ne crashe pas.
- **Migration** : si `inventory.json` est absent → créer une base vide (cas premier
  lancement). Si corrompu → message explicite, ne rien écrire.
- **Contraintes** : `titre`/`auteur` vides refusés au niveau de la saisie (déjà le cas).
- Le SQL utilise des **requêtes paramétrées** (`?`) systématiquement — jamais de
  concaténation de chaînes — pour la correction et par bonne habitude de sécurité
  (prépare l'entrée web de la Phase 2).

## Tests

`database.py` étant une couche isolée, elle est testée sur une base SQLite **en mémoire**
(`sqlite3.connect(":memory:")`) : chaque test part d'une base vierge, sans toucher aux
données réelles.

Couverture visée :
- CRUD : `add_book` puis `get_book` retourne les bonnes valeurs ; `update_book` modifie ;
  `delete_book` supprime ; `get_all_books` liste tout.
- Deux livres au même titre, auteurs différents : les deux coexistent (régression du bug
  d'origine).
- Détection de doublon : par ISBN, et par (titre + auteur) à casse différente.
- `search_books` : par titre, auteur, saga, statut de lecture.
- **Migration** : un `inventory.json` d'exemple (avec `deja_lu`/`posseder`) produit les
  lignes attendues, statut correctement mappé, refus si la base est déjà peuplée.

## Hors périmètre (Phase 1)

- Toute interface web (Phase 2).
- Table `sagas` dédiée et calcul de progression.
- Récupération/stockage des images de couverture (Phase 2).
- Authentification (Phase 3).

## Critères de succès

- `inventory.json` migré sans perte vers `library.db`, vérifiable.
- La console fonctionne sur SQLite avec tous les nouveaux champs.
- Deux livres homonymes peuvent coexister.
- Les données sont persistées immédiatement à chaque opération.
- La suite de tests de `database.py` et de la migration passe au vert.
