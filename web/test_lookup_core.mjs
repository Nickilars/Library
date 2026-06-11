import assert from 'node:assert';
import {
  nettoyerIsbn, isbnValide, extraireAnnee, normaliserOpenLibrary, parserUnimarc,
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

// normaliserOpenLibrary : extrait titre/auteur/année, saga/tome vides
const olJson = {
  'ISBN:9780553573404': {
    title: 'A Game of Thrones',
    authors: [{ name: 'George R. R. Martin' }],
    publish_date: 'August 1996',
  },
};
const ol = normaliserOpenLibrary(olJson, '9780553573404');
assert.strictEqual(ol.titre, 'A Game of Thrones');
assert.strictEqual(ol.auteur, 'George R. R. Martin');
assert.strictEqual(ol.annee, 1996);
assert.strictEqual(ol.saga, '');
assert.strictEqual(ol.tome, '');

// ISBN absent de la réponse -> null
assert.strictEqual(normaliserOpenLibrary({}, '9780553573404'), null);
// entrée sans titre -> null (on ne renvoie pas un livre sans titre)
assert.strictEqual(normaliserOpenLibrary({ 'ISBN:9780553573404': { authors: [] } }, '9780553573404'), null);

// parserUnimarc : notice avec saga (461) + tome
const xmlAvecSaga = `
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
 <srw:records><srw:record><srw:recordData>
  <mxc:record xmlns:mxc="info:lc/xmlns/marcxchange-v2">
   <mxc:datafield tag="200"><mxc:subfield code="a">L'Apprenti assassin</mxc:subfield></mxc:datafield>
   <mxc:datafield tag="700"><mxc:subfield code="a">Hobb</mxc:subfield><mxc:subfield code="b">Robin</mxc:subfield></mxc:datafield>
   <mxc:datafield tag="210"><mxc:subfield code="d">1998</mxc:subfield></mxc:datafield>
   <mxc:datafield tag="461"><mxc:subfield code="t">L'Assassin royal</mxc:subfield><mxc:subfield code="v">1</mxc:subfield></mxc:datafield>
  </mxc:record>
 </srw:recordData></srw:record></srw:records>
</srw:searchRetrieveResponse>`;
const u = parserUnimarc(xmlAvecSaga);
assert.strictEqual(u.titre, "L'Apprenti assassin");
assert.strictEqual(u.auteur, 'Robin Hobb');
assert.strictEqual(u.annee, 1998);
assert.strictEqual(u.saga, "L'Assassin royal");
assert.strictEqual(u.tome, '1');

// notice sans 461 -> saga/tome vides, repli année sur 214$d
const xmlSansSaga = `
<mxc:record xmlns:mxc="info:lc/xmlns/marcxchange-v2">
 <mxc:datafield tag="200"><mxc:subfield code="a">Le Hobbit</mxc:subfield></mxc:datafield>
 <mxc:datafield tag="700"><mxc:subfield code="a">Tolkien</mxc:subfield></mxc:datafield>
 <mxc:datafield tag="214"><mxc:subfield code="d">impr. 2012</mxc:subfield></mxc:datafield>
</mxc:record>`;
const u2 = parserUnimarc(xmlSansSaga);
assert.strictEqual(u2.titre, 'Le Hobbit');
assert.strictEqual(u2.auteur, 'Tolkien');
assert.strictEqual(u2.annee, 2012);
assert.strictEqual(u2.saga, '');
assert.strictEqual(u2.tome, '');

// décodage d'entités + repli saga sur 225$a
const xmlEntites = `
<mxc:record xmlns:mxc="info:lc/xmlns/marcxchange-v2">
 <mxc:datafield tag="200"><mxc:subfield code="a">Pierre &amp; Jean</mxc:subfield></mxc:datafield>
 <mxc:datafield tag="225"><mxc:subfield code="a">Classiques</mxc:subfield></mxc:datafield>
</mxc:record>`;
const u3 = parserUnimarc(xmlEntites);
assert.strictEqual(u3.titre, 'Pierre & Jean');
assert.strictEqual(u3.saga, 'Classiques');

// aucune notice (pas de 200$a) -> null
assert.strictEqual(parserUnimarc('<vide/>'), null);

console.log('OK : Task 3 (Unimarc) passe.');
