// Étagère — navigation à 3 niveaux + livre animé. Lecture seule.
// Niveau 0 : étagère (tranches sans titre). Clic saga -> niveau 1.
// Niveau 1 : vue focalisée d'un groupe de saga (titres visibles). Clic livre -> niveau 2.
// Niveau 2 : livre ouvert animé (couverture -> ouverture -> pages -> infos).

const STATUTS = { non_lu: 'À lire', en_cours: 'En cours', lu: 'Lu' };

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

// Appelé par l'en-tête de saga : onclick="basculerSaga(this)"
function basculerSaga(elNom) {
  focaliser(elNom.closest('.saga'));
}

function quitterFocus() {
  fermerLivre();
  document.body.classList.remove('mode-focus');
  document.querySelectorAll('.saga.focalisee').forEach(s => s.classList.remove('focalisee'));
  document.querySelectorAll('.auteur.auteur-focus').forEach(a => a.classList.remove('auteur-focus'));
}

// ---------- Niveau 1 -> 2 : ouvrir un livre ----------
// Appelé par une tranche : onclick="choisirLivre(this)"
function choisirLivre(el) {
  // On impose de passer d'abord par la saga : hors mode focus, un clic sur une
  // tranche focalise sa saga au lieu d'ouvrir directement le livre.
  if (!document.body.classList.contains('mode-focus')) {
    focaliser(el.closest('.saga'));
    return;
  }
  ouvrirLivre(el);
}

function couvRepli(couv, titre) {
  const s = document.createElement('span');
  s.className = 'couv-repli';
  s.textContent = titre;
  couv.replaceChildren(s);
}

function ajouterLigne(page, texte, classe) {
  const p = document.createElement('p');
  if (classe) p.className = classe;
  p.textContent = texte;   // textContent : jamais d'injection HTML (SEC-W1)
  page.appendChild(p);
}

function ouvrirLivre(el) {
  const d = el.dataset;
  const overlay = document.getElementById('livre-ouvert');
  overlay.replaceChildren();

  const livre = document.createElement('div');
  livre.className = 'livre3d';

  // Double page d'infos (état final, SOUS la couverture/les feuilles) — pas de couverture ici.
  const spread = document.createElement('div');
  spread.className = 'spread';

  const gauche = document.createElement('div');
  gauche.className = 'page page-gauche';
  ajouterLigne(gauche, d.titre, 'titre-livre');
  ajouterLigne(gauche, d.auteur + (d.annee ? ' · ' + d.annee : ''), 'sous');
  if (d.saga && d.saga !== 'Aucune') {
    ajouterLigne(gauche, 'Saga : ' + d.saga + (d.tome ? ' · Tome ' + d.tome : ''), '');
  }

  const droite = document.createElement('div');
  droite.className = 'page page-droite';
  ajouterLigne(droite, 'Statut : ' + (STATUTS[d.statut] || d.statut), '');
  if (d.possede === '1') ajouterLigne(droite, 'Possédé ✓', '');
  if (d.note) ajouterLigne(droite, '★'.repeat(Number(d.note)), 'note');
  if (d.commentaire) ajouterLigne(droite, '« ' + d.commentaire + ' »', 'commentaire');
  const crayon = document.createElement('button');
  crayon.className = 'crayon';
  crayon.disabled = true;
  crayon.title = 'Modification — bientôt (Phase 3)';
  crayon.textContent = '✏️';
  droite.appendChild(crayon);

  spread.appendChild(gauche);
  spread.appendChild(droite);
  livre.appendChild(spread);

  // Feuilles décoratives qui défilent (au-dessus de la double page)
  for (let i = 0; i < 4; i++) {
    const f = document.createElement('div');
    f.className = 'feuille';
    f.style.setProperty('--i', i);
    livre.appendChild(f);
  }

  // Couverture (étapes 1-2), au-dessus de tout : image OL ou couverture générée
  const couv = document.createElement('div');
  couv.className = 'couverture';
  const url = d.isbn ? `https://covers.openlibrary.org/b/isbn/${d.isbn}-L.jpg` : '';
  if (url) {
    couv.style.backgroundImage = `url("${url}")`;
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => {
      couv.style.backgroundImage = 'none';
      couv.style.background = el.style.getPropertyValue('--c');
      couvRepli(couv, d.titre);
    };
    img.src = url;
  } else {
    couv.style.background = el.style.getPropertyValue('--c');
    couvRepli(couv, d.titre);
  }
  livre.appendChild(couv);

  overlay.appendChild(livre);
  overlay.classList.remove('cache');

  // Démarre la séquence (les délais sont gérés en CSS via la classe 'demarre').
  void livre.offsetWidth;  // force un reflow pour que la transition parte de l'état initial
  livre.classList.add('demarre');

  // Clic sur le fond = fermer ; clic sur le livre = sauter directement aux infos.
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      fermerLivre();
    } else {
      livre.classList.add('fini');
    }
  };
}

function fermerLivre() {
  const overlay = document.getElementById('livre-ouvert');
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
