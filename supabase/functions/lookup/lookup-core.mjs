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

function decoderEntites(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

// Contenu brut du premier datafield au tag donné (préfixe de namespace optionnel).
function datafield(xml, tag) {
  const re = new RegExp(
    '<(?:\\w+:)?datafield\\b[^>]*\\btag="' + tag + '"[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?datafield>',
  );
  const m = xml.match(re);
  return m ? m[1] : null;
}

// Valeur du premier subfield au code donné dans un bloc datafield.
function subfield(bloc, code) {
  if (!bloc) return '';
  const re = new RegExp(
    '<(?:\\w+:)?subfield\\b[^>]*\\bcode="' + code + '"[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?subfield>',
  );
  const m = bloc.match(re);
  return m ? decoderEntites(m[1]).trim() : '';
}

// xml = réponse SRU Unimarc (texte). Renvoie {titre,auteur,annee,saga,tome} ou null.
export function parserUnimarc(xml) {
  if (!xml) return null;
  const titre = subfield(datafield(xml, '200'), 'a');
  if (!titre) return null;

  const champAuteur = datafield(xml, '700');
  const nom = subfield(champAuteur, 'a');
  const prenom = subfield(champAuteur, 'b');
  const auteur = `${prenom} ${nom}`.trim();

  const dateBloc = datafield(xml, '214') || datafield(xml, '210');
  const annee = extraireAnnee(subfield(dateBloc, 'd'));

  const lien = datafield(xml, '461');
  const saga = subfield(lien, 't') || subfield(datafield(xml, '225'), 'a');
  const tome = subfield(lien, 'v');

  return { titre, auteur, annee, saga, tome };
}
