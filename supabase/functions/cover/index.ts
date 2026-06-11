// Fonction Edge "cover" : ISBN -> image de couverture via OpenLibrary, puis BnF
// (SRU -> ark -> vignette), puis Amazon (ISBN-10). Côté serveur : pas de CORS amont,
// et on renvoie l'image AVEC CORS pour le client (TextureLoader WebGL + <img>).
// Fonction PUBLIQUE (Verify JWT désactivé) : TextureLoader ne peut pas joindre de jeton.
// Elle ne sert que des images publiques et ne fetch qu'à partir d'un ISBN validé.
import {
  nettoyerIsbn, isbnValide, isbn13Vers10, extraireArk,
  urlOpenLibrary, urlBnfSru, urlBnfCouverture, urlAmazon,
} from "./cover-core.mjs";

// Origines autorisées : site Pages + serveur local de dev (dev_book3d.html).
const ORIGINES = new Set(["https://nickilars.github.io", "http://127.0.0.1:8000"]);

const TIMEOUT_MS = 5000;
const TAILLE_MIN = 1500; // sous ce seuil : placeholder (GIF 1x1 Amazon, vignette vide BnF)

async function fetchAvecTimeout(url: string): Promise<Response | null> {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controleur.signal });
  } catch (_e) {
    return null; // timeout ou erreur réseau -> source suivante
  } finally {
    clearTimeout(minuteur);
  }
}

function corsPour(req: Request): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
  const origine = req.headers.get("origin") ?? "";
  if (ORIGINES.has(origine)) h["Access-Control-Allow-Origin"] = origine;
  return h;
}

function erreur(cors: Record<string, string>, corps: unknown, statut: number): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Récupère une image exploitable (Content-Type image/* et taille > seuil) ; sinon null.
async function imageDepuis(url: string): Promise<{ octets: ArrayBuffer; type: string } | null> {
  const res = await fetchAvecTimeout(url);
  if (!res || !res.ok) return null;
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return null;
  const octets = await res.arrayBuffer();
  if (octets.byteLength < TAILLE_MIN) return null;
  return { octets, type };
}

Deno.serve(async (req: Request) => {
  const cors = corsPour(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return erreur(cors, { erreur: "methode" }, 405);

  const isbn = nettoyerIsbn(new URL(req.url).searchParams.get("isbn"));
  if (!isbnValide(isbn)) return erreur(cors, { erreur: "isbn_invalide" }, 400);

  try {
    // OL et BnF en PARALLÈLE (les éditions françaises manquent souvent chez OL :
    // attendre son 404 avant d'interroger la BnF doublait la latence). OL prioritaire.
    const chercherBnf = async () => {
      const sru = await fetchAvecTimeout(urlBnfSru(isbn));
      const ark = sru && sru.ok ? extraireArk(await sru.text()) : null;
      return ark ? await imageDepuis(urlBnfCouverture(ark)) : null;
    };
    const [ol, bnf] = await Promise.all([imageDepuis(urlOpenLibrary(isbn)), chercherBnf()]);
    let image = ol || bnf;

    // Amazon par ISBN-10 (978 uniquement) en dernier recours
    if (!image) {
      const isbn10 = isbn13Vers10(isbn);
      if (isbn10) image = await imageDepuis(urlAmazon(isbn10));
    }

    if (!image) return erreur(cors, { trouve: false }, 404);
    return new Response(image.octets, {
      headers: {
        ...cors,
        "Content-Type": image.type,
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch (_e) {
    return erreur(cors, { erreur: "erreur_serveur" }, 500);
  }
});
