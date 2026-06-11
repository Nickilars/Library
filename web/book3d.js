// Visionneuse de livre 3D fermé (Three.js vendoré). Lecture seule.
// Visionneuse persistante (un seul contexte WebGL) réutilisée entre ouvertures.
import * as THREE from './vendor/three.module.js';

// ---- Anatomie du relié (unités scène) — voir le plan E1 pour le schéma ----
const PAGES_L = 1.68, PAGES_H = 2.40, PAGES_E = 0.42;   // bloc de pages
const PLAT_E = 0.07;                                     // épaisseur d'un plat
const PLAT_X0 = -0.86, PLAT_X1 = 0.90;                   // plats glissés sous le dos (pas de fente), débord gouttière 0.07
const PLAT_H = 2.52, PLAT_R = 0.07;                      // débord tête/pied, coins arrondis
const DOS_X = -0.85, DOS_R = 0.28, DOS_BOMBE = 0.46;     // demi-cylindre aplati
const JEU = 0.005;                                       // évite plats/pages coplanaires

let renderer, scene, camera, livre, matCouv, matRel, rafId = null, actif = false;
let cibleY = -0.5, cibleX = 0.18, drag = false, lastX = 0, lastY = 0, libre = true, t0 = 0;

export function webglDisponible() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
}

// Environnement d'éclairage : équirect « bibliothèque » dessinée en canvas (hors-ligne
// par construction). Dégradé chaud + « fenêtres » lumineuses → reflets doux via PMREM.
function texEnvironnement() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#a08a6a'); g.addColorStop(0.55, '#5a4632'); g.addColorStop(1, '#241c12');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  for (const [cx, cy, r] of [[256, 150, 110], [768, 130, 90], [512, 90, 60]]) {
    const f = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    f.addColorStop(0, 'rgba(255,238,210,0.95)'); f.addColorStop(1, 'rgba(255,238,210,0)');
    x.fillStyle = f; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Ombre de contact « blob » : dégradé radial sur un plan fixe sous le livre.
function ombreContact() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const x = cv.getContext('2d');
  const g = x.createRadialGradient(128, 128, 10, 128, 128, 125);
  g.addColorStop(0, 'rgba(0,0,0,0.50)'); g.addColorStop(0.6, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.3),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2; m.position.y = -1.7;
  return m;
}

// Tranches de pages : fines lignes empilées dans l'axe d'empilement réel des pages
// (verticales pour la gouttière où u suit z, horizontales pour tête/pied où v suit z).
function texPages(verticales) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const x = cv.getContext('2d');
  x.fillStyle = '#efe6d0'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#d8ccae'; x.lineWidth = 1;
  for (let p = 1; p < 256; p += 3) {
    x.beginPath();
    if (verticales) { x.moveTo(p, 0); x.lineTo(p, 256); }
    else { x.moveTo(0, p); x.lineTo(256, p); }
    x.stroke();
  }
  return new THREE.CanvasTexture(cv);
}

// Plat de couverture (vue de face) : coins arrondis côté gouttière, droits côté dos.
function formePlat() {
  const s = new THREE.Shape();
  const y = PLAT_H / 2, r = PLAT_R;
  s.moveTo(PLAT_X0, -y);
  s.lineTo(PLAT_X1 - r, -y);
  s.quadraticCurveTo(PLAT_X1, -y, PLAT_X1, -y + r);
  s.lineTo(PLAT_X1, y - r);
  s.quadraticCurveTo(PLAT_X1, y, PLAT_X1 - r, y);
  s.lineTo(PLAT_X0, y);
  s.closePath();
  return s;
}

// Remappe les UV des faces du plat sur [0,1]² (boîte englobante) pour plaquer la jaquette.
// Les flancs utilisent le matériau « reliure » sans map → leurs UV sont indifférents.
function normaliserUV(geom) {
  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  const uv = geom.attributes.uv, pos = geom.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i,
      (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x),
      (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
  }
  uv.needsUpdate = true;
}

// Assemble le livre relié : plats extrudés, dos demi-cylindre, bloc de pages en retrait.
function construireLivre() {
  const g = new THREE.Group();

  matCouv = new THREE.MeshPhysicalMaterial({
    color: 0x888888, roughness: 0.42, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.35,
  });
  // Reliure (dos + plat arrière + flancs) : recolorée par appliquerReliure (couleurTranche).
  matRel = new THREE.MeshPhysicalMaterial({ color: 0x3a2233, roughness: 0.55, metalness: 0 });

  const geoPlat = new THREE.ExtrudeGeometry(formePlat(), { depth: PLAT_E, bevelEnabled: false });
  geoPlat.translate(0, 0, -PLAT_E / 2);

  // Plats entièrement en reliure (l'intérieur ne doit PAS montrer la jaquette) ;
  // la jaquette est une face dédiée plaquée sur l'extérieur du plat avant uniquement.
  const platAvant = new THREE.Mesh(geoPlat, matRel);
  platAvant.position.z = PAGES_E / 2 + PLAT_E / 2 + JEU;
  const platArriere = new THREE.Mesh(geoPlat, matRel);
  platArriere.position.z = -(PAGES_E / 2 + PLAT_E / 2 + JEU);

  const geoJaquette = new THREE.ShapeGeometry(formePlat());
  normaliserUV(geoJaquette);
  const jaquette = new THREE.Mesh(geoJaquette, matCouv);
  jaquette.position.z = platAvant.position.z + PLAT_E / 2 + 0.002;

  const dos = new THREE.Mesh(
    new THREE.CylinderGeometry(DOS_R, DOS_R, PLAT_H, 24, 1, false, Math.PI, Math.PI),
    matRel
  );
  dos.scale.x = DOS_BOMBE;
  dos.position.x = DOS_X;

  const creme = new THREE.MeshStandardMaterial({ color: 0xefe6d0, roughness: 1 });
  const matGouttiere = new THREE.MeshStandardMaterial({ map: texPages(true), roughness: 1 });
  const matTete = new THREE.MeshStandardMaterial({ map: texPages(false), roughness: 1 });
  const pages = new THREE.Mesh(
    new THREE.BoxGeometry(PAGES_L, PAGES_H, PAGES_E),
    [matGouttiere, creme, matTete, matTete, creme, creme]   // +x −x +y −y +z −z
  );
  pages.position.x = DOS_X + PAGES_L / 2;                   // collé au dos, en retrait de la gouttière

  g.add(platAvant, jaquette, platArriere, dos, pages);
  return g;
}

