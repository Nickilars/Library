// Logique pure (sans réseau) pour la résolution de couverture — partagée Deno + tests node.
// nettoyerIsbn/isbnValide sont dupliquées depuis lookup-core pour garder ce dossier de
// fonction auto-contenu (déploiement par copier-coller dans le Dashboard).

export function nettoyerIsbn(brut) {
  return String(brut ?? '').replace(/[\s-]/g, '');
}

export function isbnValide(isbn) {
  return /^\d{13}$/.test(String(isbn ?? ''));
}

// ISBN-13 (préfixe 978 uniquement) -> ISBN-10 avec recalcul de la clé ; sinon null.
// Les 979-* n'ont pas d'équivalent ISBN-10.
export function isbn13Vers10(isbn13) {
  const s = String(isbn13 ?? '');
  if (!/^978\d{10}$/.test(s)) return null;
  const corps = s.slice(3, 12);
  let somme = 0;
  for (let i = 0; i < 9; i++) somme += Number(corps[i]) * (10 - i);
  const cle = (11 - (somme % 11)) % 11;
  return corps + (cle === 10 ? 'X' : String(cle));
}

// Identifiant ark de la première notice d'une réponse SRU BnF ; sinon null.
export function extraireArk(xml) {
  const m = String(xml ?? '').match(/ark:\/12148\/cb[0-9a-z]+/i);
  return m ? m[0] : null;
}

// ---- Constructeurs d'URL des sources (entrées déjà validées : chiffres / ark regex) ----
export function urlOpenLibrary(isbn) {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
}
export function urlBnfSru(isbn) {
  return 'https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query='
    + encodeURIComponent(`bib.isbn all "${isbn}"`)
    + '&recordSchema=unimarcxchange&maximumRecords=1';
}
export function urlBnfCouverture(ark) {
  return `https://catalogue.bnf.fr/couverture?appName=NE&idArk=${ark}&couverture=1`;
}
export function urlAmazon(isbn10) {
  return `https://images-na.ssl-images-amazon.com/images/P/${isbn10}.08.L.jpg`;
}
