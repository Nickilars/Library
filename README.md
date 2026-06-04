# 📚 Gestionnaire de Bibliothèque Personnel

Une application console interactive en Python permettant de gérer l'inventaire de vos livres. Ce projet utilise une interface textuelle moderne (menus à flèches, tableaux colorés, animations) et intègre un scanner de codes-barres par webcam pour identifier automatiquement vos livres via Internet.

---

## 📦 Installation des Dépendances Python

Assurez-vous d'avoir Python 3.10 ou une version supérieure installée. Ouvrez votre terminal à la racine du projet et exécutez la commande suivante pour installer toutes les bibliothèques requises (versions épinglées) :

```bash
pip install -r requirements.txt
```

Aucune installation système n'est requise : le décodage des codes-barres utilise le détecteur natif d'OpenCV (`cv2.barcode`), sans dépendance externe.

### À quoi servent ces packages ?
* **`rich`** : Pour l'affichage des tableaux colorés, des panneaux et des animations de chargement (*spinners*).
* **`InquirerPy`** : Pour la navigation dans les menus à l'aide des flèches du clavier et de la touche Entrée.
* **`opencv-python`** : Pour l'accès à la webcam, la capture vidéo en temps réel et le décodage des codes-barres (ISBN).
* **`requests`** : Pour interroger l'API publique *Open Library* et récupérer le titre, l'auteur et l'année du livre scanné.

---

## 🚀 Lancement de l'Application

Une fois les dépendances installées, lancez simplement le fichier principal :

```bash
python main.py
```

---

## 🌐 Application web (consultation)

En plus de la console, une interface web permet de **consulter** la collection sous forme d'étagère (lecture seule) : livres en tranches debout, groupés par auteur puis saga, qu'on déplie pour faire pivoter un livre de face.

### Lancer le serveur
```bash
python webapp.py
```
Puis ouvrir http://127.0.0.1:8000 dans un navigateur.

### Accès depuis un autre appareil du réseau local
Par défaut le serveur n'écoute que sur la machine locale. Pour y accéder depuis un autre ordinateur de la maison, définissez l'hôte avant de lancer :
```bash
# PowerShell
$env:LIBRARY_HOST = "0.0.0.0"; python webapp.py
```
puis ouvrez `http://<ip-du-serveur>:8000` depuis l'autre appareil.

Variables d'environnement : `LIBRARY_HOST` (défaut `127.0.0.1`), `LIBRARY_PORT` (défaut `8000`), `LIBRARY_DB` (défaut `library.db`).

> ⚠️ L'application web est en **lecture seule** : les ajouts et modifications se font dans la console. L'écriture depuis le web, l'authentification et l'accès depuis internet viendront dans les phases suivantes.

### API JSON (lecture seule)
- `GET /api/books` — livres possédés
- `GET /api/books/{id}` — un livre
- `GET /api/wishlist` — livres à acheter

---

## 💾 Données

Les livres sont stockés dans une base de données SQLite locale (`library.db`), écrite à chaque opération : aucune perte de données en cas de fermeture inattendue.

### Migration depuis l'ancienne version (inventory.json)
Si vous venez d'une version antérieure qui utilisait `inventory.json`, lancez une seule fois :

```bash
python migrate.py
```

Vos données seront copiées dans `library.db`. Le fichier `inventory.json` est conservé intact comme sauvegarde. Le script refuse de s'exécuter une seconde fois si la base contient déjà des livres.

---

## 📖 Fonctionnalités disponibles
1. **Ajouter un livre** : Soit en scannant le code-barres arrière (EAN13) avec votre webcam pour un remplissage automatique (titre, auteur, année, saga et tome via Open Library puis la BnF), soit manuellement au clavier.
2. **Modifier un livre** : Sélection du livre et de l'élément à modifier (titre, auteur, année, saga, tome, statut de lecture, possession, wishlist, note, commentaire) avec les flèches du clavier.
3. **Rechercher un livre** : Filtres par titre, auteur, saga ou statut de lecture.
4. **Supprimer un livre** : Retrait d'un ouvrage de la base de données, avec confirmation.
5. **Afficher l'inventaire** : Affichage d'un tableau enrichi (saga, tome, statut, note) avec options de tri (par titre, auteur ou saga).

### Champs suivis par livre
Chaque livre enregistre : titre, auteur, année, ISBN, saga et **tome** dans la saga, **statut de lecture** (à lire / en cours / lu), possession, **wishlist** (à acheter), **note** personnelle (0–5), **commentaire**, et dates d'ajout et de lecture.
