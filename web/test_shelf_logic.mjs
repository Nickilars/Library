import assert from 'node:assert';
import { grouperLivres, couleurTranche } from './shelf-logic.mjs';

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

console.log('OK : tests shelf-logic passent.');
