import assert from 'node:assert';
import {
  nettoyerIsbn, isbnValide, extraireAnnee,
} from '../supabase/functions/lookup/lookup-core.mjs';

// nettoyerIsbn : retire espaces et tirets
assert.strictEqual(nettoyerIsbn('978-2-290-42455-1'), '9782290424551');
assert.strictEqual(nettoyerIsbn('  9782290424551 '), '9782290424551');

// isbnValide : 13 chiffres exactement
assert.strictEqual(isbnValide('9782290424551'), true);
assert.strictEqual(isbnValide('2290424551'), false, '10 chiffres rejeté');
assert.strictEqual(isbnValide('97822904245xx'), false, 'lettres rejetées');
assert.strictEqual(isbnValide(''), false, 'vide rejeté');

// extraireAnnee : premier nombre à 4 chiffres, sinon null
assert.strictEqual(extraireAnnee('August 1996'), 1996);
assert.strictEqual(extraireAnnee('impr. 2014'), 2014);
assert.strictEqual(extraireAnnee('1998-2000'), 1998, 'premier des deux');
assert.strictEqual(extraireAnnee(''), null);
assert.strictEqual(extraireAnnee(null), null);
assert.strictEqual(extraireAnnee('sans date'), null);

console.log('OK : Task 1 (isbn + année) passe.');
