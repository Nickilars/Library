import assert from 'node:assert';
import { estIsbnScanne, antiRebond, livreDepuisScan } from './scan-logic.mjs';

// estIsbnScanne : EAN-13 préfixé 978/979 uniquement
assert.strictEqual(estIsbnScanne('9782290424551'), true, '978 accepté');
assert.strictEqual(estIsbnScanne('9791028110109'), true, '979 accepté');
assert.strictEqual(estIsbnScanne('9772290424556'), false, '977 (presse) rejeté');
assert.strictEqual(estIsbnScanne('3017620422003'), false, 'EAN produit rejeté');
assert.strictEqual(estIsbnScanne('97822904'), false, 'EAN-8 rejeté');
assert.strictEqual(estIsbnScanne('https://exemple.fr'), false, 'QR texte rejeté');
assert.strictEqual(estIsbnScanne(''), false, 'vide rejeté');
assert.strictEqual(estIsbnScanne(null), false, 'null rejeté');

// antiRebond : fenêtre glissante de 3 s par défaut
const A = '9782290424551', B = '9791028110109';
let r = antiRebond(A, null, 1000);
assert.strictEqual(r.accepte, true, 'premier scan accepté');
r = antiRebond(A, r.etat, 1200);
assert.strictEqual(r.accepte, false, 'même code immédiat ignoré');
r = antiRebond(A, r.etat, 3500);
assert.strictEqual(r.accepte, false, 'fenêtre glissante : rafraîchie à 1200, 3500-1200 < 3000');
r = antiRebond(B, r.etat, 3600);
assert.strictEqual(r.accepte, true, 'autre code accepté');
r = antiRebond(A, r.etat, 9999);
assert.strictEqual(r.accepte, true, 'même code après expiration accepté');

// livreDepuisScan : payload d'insertion directe avec défauts « pile de livres possédés »
const payload = livreDepuisScan(
  { titre: " L'Apprenti assassin ", auteur: 'Robin Hobb', annee: 1998, saga: "L'Assassin royal", tome: '1' },
  '9782290424551'
);
assert.strictEqual(payload.titre, "L'Apprenti assassin", 'titre trimé');
assert.strictEqual(payload.auteur, 'Robin Hobb');
assert.strictEqual(payload.annee_publication, '1998', 'année en chaîne (format formulaire)');
assert.strictEqual(payload.isbn, '9782290424551');
assert.strictEqual(payload.saga, "L'Assassin royal");
assert.strictEqual(payload.tome, '1');
assert.strictEqual(payload.statut_lecture, 'non_lu', 'défaut : à lire');
assert.strictEqual(payload.possede, true, 'défaut : possédé');
assert.strictEqual(payload.wishlist, false);
assert.strictEqual(payload.note, '', 'note vide (normalisée par validerLivre)');
assert.strictEqual(payload.commentaire, '');

// champs lookup absents → vides (jamais undefined)
const vide = livreDepuisScan({ titre: 'X', auteur: 'Y' }, '9791028110109');
assert.strictEqual(vide.annee_publication, '');
assert.strictEqual(vide.saga, '');
assert.strictEqual(vide.tome, '');

console.log('OK : Tasks 1-2 (scan-logic) passent.');
