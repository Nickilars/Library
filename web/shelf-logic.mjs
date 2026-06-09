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
