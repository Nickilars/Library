// Présentation pure de l'étagère (groupement + couleur). Sans DOM, testable avec node.

function cmp(a, b) { a = (a || '').toLowerCase(); b = (b || '').toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; }
function sagaKey(s) { s = s || 'Aucune'; return (s === 'Aucune' ? '￿' : '') + s.toLowerCase(); } // 'Aucune' en dernier
function tomeKey(t) { return (t === null || t === undefined || t === '') ? Infinity : Number(t); }

export function grouperLivres(livres) {
  const tries = [...livres].sort((a, b) =>
    cmp(a.auteur, b.auteur) ||
    cmp(sagaKey(a.saga), sagaKey(b.saga)) ||
    (tomeKey(a.tome) - tomeKey(b.tome)) ||
    cmp(a.titre, b.titre)
  );
  const groupes = [];
  for (const b of tries) {
    let g = groupes[groupes.length - 1];
    if (!g || (g.auteur || '').toLowerCase() !== (b.auteur || '').toLowerCase()) {
      g = { auteur: b.auteur, sagas: [] }; groupes.push(g);
    }
    const nomSaga = b.saga || 'Aucune';
    let s = g.sagas[g.sagas.length - 1];
    if (!s || s.nom.toLowerCase() !== nomSaga.toLowerCase()) {
      s = { nom: nomSaga, livres: [] }; g.sagas.push(s);
    }
    s.livres.push(b);
  }
  return groupes;
}

export function couleurTranche(titre, auteur) {
  const s = `${titre}|${auteur}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return hslVersHex(h % 360, 0.45, 0.38);
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
      tome: tomeNorm,
      statut_lecture: livre.statut_lecture,
      possede: !!livre.possede,
      wishlist: !!livre.wishlist,
      note: noteNorm,
      commentaire: (livre.commentaire || '').trim(),
    },
  };
}
