// Fonction Edge "lookup" : ISBN -> OpenLibrary puis BnF (côté serveur, pas de CORS navigateur).
import {
  nettoyerIsbn, isbnValide, normaliserOpenLibrary, parserUnimarc,
} from "./lookup-core.mjs";

const ORIGINE = "https://nrossaa.github.io"; // origine du site GitHub Pages (sans /Library/)

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ORIGINE,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

function reponse(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function chercherOpenLibrary(isbn: string) {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  return normaliserOpenLibrary(await res.json(), isbn);
}

async function chercherBnf(isbn: string) {
  const query = `bib.isbn all "${isbn}"`;
  const url = "https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve"
    + `&query=${encodeURIComponent(query)}&recordSchema=unimarcxchange&maximumRecords=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return parserUnimarc(await res.text());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reponse({ trouve: false, erreur: "methode" }, 405);

  try {
    const corps = await req.json().catch(() => ({}));
    const isbn = nettoyerIsbn(corps.isbn);
    if (!isbnValide(isbn)) return reponse({ trouve: false, erreur: "isbn_invalide" }, 400);

    let livre = await chercherOpenLibrary(isbn);
    if (!livre || !livre.titre) {
      const bnf = await chercherBnf(isbn);
      if (bnf && bnf.titre) livre = bnf;
    }
    if (!livre || !livre.titre) return reponse({ trouve: false });
    return reponse({ trouve: true, livre });
  } catch (_e) {
    return reponse({ trouve: false, erreur: "erreur_serveur" }, 500);
  }
});
