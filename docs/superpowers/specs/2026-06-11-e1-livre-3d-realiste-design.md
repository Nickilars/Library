# Sous-projet E1 — Livre 3D réaliste (relié)

**Date :** 2026-06-11
**Statut :** Brouillon — à valider
**Auteur :** Nicolas Rossel (avec Claude)

## Contexte

Le re-plateformage Supabase est complet (A→D : lecture privée, PWA, CRUD, ISBN, scan
caméra). E ouvre le **chantier visuel**. E1 cible le **livre 3D du niveau 2** : la boîte
actuelle (`BoxGeometry` + couverture plaquée) est fonctionnelle mais ne « fait pas vrai ».
Objectif : qu'en ouvrant un livre, on ait l'impression de **tenir un vrai livre relié**.

## Objectif de E1

Remplacer la boîte par un **livre relié (hardcover)** crédible, avec un éclairage
réaliste, une ombre, et une entrée en scène fluide. Trois leviers (issus du
brainstorming) :

1. **Géométrie de relié** — couvertures rigides qui **débordent** du bloc de pages,
   **dos arrondi**, **gorge de reliure** (creux entre dos et plats), bloc de pages **en
   retrait** avec texture papier sur les trois tranches, **coins de plats arrondis**.
2. **Éclairage réaliste + ombre** — environnement d'éclairage (reflets doux sur la
   jaquette), tone mapping ACES, **ombre de contact** douce sous le livre.
3. **Animation d'entrée** — le livre arrive en scène (zoom + redressement amortis) au
   lieu d'apparaître instantanément ; le flottement libre existant est conservé.

## Décisions d'architecture (issues du brainstorming)

- **Type : relié/hardcover** (plus spectaculaire et « objet bibliothèque » que le poche),
  même silhouette pour tous les livres.
- **Aucune dépendance nouvelle** : Three.js r160 (vendoré) suffit —
  `MeshPhysicalMaterial` (vernis de jaquette via `clearcoat`), `PMREMGenerator`,
  `ACESFilmicToneMapping` sont dans le cœur.
- **Environnement d'éclairage généré** (pas de fichier HDR ni de `RoomEnvironment`
  vendoré) : une **texture équirectangulaire dessinée en canvas** (dégradé chaud
  « bibliothèque » + quelques zones lumineuses « fenêtres ») passée à `PMREMGenerator.
  fromEquirectangular` → `scene.environment`. Léger, hors-ligne par construction,
  accordé à la palette de l'app.
- **Ombre de contact « blob »** (plan + dégradé radial canvas), **pas de shadow
  mapping** : robuste et gratuit sur mobile ; le plan d'ombre reste fixe sous le livre.
