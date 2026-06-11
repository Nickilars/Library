import assert from 'node:assert';
import {
  nettoyerIsbn, isbnValide, isbn13Vers10, extraireArk,
  urlOpenLibrary, urlBnfSru, urlBnfCouverture, urlAmazon,
} from '../supabase/functions/cover/cover-core.mjs';

// nettoyerIsbn / isbnValide (dupliquées de lookup-core, mêmes contrats)
assert.strictEqual(nettoyerIsbn('978-2-290-42447-6'), '9782290424476');
assert.strictEqual(isbnValide('9782290424476'), true);
assert.strictEqual(isbnValide('abc'), false);

// isbn13Vers10 : recalcul de clé (cas réels vérifiés)
assert.strictEqual(isbn13Vers10('9782290424476'), '2290424471', 'clé 1 (Aventuriers de la mer 2)');
assert.strictEqual(isbn13Vers10('9780553573404'), '0553573403', 'clé 3 (A Game of Thrones)');
assert.strictEqual(isbn13Vers10('9781558608320'), '155860832X', 'clé X');
assert.strictEqual(isbn13Vers10('9791028110109'), null, '979 sans équivalent ISBN-10');
assert.strictEqual(isbn13Vers10('12345'), null, 'invalide rejeté');
assert.strictEqual(isbn13Vers10(null), null, 'null rejeté');

// extraireArk : premier ark de la réponse SRU, sinon null
const xmlSru = `
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
 <srw:records><srw:record>
  <srw:recordIdentifier>ark:/12148/cb477033602</srw:recordIdentifier>
 </srw:record></srw:records>
</srw:searchRetrieveResponse>`;
assert.strictEqual(extraireArk(xmlSru), 'ark:/12148/cb477033602');
assert.strictEqual(extraireArk('<vide/>'), null);
assert.strictEqual(extraireArk(null), null);

// Constructeurs d'URL
assert.strictEqual(
  urlOpenLibrary('9782290424476'),
  'https://covers.openlibrary.org/b/isbn/9782290424476-L.jpg?default=false'
);
assert.ok(urlBnfSru('9782290424476').includes(encodeURIComponent('bib.isbn all "9782290424476"')), 'requête SRU encodée');
assert.strictEqual(
  urlBnfCouverture('ark:/12148/cb477033602'),
  'https://catalogue.bnf.fr/couverture?appName=NE&idArk=ark:/12148/cb477033602&couverture=1'
);
assert.strictEqual(
  urlAmazon('2290424471'),
  'https://images-na.ssl-images-amazon.com/images/P/2290424471.08.L.jpg'
);

console.log('OK : tests cover-core passent.');
