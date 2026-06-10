// Logique pure (sans réseau) pour la recherche par ISBN — partagée Deno + tests node.

export function nettoyerIsbn(brut) {
  return String(brut ?? '').replace(/[\s-]/g, '');
}

export function isbnValide(isbn) {
  return /^\d{13}$/.test(String(isbn ?? ''));
}

// Premier nombre à 4 chiffres trouvé dans la chaîne, en Number ; sinon null.
export function extraireAnnee(texte) {
  if (!texte) return null;
  const m = String(texte).match(/\d{4}/);
  return m ? Number(m[0]) : null;
}

// data = JSON OpenLibrary (jscmd=data). Renvoie {titre,auteur,annee,saga,tome} ou null.
export function normaliserOpenLibrary(data, isbn) {
  const entree = data && data['ISBN:' + isbn];
  if (!entree || !entree.title) return null;
  const auteur = (entree.authors && entree.authors[0] && entree.authors[0].name) || '';
  return {
    titre: entree.title,
    auteur,
    annee: extraireAnnee(entree.publish_date),
    saga: '',
    tome: '',
  };
}
