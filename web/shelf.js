// Étagère — navigation à 3 niveaux. Lecture seule.
// Niveau 0 : étagère (tranches sans titre). Clic saga -> niveau 1.
// Niveau 1 : vue focalisée d'un groupe de saga (titres visibles). Clic livre -> niveau 2.
// Niveau 2 : détail du livre = livre 3D fermé (book3d.js) + carte d'infos ; repli 2D sans WebGL.

const STATUTS = { non_lu: 'À lire', en_cours: 'En cours', lu: 'Lu' };
let book3dMod = null;          // module book3d.js (chargé paresseusement)
let book3dActif = false;       // un livre 3D est-il monté ?

// ---------- Niveau 0 -> 1 : focaliser un groupe de saga ----------
function focaliser(saga) {
  document.querySelectorAll('.saga.focalisee').forEach(s => s.classList.remove('focalisee'));
  document.querySelectorAll('.auteur.auteur-focus').forEach(a => a.classList.remove('auteur-focus'));
  saga.classList.add('focalisee');
  const auteur = saga.closest('.auteur');
  auteur.classList.add('auteur-focus');
  document.body.classList.add('mode-focus');
  const nom = (saga.dataset.saga && saga.dataset.saga !== 'Aucune')
    ? saga.dataset.saga
    : auteur.querySelector('.auteur-nom').textContent.trim();
  document.getElementById('focus-nom').textContent = nom;
}
function basculerSaga(elNom) { focaliser(elNom.closest('.saga')); }
function quitterFocus() {
  fermerLivre();
  document.body.classList.remove('mode-focus');
  document.querySelectorAll('.saga.focalisee').forEach(s => s.classList.remove('focalisee'));
  document.querySelectorAll('.auteur.auteur-focus').forEach(a => a.classList.remove('auteur-focus'));
}

// ---------- Niveau 1 -> 2 : ouvrir le détail d'un livre ----------
function choisirLivre(el) {
  if (!document.body.classList.contains('mode-focus')) { focaliser(el.closest('.saga')); return; }
  ouvrirLivre(el);
}

function ligne(parent, texte, classe) {
  const p = document.createElement('p');
  if (classe) p.className = classe;
  p.textContent = texte;          // textContent : pas d'injection HTML (SEC-W1)
  parent.appendChild(p);
}

function construireCarte(d) {
  const carte = document.createElement('div');
  carte.className = 'carte-infos';
  const h = document.createElement('h2'); h.textContent = d.titre; carte.appendChild(h);
  ligne(carte, d.auteur + (d.annee ? ' · ' + d.annee : ''), 'aut');
  if (d.saga && d.saga !== 'Aucune') {
    ligne(carte, 'Saga : ' + d.saga + (d.tome ? ' · Tome ' + d.tome : ''), '');
  }
  ligne(carte, 'Statut : ' + (STATUTS[d.statut] || d.statut) + (d.possede === '1' ? ' · Possédé ✓' : ''), '');
  if (d.note) ligne(carte, '★'.repeat(Number(d.note)), 'note');
  if (d.commentaire) ligne(carte, '« ' + d.commentaire + ' »', 'com');
  const crayon = document.createElement('button');
  crayon.className = 'crayon';
  crayon.title = 'Modifier ce livre'; crayon.textContent = '✏️ Modifier';
  crayon.addEventListener('click', () => {
    fermerLivre();
    if (window.ouvrirEdition) window.ouvrirEdition(d.id);
  });
  carte.appendChild(crayon);
  return carte;
}

function webglDisponible() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
}

// Repli 2D : couverture en image (ou aplat couleur + titre si absente)
function couverture2D(d, couleur) {
  const div = document.createElement('div');
  div.className = 'couv-2d';
  div.style.background = couleur || '#444';
  div.textContent = d.titre;
  const isbn = (d.isbn || '').trim();
  if (isbn) {
    const img = document.createElement('img');
    img.referrerPolicy = 'no-referrer';
    img.alt = d.titre;
    img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover'; img.style.borderRadius = '4px';
    img.onload = () => { div.textContent = ''; div.style.background = 'none'; div.appendChild(img); };
    img.onerror = () => { /* on garde l'aplat couleur + titre */ };
    img.src = `${window.SUPABASE_URL}/functions/v1/cover?isbn=${isbn}`;   // F1 : OL -> BnF -> Amazon
  }
  return div;
}

function ouvrirLivre(el) {
  const d = el.dataset;
  const couleur = el.style.getPropertyValue('--c');
  const overlay = document.getElementById('livre-ouvert');
  overlay.replaceChildren();

  const zone = document.createElement('div');
  zone.className = 'zone-livre';
  overlay.appendChild(zone);
  overlay.appendChild(construireCarte(d));
  overlay.classList.remove('cache');

  const donnees = { titre: d.titre, isbn: d.isbn, couleur };
  if (webglDisponible()) {
    import('./book3d.js')
      .then(mod => { book3dMod = mod; book3dActif = true; mod.ouvrir(zone, donnees); })
      .catch(() => { zone.appendChild(couverture2D(d, couleur)); });
  } else {
    zone.appendChild(couverture2D(d, couleur));
  }

  overlay.onclick = (e) => { if (e.target === overlay) fermerLivre(); };
}

function fermerLivre() {
  const overlay = document.getElementById('livre-ouvert');
  if (book3dActif && book3dMod) { book3dMod.fermer(); book3dActif = false; }
  overlay.classList.add('cache');
  overlay.replaceChildren();
  overlay.onclick = null;
}

// ---------- Recherche + filtre statut (niveau 0) ----------
let filtreStatut = '';
function appliquerFiltres() {
  const q = document.getElementById('recherche').value.trim().toLowerCase();
  document.querySelectorAll('.livre').forEach(livre => {
    const d = livre.dataset;
    const okTexte = !q ||
      d.titre.toLowerCase().includes(q) ||
      d.auteur.toLowerCase().includes(q) ||
      (d.saga || '').toLowerCase().includes(q);
    const okStatut = !filtreStatut || d.statut === filtreStatut;
    livre.classList.toggle('masque', !(okTexte && okStatut));
  });
  document.querySelectorAll('.saga').forEach(s => {
    s.style.display = s.querySelectorAll('.livre:not(.masque)').length ? '' : 'none';
  });
  document.querySelectorAll('.auteur').forEach(a => {
    a.style.display = a.querySelectorAll('.livre:not(.masque)').length ? '' : 'none';
  });
}

// ---------- Câblage ----------
document.getElementById('recherche').addEventListener('input', appliquerFiltres);
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('actif'));
    chip.classList.add('actif');
    filtreStatut = chip.dataset.statut;
    appliquerFiltres();
  });
});
document.getElementById('btn-retour').addEventListener('click', quitterFocus);
