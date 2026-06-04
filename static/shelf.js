// Interaction de l'étagère — 100% côté client, lecture seule.

// Déplier / replier une saga
function basculerSaga(elNom) {
  elNom.closest('.saga').classList.toggle('ouverte');
}

// Sélectionner un livre : pivoter de face (couverture), écarter les voisins, ouvrir le panneau
function choisirLivre(el) {
  document.querySelectorAll('.livre.selectionne, .livre.voisin-gauche, .livre.voisin-droite')
    .forEach(l => l.classList.remove('selectionne', 'voisin-gauche', 'voisin-droite'));

  el.classList.add('selectionne');
  const precedent = el.previousElementSibling;
  const suivant = el.nextElementSibling;
  if (precedent) precedent.classList.add('voisin-gauche');
  if (suivant) suivant.classList.add('voisin-droite');

  const isbn = el.dataset.isbn;
  const couv = document.getElementById('panneau-couverture');
  const titre = el.dataset.titre;
  if (isbn) {
    const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
    couv.style.backgroundImage = `url("${url}")`;
    couv.innerHTML = '';
    const test = new Image();
    test.referrerPolicy = 'no-referrer';
    test.onerror = () => { couv.style.backgroundImage = 'none'; couv.style.background = el.style.getPropertyValue('--c'); couv.innerHTML = `<span class="repli">${titre}</span>`; };
    test.src = url;
    el.style.backgroundImage = `url("${url}")`;
  } else {
    couv.style.backgroundImage = 'none';
    couv.style.background = el.style.getPropertyValue('--c');
    couv.innerHTML = `<span class="repli">${titre}</span>`;
  }

  const statuts = { non_lu: 'À lire', en_cours: 'En cours', lu: 'Lu' };
  const d = el.dataset;
  document.getElementById('p-titre').textContent = d.titre;
  document.getElementById('p-auteur').textContent = d.auteur + (d.annee ? ' · ' + d.annee : '');
  document.getElementById('p-saga').textContent =
    d.saga && d.saga !== 'Aucune' ? `Saga : ${d.saga}` + (d.tome ? ` · Tome ${d.tome}` : '') : '';
  document.getElementById('p-statut').textContent =
    `Statut : ${statuts[d.statut] || d.statut}` + (d.possede === '1' ? ' · Possédé ✓' : '');
  document.getElementById('p-note').textContent = d.note ? '★'.repeat(Number(d.note)) : '';
  document.getElementById('p-commentaire').textContent = d.commentaire || '';

  const panneau = document.getElementById('panneau');
  panneau.classList.remove('ferme');
  panneau.setAttribute('aria-hidden', 'false');
}

document.getElementById('panneau-fermer').addEventListener('click', () => {
  const panneau = document.getElementById('panneau');
  panneau.classList.add('ferme');
  panneau.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('.livre.selectionne, .livre.voisin-gauche, .livre.voisin-droite')
    .forEach(l => { l.classList.remove('selectionne', 'voisin-gauche', 'voisin-droite'); l.style.backgroundImage = 'none'; });
});

let filtreStatut = '';
function appliquerFiltres() {
  const q = document.getElementById('recherche').value.trim().toLowerCase();
  document.querySelectorAll('.livre').forEach(livre => {
    const d = livre.dataset;
    const correspondTexte = !q ||
      d.titre.toLowerCase().includes(q) ||
      d.auteur.toLowerCase().includes(q) ||
      (d.saga || '').toLowerCase().includes(q);
    const correspondStatut = !filtreStatut || d.statut === filtreStatut;
    livre.classList.toggle('masque', !(correspondTexte && correspondStatut));
  });
  document.querySelectorAll('.saga').forEach(s => {
    const visibles = s.querySelectorAll('.livre:not(.masque)').length;
    s.style.display = visibles ? '' : 'none';
  });
  document.querySelectorAll('.auteur').forEach(a => {
    const visibles = a.querySelectorAll('.livre:not(.masque)').length;
    a.style.display = visibles ? '' : 'none';
  });
}

document.getElementById('recherche').addEventListener('input', appliquerFiltres);
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('actif'));
    chip.classList.add('actif');
    filtreStatut = chip.dataset.statut;
    appliquerFiltres();
  });
});
