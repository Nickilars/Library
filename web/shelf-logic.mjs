// Présentation pure de l'étagère (groupement + couleur). Sans DOM, testable avec node.

function cmp(a, b) { a = (a || '').toLowerCase(); b = (b || '').toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; }
function sagaKey(s) { s = s || 'Aucune'; return (s === 'Aucune' ? '￿' : '') + s.toLowerCase(); } // 'Aucune' en dernier
function tomeKey(t) { return (t === null || t === undefined || t === '') ? Infinity : Number(t); }

// ---- Regroupement de l'étagère (G1) ----
// grouperLivres(livres, critere) -> [{ nom, rangees: [{ nom, livres }] }]
// Convention : une rangée nommée 'Aucune' n'affiche pas de libellé et la vue focalisée
// retombe sur le nom de la section.

function anneeNum(a) { const n = Number(a); return Number.isInteger(n) && n > 0 ? n : null; }
function decennie(a) { const n = anneeNum(a); return n ? Math.floor(n / 10) * 10 : null; }

const ORDRE_STATUTS = { non_lu: 0, en_cours: 1, lu: 2 };
const LIBELLES_STATUTS = { non_lu: 'À lire', en_cours: 'En cours', lu: 'Lu' };

// Par critère : tri global, puis extraction section/rangée (les livres arrivent triés,
// le groupement se fait par simple rupture de clé).
const CRITERES = {
  auteur: {
    trier: (a, b) => cmp(a.auteur, b.auteur) || cmp(sagaKey(a.saga), sagaKey(b.saga))
      || (tomeKey(a.tome) - tomeKey(b.tome)) || cmp(a.titre, b.titre),
    section: b => b.auteur,
    rangee: b => b.saga || 'Aucune',
  },
  genre: {
    trier: (a, b) => cmp(genreKey(a.genre), genreKey(b.genre)) || cmp(a.auteur, b.auteur)
      || cmp(sagaKey(a.saga), sagaKey(b.saga)) || (tomeKey(a.tome) - tomeKey(b.tome)) || cmp(a.titre, b.titre),
    section: b => (b.genre || '').trim() || 'Sans genre',
    rangee: b => b.auteur,
  },
  annee: {
    trier: (a, b) => ((decennie(a.annee_publication) ?? Infinity) - (decennie(b.annee_publication) ?? Infinity))
      || ((anneeNum(a.annee_publication) ?? Infinity) - (anneeNum(b.annee_publication) ?? Infinity)) || cmp(a.titre, b.titre),
    section: b => { const d = decennie(b.annee_publication); return d ? `Années ${d}` : 'Sans année'; },
    rangee: () => 'Aucune',
  },
  note: {
    trier: (a, b) => ((b.note ?? -1) - (a.note ?? -1)) || cmp(a.auteur, b.auteur) || cmp(a.titre, b.titre),
    section: b => b.note == null ? 'Sans note' : (b.note === 0 ? '0 étoile' : '★'.repeat(b.note)),
    rangee: () => 'Aucune',
  },
  statut: {
    trier: (a, b) => ((ORDRE_STATUTS[a.statut_lecture] ?? 9) - (ORDRE_STATUTS[b.statut_lecture] ?? 9))
      || cmp(a.auteur, b.auteur) || cmp(sagaKey(a.saga), sagaKey(b.saga)) || (tomeKey(a.tome) - tomeKey(b.tome)),
    section: b => LIBELLES_STATUTS[b.statut_lecture] || b.statut_lecture,
    rangee: () => 'Aucune',
  },
};
function genreKey(g) { g = (g || '').trim(); return g ? g.toLowerCase() : '￿'; } // 'Sans genre' en dernier

export function grouperLivres(livres, critere = 'auteur') {
  const c = CRITERES[critere] || CRITERES.auteur;
  const tries = [...livres].sort(c.trier);
  const groupes = [];
  for (const b of tries) {
    const nomSection = c.section(b), nomRangee = c.rangee(b);
    let g = groupes[groupes.length - 1];
    if (!g || g.nom.toLowerCase() !== String(nomSection).toLowerCase()) {
      g = { nom: nomSection, rangees: [] }; groupes.push(g);
    }
    let r = g.rangees[g.rangees.length - 1];
    if (!r || r.nom.toLowerCase() !== String(nomRangee).toLowerCase()) {
      r = { nom: nomRangee, livres: [] }; g.rangees.push(r);
    }
    r.livres.push(b);
  }
  return groupes;
}

