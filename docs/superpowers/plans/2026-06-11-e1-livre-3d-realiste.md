# E1 — Livre 3D réaliste (relié) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la boîte texturée du niveau 2 par un livre relié crédible : plats à coins arrondis qui débordent, dos arrondi, gorge, bloc de pages en retrait, éclairage ACES + environnement PMREM généré, ombre de contact, animation d'entrée amortie.

**Architecture:** Réécriture de `web/book3d.js` uniquement (API `ouvrir`/`fermer`/`webglDisponible` inchangée). Le livre devient un `THREE.Group` (plats extrudés, dos demi-cylindre elliptique, bloc de pages). L'environnement d'éclairage est une équirect **dessinée en canvas** passée à `PMREMGenerator` (aucune dépendance nouvelle, hors-ligne par construction). Ombre = plan + dégradé radial canvas.

**Tech Stack:** Three.js r160 vendoré (`MeshPhysicalMaterial`, `ExtrudeGeometry`, `PMREMGenerator`, `ACESFilmicToneMapping`).

> Travail **visuel** : pas de logique pure nouvelle → pas de test node. Chaque task se vérifie
> dans le navigateur (`python -m http.server 8000 --directory web`). Une passe de réglages
> esthétiques avec l'utilisateur est attendue en fin de parcours.

---

## Dimensions de référence (unités scène)

| Élément | Valeur |
|---|---|
| Bloc de pages | 1.68 × 2.40 × 0.42 (x : −0.85 → 0.83) |
| Plats (épaisseur 0.07) | x : −0.80 → 0.90 (gorge 0.05, débord gouttière 0.07) ; y : ±1.26 (débord 0.06) ; coins r 0.07 côté gouttière |
| Plats (z) | centres ±0.245 (faces externes ±0.28) |
| Dos | demi-cylindre r 0.28 aplati ×0.46 (bombé ~0.13), hauteur 2.52, centré x = −0.85 |
| Ombre | plan 2.6 × 1.2 à y = −1.7 |

---

### Task 1 : Fondations rendu — ACES + environnement PMREM + ombre

**Files:** Modify: `web/book3d.js`

- [ ] **Step 1:** Dans `init()` : `renderer.toneMapping = THREE.ACESFilmicToneMapping`,
  `toneMappingExposure = 1.1`.
- [ ] **Step 2:** `texEnvironnement()` : canvas équirect 1024×512 — dégradé vertical chaud
  (haut `#6b5a45` → milieu `#3a2c1e` → bas `#14100b`) + 2–3 « fenêtres » (dégradés radiaux
  blanc chaud, moitié haute). `CanvasTexture` avec `mapping = EquirectangularReflectionMapping`,
  `colorSpace = SRGBColorSpace` → `new PMREMGenerator(renderer).fromEquirectangular(tex).texture`
  → `scene.environment` (généré une fois, generator `dispose()`).
- [ ] **Step 3:** `ombreContact()` : canvas 256×128, dégradé radial `rgba(0,0,0,.5)` → transparent,
  sur `PlaneGeometry(2.6, 1.2)` + `MeshBasicMaterial({ map, transparent: true, depthWrite: false })`,
  `rotation.x = -π/2`, `position.y = -1.7`, ajouté à la **scène** (pas au groupe : l'ombre ne
  tourne pas avec le livre).
