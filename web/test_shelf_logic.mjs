import assert from 'node:assert';
import { grouperLivres, couleurTranche, validerLivre, apparenceTranche, couleurDominante } from './shelf-logic.mjs';

// Fabrique un tableau RGBA à partir de [r,g,b,n] répétés.
function pixels(...blocs) {
  const sortie = [];
  for (const [r, g, b, n] of blocs) for (let i = 0; i < n; i++) sortie.push(r, g, b, 255);
  return new Uint8ClampedArray(sortie);
}
function canal(hex, i) { return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16); }

// couleurTranche : déterministe + format #rrggbb + variabilité
const c1 = couleurTranche('Dune', 'Herbert');
assert.strictEqual(c1, couleurTranche('Dune', 'Herbert'), 'déterministe');
assert.match(c1, /^#[0-9a-f]{6}$/, 'format hex');
assert.notStrictEqual(couleurTranche('Dune', 'Herbert'), couleurTranche('Le Hobbit', 'Tolkien'));

// grouperLivres (défaut = auteur) : auteur -> saga -> tome
const livres = [
  { titre: 'La nef du crépuscule', auteur: 'Robin Hobb', saga: "L'Assassin royal", tome: 3 },
  { titre: "L'apprenti assassin", auteur: 'Robin Hobb', saga: "L'Assassin royal", tome: 1 },
  { titre: 'Le Hobbit', auteur: 'Tolkien', saga: 'Aucune', tome: null },
];
const g = grouperLivres(livres);
assert.deepStrictEqual(g.map(x => x.nom), ['Robin Hobb', 'Tolkien']);
assert.strictEqual(g[0].rangees[0].nom, "L'Assassin royal");
assert.deepStrictEqual(g[0].rangees[0].livres.map(b => b.titre), ["L'apprenti assassin", 'La nef du crépuscule']);
assert.strictEqual(g[1].rangees[0].nom, 'Aucune');

// insensible à la casse : un seul groupe
const g2 = grouperLivres([
  { titre: 'A', auteur: 'Tolkien', saga: 'X', tome: 1 },
  { titre: 'B', auteur: 'tolkien', saga: 'x', tome: 2 },
]);
assert.strictEqual(g2.length, 1, 'auteurs casse-insensible');
assert.strictEqual(g2[0].rangees.length, 1, 'sagas casse-insensible');

// saga vide -> "Aucune"
const g3 = grouperLivres([{ titre: 'Seul', auteur: 'X', saga: null, tome: null }]);
assert.strictEqual(g3[0].rangees[0].nom, 'Aucune');

// --- G1 : regroupements alternatifs ---
const coll = [
  { titre: 'Dune', auteur: 'Frank Herbert', saga: 'Dune', tome: 1, genre: 'Science-fiction', annee_publication: '1965', note: 5, statut_lecture: 'lu' },
  { titre: "L'apprenti assassin", auteur: 'Robin Hobb', saga: "L'Assassin royal", tome: 1, genre: 'Fantasy', annee_publication: '1995', note: 5, statut_lecture: 'lu' },
  { titre: 'Le Hobbit', auteur: 'Tolkien', saga: null, tome: null, genre: 'Fantasy', annee_publication: '1937', note: 4, statut_lecture: 'en_cours' },
  { titre: 'Mystère', auteur: 'Inconnu', saga: null, tome: null, genre: '', annee_publication: '', note: null, statut_lecture: 'non_lu' },
];

// genre : sections A->Z, « Sans genre » en dernier, rangées par auteur
const gg = grouperLivres(coll, 'genre');
assert.deepStrictEqual(gg.map(x => x.nom), ['Fantasy', 'Science-fiction', 'Sans genre']);
assert.deepStrictEqual(gg[0].rangees.map(r => r.nom), ['Robin Hobb', 'Tolkien']);

// annee : décennies croissantes, « Sans année » en dernier, rangée unique sans libellé
const ga = grouperLivres(coll, 'annee');
assert.deepStrictEqual(ga.map(x => x.nom), ['Années 1930', 'Années 1960', 'Années 1990', 'Sans année']);
assert.strictEqual(ga[0].rangees[0].nom, 'Aucune');

// note : 5 étoiles d'abord, « Sans note » en dernier
const gn = grouperLivres(coll, 'note');
assert.deepStrictEqual(gn.map(x => x.nom), ['★★★★★', '★★★★', 'Sans note']);
assert.strictEqual(gn[0].rangees[0].livres.length, 2, 'deux 5 étoiles');

// statut : À lire / En cours / Lu
const gs = grouperLivres(coll, 'statut');
assert.deepStrictEqual(gs.map(x => x.nom), ['À lire', 'En cours', 'Lu']);

// critère inconnu -> retombe sur auteur
assert.deepStrictEqual(grouperLivres(livres, 'zzz').map(x => x.nom), ['Robin Hobb', 'Tolkien']);

// validation du genre
assert.strictEqual(validerLivre({ titre: 'T', auteur: 'A', statut_lecture: 'lu', genre: 'Fantasy' }).ok, true);
assert.strictEqual(validerLivre({ titre: 'T', auteur: 'A', statut_lecture: 'lu', genre: 'Pâtisserie' }).ok, false, 'genre hors liste');
assert.strictEqual(validerLivre({ titre: 'T', auteur: 'A', statut_lecture: 'lu' }).livre.genre, '', 'genre optionnel');

// validerLivre : champs requis
assert.strictEqual(validerLivre({ titre: '', auteur: 'A', statut_lecture: 'lu' }).ok, false, 'titre requis');
assert.strictEqual(validerLivre({ titre: 'T', auteur: '', statut_lecture: 'lu' }).ok, false, 'auteur requis');
// statut invalide
assert.strictEqual(validerLivre({ titre: 'T', auteur: 'A', statut_lecture: 'zzz' }).ok, false, 'statut');
// note hors bornes
assert.strictEqual(validerLivre({ titre: 'T', auteur: 'A', statut_lecture: 'lu', note: 9 }).ok, false, 'note');
// isbn non 13 chiffres
assert.strictEqual(validerLivre({ titre: 'T', auteur: 'A', statut_lecture: 'lu', isbn: 'abc' }).ok, false, 'isbn');
// tome négatif
assert.strictEqual(validerLivre({ titre: 'T', auteur: 'A', statut_lecture: 'lu', tome: -1 }).ok, false, 'tome');
// cas valide normalisé
const rv = validerLivre({ titre: '  Dune ', auteur: ' Herbert ', statut_lecture: 'lu', saga: '', note: '', tome: '', isbn: '' });
assert.strictEqual(rv.ok, true, 'valide');
assert.strictEqual(rv.livre.titre, 'Dune');
assert.strictEqual(rv.livre.saga, 'Aucune');
assert.strictEqual(rv.livre.note, null);
assert.strictEqual(rv.livre.tome, null);
assert.strictEqual(rv.livre.possede, false);

// apparenceTranche : déterministe, bornes respectées, inclinaison rare et bornée (E2)
const a1 = apparenceTranche('Dune', 'Herbert');
assert.deepStrictEqual(a1, apparenceTranche('Dune', 'Herbert'), 'déterministe');
let penches = 0;
for (let i = 0; i < 200; i++) {
  const a = apparenceTranche('Livre ' + i, 'Auteur ' + (i % 13));
  assert.ok(a.hauteur >= 106 && a.hauteur <= 124, 'hauteur 106-124 (' + a.hauteur + ')');
  assert.ok(a.largeur >= 22 && a.largeur <= 34, 'largeur 22-34 (' + a.largeur + ')');
  assert.ok([-4, 0, 4].includes(a.inclinaison), 'inclinaison -4/0/4');
  if (a.inclinaison !== 0) penches++;
}
assert.ok(penches > 5 && penches < 80, `inclinés ~1/7 (${penches}/200)`);
// variabilité : deux livres différents ne partagent pas toute leur apparence
const a2 = apparenceTranche('Le Hobbit', 'Tolkien');
assert.notDeepStrictEqual(a1, a2, 'apparences distinctes');

// couleurDominante (G3) : la teinte dominante « utile » de la couverture
// format hex
const rouge = couleurDominante(pixels([200, 30, 30, 100]));
assert.match(rouge, /^#[0-9a-f]{6}$/, 'format hex');
assert.ok(canal(rouge, 0) > canal(rouge, 1) && canal(rouge, 0) > canal(rouge, 2), 'rouge dominant');
// les fonds blancs et le texte noir sont ignorés
const bleuSurBlanc = couleurDominante(pixels([250, 250, 250, 300], [10, 10, 10, 100], [40, 60, 190, 80]));
assert.ok(canal(bleuSurBlanc, 2) > canal(bleuSurBlanc, 0), 'bleu malgré fond blanc + texte noir');
// majorité verte vs minorité rouge -> vert
const vert = couleurDominante(pixels([40, 160, 60, 120], [180, 40, 40, 40]));
assert.ok(canal(vert, 1) > canal(vert, 0), 'teinte majoritaire retenue');
// couverture entièrement sombre -> moyenne assombrie, pas null
const sombre = couleurDominante(pixels([15, 12, 10, 100]));
assert.match(sombre, /^#[0-9a-f]{6}$/, 'sombre : repli moyenne');
// transparent / vide -> null
assert.strictEqual(couleurDominante(new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 0])), null, 'transparent -> null');
assert.strictEqual(couleurDominante(new Uint8ClampedArray([])), null, 'vide -> null');
// la couleur est ramenée dans une plage de tranche lisible (ni blanc pur ni noir pur)
const clair = couleurDominante(pixels([255, 80, 80, 100]));
const lum = (canal(clair, 0) + canal(clair, 1) + canal(clair, 2)) / 3;
assert.ok(lum > 30 && lum < 200, `luminosité bornée (${lum})`);

console.log('OK : tests shelf-logic passent.');
