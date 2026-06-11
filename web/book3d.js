// Visionneuse de livre 3D fermé (Three.js vendoré). Lecture seule.
// Visionneuse persistante (un seul contexte WebGL) réutilisée entre ouvertures.
import * as THREE from './vendor/three.module.js';

const W = 1.7, H = 2.4, T = 0.55;   // dimensions du livre (épais)
let renderer, scene, camera, livre, matCouv, rafId = null, actif = false;
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
  g.addColorStop(0, '#6b5a45'); g.addColorStop(0.55, '#3a2c1e'); g.addColorStop(1, '#14100b');
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

// Texture de tranche : fines lignes pour évoquer les pages
function texTranche() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 512;
  const x = cv.getContext('2d');
  x.fillStyle = '#efe6d0'; x.fillRect(0, 0, 64, 512);
  x.strokeStyle = '#d8ccae'; x.lineWidth = 1;
  for (let y = 2; y < 512; y += 3) { x.beginPath(); x.moveTo(0, y); x.lineTo(64, y); x.stroke(); }
  return new THREE.CanvasTexture(cv);
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
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
}

function init(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2); camera.lookAt(0, 0, 0);

  // Environnement PMREM (généré une fois) : remplissage réaliste + reflets sur la jaquette.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(texEnvironnement()).texture;
  pmrem.dispose();
  scene.add(ombreContact());

  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xfff2e0, 0.9); key.position.set(3, 4, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0x99bbff, 0.2); fill.position.set(-4, 1, 2); scene.add(fill);

  matCouv = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.55, metalness: 0.08 });
  const matDos = new THREE.MeshStandardMaterial({ color: 0x2b1d12, roughness: 0.6 });
  const matReliure = new THREE.MeshStandardMaterial({ color: 0x3a2233, roughness: 0.7 });
  const matPages = new THREE.MeshStandardMaterial({ map: texTranche(), roughness: 1 });
  const mats = [matPages, matReliure, matPages, matPages, matCouv, matDos];
  livre = new THREE.Mesh(new THREE.BoxGeometry(W, H, T), mats);
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
  redimensionner();
  renderer.render(scene, camera);
  rafId = requestAnimationFrame(animer);
}

function appliquerCouverture(d) {
  const isbn = (d.isbn || '').trim();
  if (isbn) {
    const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
    const chargeur = new THREE.TextureLoader();
    chargeur.crossOrigin = 'anonymous';
    chargeur.load(
      url,
      tex => { tex.anisotropy = 4; matCouv.map = tex; matCouv.color.set(0xffffff); matCouv.needsUpdate = true; },
      undefined,
      () => { matCouv.map = couvGeneree(d.titre, d.couleur); matCouv.color.set(0xffffff); matCouv.needsUpdate = true; }
    );
  } else {
    matCouv.map = couvGeneree(d.titre, d.couleur); matCouv.color.set(0xffffff); matCouv.needsUpdate = true;
  }
}

export function ouvrir(conteneur, d) {
  if (!renderer) {
    const canvas = document.createElement('canvas');
    canvas.className = 'canvas-livre';
    init(canvas);
  }
  conteneur.appendChild(renderer.domElement);
  cibleY = -0.5; cibleX = 0.18; libre = true;
  livre.rotation.set(0.18, -0.5, 0);
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