- [ ] **Step 4:** Rééquilibrer les lumières : ambiante ↓ (~0.25), directionnelle chaude conservée
  (l'environnement prend le relais du remplissage).
- [ ] **Step 5:** Vérif navigateur : la boîte actuelle (géométrie pas encore changée) a des reflets
  doux + une ombre. Commit :

```bash
git add web/book3d.js
git commit -m "feat: E1 rendu — tone mapping ACES, environnement PMREM (équirect canvas), ombre de contact"
```

---

### Task 2 : Géométrie reliée — plats, dos, bloc de pages

**Files:** Modify: `web/book3d.js`

- [ ] **Step 1:** `formePlat(x0, x1, y0, y1, r)` : `THREE.Shape` rectangle à coins arrondis
  **côté gouttière uniquement** (côté dos droit). `ExtrudeGeometry({ depth: 0.07, bevelEnabled: false })`,
  recentrée en z.
- [ ] **Step 2:** `normaliserUV(geom)` : remappe les UV des caps depuis la boîte englobante
  (x,y → [0,1]²) pour que la jaquette se plaque proprement sur le plat avant.
  (Les flancs utilisent le matériau 1, sans map → UV indifférents.)
- [ ] **Step 3:** Dos : `CylinderGeometry(0.28, 0.28, 2.52, 24, 1, false, Math.PI, Math.PI)`
  (demi-cylindre bombé vers −x, caps inclus), `scale.x = 0.46`, position x = −0.85.
- [ ] **Step 4:** Bloc de pages : `BoxGeometry(1.68, 2.4, 0.42)` centré x = −0.01 ;
  **deux** textures papier (lignes empilées dans le bon axe) : `texPagesV` (lignes verticales)
  pour la gouttière (+x), `texPagesH` (lignes horizontales) pour tête/pied (±y) ;
  crème uni pour ±z et −x.
- [ ] **Step 5:** Assembler dans `livre = new THREE.Group()` (drag + flottement s'appliquent au
  groupe, code d'animation inchangé). Vérif navigateur : silhouette de relié reconnaissable
  (débord, dos rond, gorge, pages en retrait). Commit :

```bash
git add web/book3d.js
git commit -m "feat: E1 géométrie reliée — plats arrondis débordants, dos demi-cylindre, gorge, pages en retrait"
```

---

### Task 3 : Matériaux physiques + couverture par livre

**Files:** Modify: `web/book3d.js`

- [ ] **Step 1:** Jaquette : `MeshPhysicalMaterial({ roughness: 0.42, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.35 })` — la map est posée par `appliquerCouverture` (logique OL/générée **inchangée**).
- [ ] **Step 2:** Plat arrière + flancs des plats + dos : couleur `couleurTranche` du livre
  (passée via `donnees.couleur`), légèrement assombrie (`offsetHSL(0, 0, -0.05)`) —
  **continuité visuelle avec l'étagère**. Mise à jour à chaque `ouvrir()`.
- [ ] **Step 3:** Pages : `MeshStandardMaterial({ map: texPages*, roughness: 1 })`.
- [ ] **Step 4:** Vérif navigateur : livre avec ISBN → jaquette + dos de la couleur de la
  tranche ; livre sans ISBN → couverture générée. Commit :

```bash
git add web/book3d.js
git commit -m "feat: E1 matériaux — jaquette vernie (clearcoat), dos/4e en couleurTranche, papier des tranches"
```

---

### Task 4 : Animation d'entrée + SW

**Files:** Modify: `web/book3d.js`, `web/sw.js`

- [ ] **Step 1:** Dans `ouvrir()` : pose de départ `scale 0.55`, `position.y = −0.6`,
  `rotation (0.45, −1.4, 0)` ; cibles `1 / 0 / (0.18, −0.5)`. Dans `animer()` : lerp amorti
  (facteur 0.08, comme la rotation existante) sur échelle + position. Le drag interrompt
  l'entrée comme il interrompt le flottement (mêmes cibles).
- [ ] **Step 2:** `web/sw.js` : bump `biblio-v4`.
- [ ] **Step 3:** Vérif navigateur : entrée fluide (~0.6 s), flottement repris ensuite,
  drag réactif, fermer/rouvrir × 5 sans fuite. Commit :

```bash
git add web/book3d.js web/sw.js
git commit -m "feat: E1 animation d'entrée amortie + bump SW biblio-v4"
```

---

### Task 5 : Checklist manuelle + réglages + PR

- [ ] Desktop : checklist de la spec (items 1–5, 7).
- [ ] Android : item 6 (fluidité) + rendu général.
- [ ] **Passe de réglages esthétiques avec l'utilisateur** (proportions, intensité des
  reflets/ombre, vitesse d'entrée) — itérer sur les constantes en tête de fichier.
- [ ] PR `e1-livre-3d` → `main` (CI verte), merge après validation visuelle.
