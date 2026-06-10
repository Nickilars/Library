import assert from 'node:assert';
import { grouperLivres, couleurTranche, validerLivre } from './shelf-logic.mjs';

// couleurTranche : déterministe + format #rrggbb + variabilité
const c1 = couleurTranche('Dune', 'Herbert');
assert.strictEqual(c1, couleurTranche('Dune', 'Herbert'), 'déterministe');
assert.match(c1, /^#[0-9a-f]{6}$/, 'format hex');
assert.notStrictEqual(couleurTranche('Dune', 'Herbert'), couleurTranche('Le Hobbit', 'Tolkien'));

// grouperLivres : auteur -> saga -> tome
const livres = [
  { titre: 'La nef du crépuscule', auteur: 'Robin Hobb', saga: "L'Assassin royal", tome: 3 },
  { titre: "L'apprenti assassin", auteur: 'Robin Hobb', saga: "L'Assassin royal", tome: 1 },
  { titre: 'Le Hobbit', auteur: 'Tolkien', saga: 'Aucune', tome: null },
];
const g = grouperLivres(livres);
assert.deepStrictEqual(g.map(x => x.auteur), ['Robin Hobb', 'Tolkien']);
assert.strictEqual(g[0].sagas[0].nom, "L'Assassin royal");
assert.deepStrictEqual(g[0].sagas[0].livres.map(b => b.titre), ["L'apprenti assassin", 'La nef du crépuscule']);
assert.strictEqual(g[1].sagas[0].nom, 'Aucune');

// insensible à la casse : un seul groupe
const g2 = grouperLivres([
  { titre: 'A', auteur: 'Tolkien', saga: 'X', tome: 1 },
  { titre: 'B', auteur: 'tolkien', saga: 'x', tome: 2 },
]);
assert.strictEqual(g2.length, 1, 'auteurs casse-insensible');
assert.strictEqual(g2[0].sagas.length, 1, 'sagas casse-insensible');

// saga vide -> "Aucune"
const g3 = grouperLivres([{ titre: 'Seul', auteur: 'X', saga: null, tome: null }]);
assert.strictEqual(g3[0].sagas[0].nom, 'Aucune');

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

console.log('OK : tests shelf-logic passent.');
