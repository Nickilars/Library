import assert from 'node:assert';
import { grouperLivres, couleurTranche, validerLivre, apparenceTranche } from './shelf-logic.mjs';

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

console.log('OK : tests shelf-logic passent.');
