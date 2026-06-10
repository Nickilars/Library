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
