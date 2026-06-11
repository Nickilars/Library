// Scan caméra (BarcodeDetector natif). Boutons masqués si l'API manque (desktop/iOS) :
// la saisie manuelle + 🔍 Rechercher (C2) restent le repli universel.
// Expose window.scanDisponible() et window.demarrerScan({ continu, surIsbn, surFermeture }).
import { estIsbnScanne, antiRebond } from './scan-logic.mjs';

const INTERVALLE_MS = 200;   // ~5 détections/s — suffisant et économe en batterie

let flux = null, minuteur = null, overlay = null;

async function scanDisponible() {
  try {
    if (!('BarcodeDetector' in window)) return false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    const formats = await window.BarcodeDetector.getSupportedFormats();
    return formats.includes('ean_13');
  } catch (e) { return false; }
}

function construireOverlay() {
  const o = document.createElement('div');
  o.id = 'scan-overlay'; o.className = 'scan-overlay';
  const video = document.createElement('video');
  video.className = 'scan-video';
  video.setAttribute('playsinline', '');   // pas de plein écran forcé sur mobile
  video.muted = true;
  const visee = document.createElement('div'); visee.className = 'scan-visee';
  const toasts = document.createElement('div'); toasts.className = 'scan-toasts';
  const fermer = document.createElement('button');
  fermer.type = 'button'; fermer.className = 'scan-fermer'; fermer.textContent = '✕';
  o.append(video, visee, toasts, fermer);
  document.body.appendChild(o);
  return { o, video, toasts, fermer };
}

function toast(conteneur, texte, type) {
  const t = document.createElement('p');
  t.className = 'scan-toast' + (type ? ' ' + type : '');
  t.textContent = texte;                    // SEC-W1 : jamais innerHTML
  conteneur.prepend(t);
  setTimeout(() => t.remove(), 4000);
  while (conteneur.children.length > 4) conteneur.lastChild.remove();
}

function arreterScan(surFermeture) {
  if (minuteur) { clearInterval(minuteur); minuteur = null; }
  if (flux) { flux.getTracks().forEach(p => p.stop()); flux = null; }   // LED caméra éteinte, toujours
  if (overlay) { overlay.remove(); overlay = null; }
  if (surFermeture) surFermeture();
}

// continu=false (D1) : ferme après le premier ISBN. continu=true (D2) : reste ouvert,
// anti-rebond, surIsbn(isbn, ui) reçoit ui.toast pour le retour visuel.
async function demarrerScan({ continu = false, surIsbn, surFermeture } = {}) {
  if (overlay || !surIsbn) return;          // déjà ouvert / mal appelé
  const ui = construireOverlay();
  overlay = ui.o;
  ui.fermer.addEventListener('click', () => arreterScan(surFermeture));

  try {
    flux = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }, audio: false,
    });
  } catch (e) {
    arreterScan(surFermeture);
    throw new Error('camera_refusee');      // l'appelant affiche son message
  }
  ui.video.srcObject = flux;
  await ui.video.play();

  const detecteur = new window.BarcodeDetector({ formats: ['ean_13'] });
  let etat = null, occupe = false;
  minuteur = setInterval(async () => {
    if (occupe || !flux) return;
    occupe = true;
    try {
      const codes = await detecteur.detect(ui.video);
      for (const c of codes) {
        const brut = (c.rawValue || '').trim();
        if (!estIsbnScanne(brut)) continue;            // EAN produit / QR : ignorés
        const r = antiRebond(brut, etat, Date.now());
        etat = r.etat;
        if (!r.accepte) continue;
        if (navigator.vibrate) navigator.vibrate(80);
        if (!continu) { arreterScan(surFermeture); }
        await surIsbn(brut, { toast: (txt, type) => { if (overlay) toast(ui.toasts, txt, type); } });
        if (!continu) return;
      }
    } catch (e) { /* frame illisible : on retente au tick suivant */ }
    occupe = false;
  }, INTERVALLE_MS);
}

// Révèle le bouton D1 si le scan est possible (le D2 est révélé par app.js, module exécuté après).
(async () => {
  if (await scanDisponible()) {
    const btn = document.getElementById('btn-scan');
    if (btn) btn.hidden = false;
  }
})();

window.scanDisponible = scanDisponible;
window.demarrerScan = demarrerScan;
