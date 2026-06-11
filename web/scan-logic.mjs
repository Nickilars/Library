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
