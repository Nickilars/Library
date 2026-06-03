# 📚 Gestionnaire de Bibliothèque Personnel

Une application console interactive en Python permettant de gérer l'inventaire de vos livres. Ce projet utilise une interface textuelle moderne (menus à flèches, tableaux colorés, animations) et intègre un scanner de codes-barres par webcam pour identifier automatiquement vos livres via Internet.

---

## 📦 Installation des Dépendances Python

Assurez-vous d'avoir Python 3.10 ou une version supérieure installée. Ouvrez votre terminal à la racine du projet et exécutez la commande suivante pour installer toutes les bibliothèques requises :

```bash
pip install rich InquirerPy opencv-python requests
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

## 📖 Fonctionnalités disponibles
1. **Ajouter un livre** : Soit en scannant le code-barres arrière (EAN13) avec votre webcam pour un remplissage automatique, soit manuellement au clavier.
2. **Modifier un livre** : Sélection du livre et de l'élément à modifier (titre, saga, auteur, année, possession, lecture) avec les flèches du clavier.
3. **Rechercher un livre** : Filtres avancés par mots-clés ou par statuts de lecture.
4. **Supprimer un livre** : Retrait d'un ouvrage de la base de données.
5. **Afficher l'inventaire** : Affichage d'un magnifique tableau avec options de tri dynamique (par titre, auteur, saga, ou ordre d'ajout).
6. **Sauvegarde automatique** : Les données sont persistées de manière sécurisée dans un fichier `inventory.json`.
