// Logique pure du scan code-barres (sans DOM ni caméra). Testable avec node.

// Un code scanné est un ISBN si : 13 chiffres, préfixe GS1 « livre » 978/979.
export function estIsbnScanne(code) {
  return /^97[89]\d{10}$/.test(String(code ?? '').trim());
}

// Anti-rebond à fenêtre glissante : un même code tenu devant la caméra rafraîchit son
// horodatage à chaque détection, donc n'est jamais retraité tant qu'il reste visible.
// etat = { dernier, depuis } ou null. Renvoie { accepte, etat }.
export function antiRebond(isbn, etat, maintenant, delaiMs = 3000) {
  const memeRecent = etat && etat.dernier === isbn && (maintenant - etat.depuis) < delaiMs;
  return { accepte: !memeRecent, etat: { dernier: isbn, depuis: maintenant } };
}

// Payload d'insertion D2 (format formulaire, normalisé ensuite par validerLivre).
// Défauts « pile de livres physiques qu'on possède » : à lire, possédé, pas wishlist.
export function livreDepuisScan(livreLookup, isbn) {
  const l = livreLookup || {};
  return {
    titre: String(l.titre ?? '').trim(),
    auteur: String(l.auteur ?? '').trim(),
    annee_publication: l.annee != null && l.annee !== '' ? String(l.annee) : '',
    isbn,
    saga: String(l.saga ?? '').trim(),
    tome: l.tome != null ? String(l.tome) : '',
    statut_lecture: 'non_lu',
    possede: true,
    wishlist: false,
    note: '',
    commentaire: '',
  };
}