- **Continuité visuelle étagère → détail** : le **dos et la 4e de couverture** reprennent
  `couleurTranche` (la couleur de la tranche sur l'étagère) — pas de texte imprimé sur le
  dos (non retenu au brainstorming).
- **Couvertures à coins arrondis** : `ExtrudeGeometry` sur un rectangle arrondi, avec
  **remappage des UV** (normalisation par boîte englobante) pour que la jaquette
  OpenLibrary se plaque correctement sur le plat avant.
- **Performance mobile** : géométrie statique construite une fois, un seul contexte WebGL
  réutilisé (inchangé), `pixelRatio` plafonné à 2 (inchangé), PMREM généré une fois.
- **Interaction inchangée** : drag pour tourner, flottement libre, repli 2D sans WebGL,
  API `ouvrir(conteneur, donnees)` / `fermer()` identique (aucun changement dans
  `shelf.js`).

## Anatomie du livre (géométrie)

```
            vue de dessus                          vue de face
        ┌─────────────────────┐ plat avant      ┌───┬─────────────┐
   dos (   ░░░░░░░░░░░░░░░░░  ) ← pages         │   │   jaquette  │ ← débord en
 arrondi└─────────────────────┘ plat arrière    │dos│  (texture   │   tête/pied/
        ↑gorge            pages en retrait →    │   │   OL ou     │   gouttière
                            de la gouttière     │   │   générée)  │
                                                └───┴─────────────┘
```

- `THREE.Group` « livre » : **plat avant** (extrudé, coins arrondis, jaquette),
  **plat arrière** (idem, aplat `couleurTranche` assombri), **dos** (demi-cylindre
  elliptique, `couleurTranche`), **bloc de pages** (boîte en retrait, texture papier
  lignée sur gouttière/tête/pied).
- Proportions : plats ~3 % plus grands que le bloc de pages (débord) ; gorge marquée par
  l'espace géométrique entre dos et plats.
- La rotation du drag et du flottement s'applique au **groupe** entier.

## Éclairage & rendu

- `renderer.toneMapping = ACESFilmicToneMapping`, exposition ~1.1.
- `scene.environment` = PMREM d'une équirect canvas (chaude) → reflets doux et réalistes
  sur la jaquette vernie (`clearcoat` ~0.5, `roughness` ~0.4).
- Lumière directionnelle chaude conservée (modelé) + ambiante réduite (l'environnement
  prend le relais).
- Ombre : disque dégradé radial sous le livre, opacité ~0.45, légèrement elliptique.

## Animation d'entrée

- À `ouvrir()` : échelle 0.55 → 1 et position y −0.6 → 0, amorties (même technique de
  lerp que la rotation existante, ~0.6 s perçue) ; rotation initiale plus marquée qui se
  redresse vers la pose de repos.
- Le flottement libre (`sin`) reprend ensuite, inchangé ; le drag interrompt l'animation
  d'entrée comme il interrompt le flottement.

## Composants & fichiers

| Fichier | Changement |
|---|---|
| `web/book3d.js` | **Réécriture.** Géométrie reliée (groupe), matériaux physiques, environnement PMREM, ombre de contact, animation d'entrée. API `ouvrir`/`fermer`/`webglDisponible` inchangée. |
| `web/sw.js` | Bump `biblio-v4` (rafraîchissement immédiat du module réécrit). |

Aucun autre fichier : `shelf.js`, `app.js`, CSS et HTML inchangés.

## Tests

- **Pas de logique pure nouvelle** (tout est géométrie/rendu) → pas de test node ; les
  suites existantes restent vertes (aucun fichier testé n'est touché).
- **Manuel (desktop + Android)** :
  1. Ouvrir un livre **avec ISBN/couverture** → jaquette plaquée, coins arrondis, dos
     arrondi de la couleur de la tranche, débord visible, pages en retrait.
  2. Ouvrir un livre **sans couverture** → couverture générée (aplat + titre), même
     anatomie.
  3. Entrée en scène fluide (zoom + redressement), puis flottement ; drag réactif.
  4. Ombre douce sous le livre, reflets discrets qui bougent avec la rotation.
  5. Fermer/rouvrir plusieurs livres d'affilée → pas de fuite (un seul contexte WebGL),
     couverture mise à jour à chaque fois.
  6. Mobile : fluide (≥ 30 fps perçus), pas de surchauffe anormale.
  7. Repli 2D (navigateur sans WebGL) → inchangé.

## Hors périmètre (E1)

- Livre qui **s'ouvre** / pages qui tournent → non (inchangé depuis la Phase 2).
- **Dos imprimé** (titre vertical) et **4e de couverture composée** → non retenus ;
  évolution possible (E2 ?).
- Irrégularité fine du bloc de pages (déformation, pages gondolées) → non retenu.
- Shadow mapping réel / éclairage HDR fichier → non (blob + équirect générée suffisent).
- Refonte visuelle de l'**étagère** (niveau 0/1 : texture bois, profondeur) → autre
  sous-projet E si souhaité.

## Critères de succès

- Au premier regard, on reconnaît **un livre relié** (débord, dos rond, gorge, tranches
  papier) et non une boîte texturée.
- L'arrivée du livre est fluide et l'éclairage donne du volume (reflets, ombre).
- Aucune régression : API et navigation inchangées, repli 2D intact, perfs mobiles OK,
  tests CI verts.