// Continuité visuelle étagère → détail : la reliure reprend la couleur de la tranche.
function appliquerReliure(couleur) {
  const c = new THREE.Color(couleur || '#3a2233');
  c.offsetHSL(0, 0, -0.05);
  matRel.color.copy(c);
}

// Couverture générée (repli) : aplat de couleur + titre
function couvGeneree(titre, couleur) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 720;
  const x = cv.getContext('2d');
  x.fillStyle = couleur || '#444'; x.fillRect(0, 0, 512, 720);
  x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 560, 512, 160);
  x.fillStyle = '#fff'; x.font = 'bold 40px Georgia, serif';
  const mots = (titre || '').split(' '); let ligne = '', y = 610;
  for (const m of mots) {
    if ((ligne + ' ' + m).trim().length > 16) { x.fillText(ligne.trim(), 36, y); ligne = m; y += 46; }
    else ligne += ' ' + m;
  }
  if (ligne.trim()) x.fillText(ligne.trim(), 36, y);
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; return t;
}

function init(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.55;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2); camera.lookAt(0, 0, 0);

  // Environnement PMREM (généré une fois) : remplissage réaliste + reflets sur la jaquette.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(texEnvironnement()).texture;
  pmrem.dispose();
  scene.add(ombreContact());

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xfff2e0, 1.6); key.position.set(2, 4, 6); scene.add(key);
  const fill = new THREE.DirectionalLight(0x99bbff, 0.35); fill.position.set(-4, 1, 2); scene.add(fill);

  livre = construireLivre();
  scene.add(livre);

  canvas.addEventListener('pointerdown', e => { drag = true; libre = false; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('pointerup', () => { drag = false; });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    cibleY += (e.clientX - lastX) * 0.01;
    cibleX += (e.clientY - lastY) * 0.01;
    cibleX = Math.max(-1.0, Math.min(1.0, cibleX));
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('resize', redimensionner);
}

function redimensionner() {
  if (!renderer) return;
  const cv = renderer.domElement;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (w && h && (cv.width !== w || cv.height !== h)) {
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
}

function animer(now) {
  if (!actif) return;
  const t = (now - t0) / 1000;
  if (libre) cibleY = -0.5 + Math.sin(t * 0.5) * 0.35;
  livre.rotation.y += (cibleY - livre.rotation.y) * 0.08;
  livre.rotation.x += (cibleX - livre.rotation.x) * 0.08;
  // Entrée en scène : échelle et hauteur convergent vers la pose de repos (même amorti).
  livre.scale.setScalar(livre.scale.x + (1 - livre.scale.x) * 0.08);
  livre.position.y += (0 - livre.position.y) * 0.08;
  redimensionner();
  renderer.render(scene, camera);
  rafId = requestAnimationFrame(animer);
}

let jetonCouverture = 0;   // anti-course : seule la demande la plus récente s'applique

function appliquerCouverture(d) {
  const jeton = ++jetonCouverture;
  // Couverture générée affichée IMMÉDIATEMENT : jamais de reliquat du livre précédent
  // pendant le chargement réseau ; la vraie couverture la remplace quand elle arrive.
  matCouv.map = couvGeneree(d.titre, d.couleur); matCouv.color.set(0xffffff); matCouv.needsUpdate = true;
  const isbn = (d.isbn || '').trim();
  if (!isbn) return;
  // Fonction Edge "cover" (F1) : OpenLibrary/BnF/Amazon, avec CORS pour WebGL.
  const url = `${window.SUPABASE_URL}/functions/v1/cover?isbn=${isbn}`;
  const chargeur = new THREE.TextureLoader();
  chargeur.crossOrigin = 'anonymous';
  chargeur.load(
    url,
    tex => {
      if (jeton !== jetonCouverture) return;   // un autre livre a été ouvert entre-temps
      tex.anisotropy = 4; tex.colorSpace = THREE.SRGBColorSpace;
      matCouv.map = tex; matCouv.needsUpdate = true;
    },
    undefined,
    () => { /* échec réseau/404 : on garde la couverture générée déjà affichée */ }
  );
}

export function ouvrir(conteneur, d) {
  if (!renderer) {
    const canvas = document.createElement('canvas');
    canvas.className = 'canvas-livre';
    init(canvas);
  }
  conteneur.appendChild(renderer.domElement);
  cibleY = -0.5; cibleX = 0.18; libre = true;
  // Pose de départ de l'animation d'entrée (converge vers la pose de repos dans animer()).
  livre.rotation.set(0.45, -1.4, 0);
  livre.scale.setScalar(0.55);
  livre.position.y = -0.6;
  appliquerReliure(d.couleur);
  appliquerCouverture(d);
  redimensionner();
  if (!actif) { actif = true; t0 = performance.now(); rafId = requestAnimationFrame(animer); }
}

export function fermer() {
  actif = false;
  drag = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (renderer && renderer.domElement.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
}