function graine(titre, auteur) {
  const s = `${titre}|${auteur}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function couleurTranche(titre, auteur) {
  return hslVersHex(graine(titre, auteur) % 360, 0.45, 0.38);
}

// Apparence physique de la tranche sur l'étagère (E2) : hauteur/largeur variées,
// ~1 livre sur 7 légèrement penché (±4°). Déterministe (même graine que la couleur).
export function apparenceTranche(titre, auteur) {
  const h2 = Math.imul(graine(titre, auteur), 2654435761) >>> 0;   // second mélange (décorrèle de la teinte)
  const hauteur = 106 + (h2 % 19);                          // 106..124 px
  const largeur = 22 + ((h2 >>> 5) % 13);                   // 22..34 px
  const penche = (h2 >>> 9) % 7 === 0;
  const inclinaison = penche ? (((h2 >>> 12) % 2) ? 4 : -4) : 0;
  return { hauteur, largeur, inclinaison };
}
function hslVersHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, bb;
  if (h < 60) { r = c; g = x; bb = 0; }
  else if (h < 120) { r = x; g = c; bb = 0; }
  else if (h < 180) { r = 0; g = c; bb = x; }
  else if (h < 240) { r = 0; g = x; bb = c; }
  else if (h < 300) { r = x; g = 0; bb = c; }
  else { r = c; g = 0; bb = x; }
  const hh = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hh(r)}${hh(g)}${hh(bb)}`;
}

// --- Validation d'un livre avant écriture (miroir de la Phase 1, SEC-2) ---
const STATUTS_VALIDES = new Set(['non_lu', 'en_cours', 'lu']);
const LONGUEUR_MAX = 500;

// Genres prédéfinis (G1) : liste fermée pour des regroupements cohérents.
export const GENRES = [
  'Fantasy', 'Science-fiction', 'Fantastique', 'Policier / Thriller', 'Historique',
  'Classique', 'Roman', 'Biographie', 'Essai', 'BD / Manga', 'Jeunesse', 'Autre',
];
const GENRES_VALIDES = new Set(GENRES);

export function validerLivre(livre) {
  const titre = (livre.titre || '').trim();
  const auteur = (livre.auteur || '').trim();
  if (!titre) return { ok: false, erreur: 'Le titre est obligatoire.' };
  if (!auteur) return { ok: false, erreur: "L'auteur est obligatoire." };
  for (const [nom, val] of [['titre', titre], ['auteur', auteur], ['saga', livre.saga], ['commentaire', livre.commentaire]]) {
    if (val && val.length > LONGUEUR_MAX) return { ok: false, erreur: `Le champ ${nom} dépasse ${LONGUEUR_MAX} caractères.` };
  }
  if (!STATUTS_VALIDES.has(livre.statut_lecture)) return { ok: false, erreur: 'Statut de lecture invalide.' };

  let noteNorm = null;
  if (livre.note !== '' && livre.note !== null && livre.note !== undefined) {
    const n = Number(livre.note);
    if (!Number.isInteger(n) || n < 0 || n > 5) return { ok: false, erreur: 'La note doit être un entier entre 0 et 5.' };
    noteNorm = n;
  }

  const isbn = (livre.isbn || '').trim();
  if (isbn && !/^\d{13}$/.test(isbn)) return { ok: false, erreur: "L'ISBN doit comporter 13 chiffres." };

  const genre = (livre.genre || '').trim();
  if (genre && !GENRES_VALIDES.has(genre)) return { ok: false, erreur: 'Genre invalide.' };

  let tomeNorm = null;
  if (livre.tome !== '' && livre.tome !== null && livre.tome !== undefined) {
    const t = Number(livre.tome);
    if (!Number.isInteger(t) || t < 0) return { ok: false, erreur: 'Le tome doit être un entier positif.' };
    tomeNorm = t;
  }

  return {
    ok: true,
    livre: {
      titre, auteur,
      annee_publication: (livre.annee_publication || '').trim(),
      isbn,
      saga: (livre.saga || '').trim() || 'Aucune',
      genre,
      tome: tomeNorm,
      statut_lecture: livre.statut_lecture,
      possede: !!livre.possede,
      wishlist: !!livre.wishlist,
      note: noteNorm,
      commentaire: (livre.commentaire || '').trim(),
    },
  };
}
