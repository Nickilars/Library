# Sous-projet F1 — Couvertures fiables (proxy Edge multi-sources)

**Date :** 2026-06-11
**Statut :** Design validé (go utilisateur)
**Auteur :** Nicolas Rossel (avec Claude)

## Contexte

Les couvertures (livre 3D et repli 2D) sont chargées **exclusivement** depuis OpenLibrary
(`covers.openlibrary.org/b/isbn/<isbn>-L.jpg`). Or les éditions **françaises** de la
collection — trouvées via la BnF par la recherche C2 — y manquent souvent : OL renvoie 404
et l'app retombe sur la couverture générée. Cas réel : `9782290424476` (*Les Aventuriers
de la mer 2*, J'ai Lu) → OL 404, Google Books placeholders, **BnF 491 Ko** ✓, Amazon 189 Ko ✓.

Contrainte clé : le livre 3D (WebGL `TextureLoader`) exige des en-têtes **CORS**, que
seul OL fournit. La BnF exige en plus une requête SRU (sans CORS) pour obtenir l'« ark »
de la notice avant de construire l'URL de vignette. → Les bonnes sources sont
**inaccessibles depuis le navigateur** : il faut un proxy serveur.

## Objectif de F1

Une fonction Edge **`cover`** qui, pour un ISBN, essaie **OpenLibrary → BnF → Amazon**
côté serveur et renvoie les **octets de l'image** avec CORS + cache. Le client (2D et 3D)
remplace l'URL OL directe par l'URL de la fonction — un seul point de vérité, repli
« couverture générée » conservé.

```
<img> / TextureLoader ──GET──► functions/v1/cover?isbn=…
                                 1. OL covers (-L.jpg, default=false)        → si 404 :
                                 2. BnF : SRU → extraireArk → vignette ark   → si absent :
                                 3. Amazon : isbn13Vers10 → images P/<isbn10>.08.L.jpg
                               ◄── image/jpeg + Access-Control-Allow-Origin + Cache-Control
                               (aucune source → 404 → le client garde la couverture générée)
```

## Décisions d'architecture

- **Fonction publique** (`verify_jwt` désactivé) : `TextureLoader` et `<img>` ne peuvent
  pas joindre de jeton. Acceptable : la fonction ne sert que des images publiques de
  couvertures, valide strictement l'ISBN (13 chiffres) avant tout fetch (anti-SSRF,
  comme `lookup`), et n'accorde le CORS qu'aux origines connues.
- **Allowlist d'origines** (et non une origine unique) : `https://nickilars.github.io`
  **et** `http://127.0.0.1:8000` (page d'essai/dev locale). L'en-tête répond l'origine
  de la requête si elle est dans la liste.
- **Détection des placeholders** : Amazon renvoie 200 avec un GIF ~43 octets quand il n'a
  pas l'image ; BnF peut renvoyer une vignette vide → une image n'est retenue que si
  `Content-Type: image/*` **et** taille > 1 500 octets.
- **Cache agressif** : `Cache-Control: public, max-age=604800, immutable` — une
  couverture ne change pas ; le navigateur ne re-sollicite la fonction qu'une fois par
  semaine par livre.
- **Logique pure séparée et testée** (lignée `lookup-core`) : `cover-core.mjs` —
  `isbn13Vers10` (calcul de clé ISBN-10, `null` pour 979), `extraireArk` (regex sur le
  XML SRU), constructeurs d'URL. `nettoyerIsbn`/`isbnValide` y sont **dupliquées** (6
  lignes) pour garder le dossier de fonction **auto-contenu** (déploiement par
  copier-coller dans le Dashboard, comme `lookup`).
- **Timeout 5 s par fetch** (comme `lookup`) ; les sources sont essayées en séquence.

## Composants & fichiers

| Fichier | Changement |
|---|---|
| `supabase/functions/cover/cover-core.mjs` | **Nouveau.** Pur : `nettoyerIsbn`, `isbnValide`, `isbn13Vers10`, `extraireArk`, `urlOpenLibrary`, `urlBnfSru`, `urlBnfCouverture`, `urlAmazon`. |
| `supabase/functions/cover/index.ts` | **Nouveau.** `Deno.serve` GET : valide l'ISBN, chaîne OL → BnF → Amazon, renvoie l'image (CORS allowlist + cache) ou 404. |
| `web/test_cover_core.mjs` | **Nouveau.** Tests node de la logique pure. |
| `web/book3d.js` | `appliquerCouverture` : URL = `window.SUPABASE_URL + '/functions/v1/cover?isbn=…'`. |
| `web/shelf.js` | `couverture2D` : même URL. |
| `web/dev_book3d.html` | Inclut `config.js` (la page d'essai a besoin de `SUPABASE_URL`). |
| `web/sw.js` | Bump `biblio-v5`. |
| `.github/workflows/tests.yml` | Ajouter `node web/test_cover_core.mjs`. |

## Sécurité

- ISBN validé (13 chiffres) **avant** tout fetch — les URL amont ne sont construites
  qu'à partir de chiffres (anti-injection/SSRF), l'ark BnF par regex stricte
  `ark:/12148/cb[0-9a-z]+`.
- La fonction ne touche ni `books`, ni Auth, ni `service_role` — proxy d'images
  publiques uniquement.
- CORS limité à l'allowlist ; pas de jeton requis (fonction publique assumée).
- Client inchangé côté SEC-W1 (les images passent par `img.src`/`TextureLoader`,
  jamais par du HTML).

## Tests

- **Automatisé (node, CI)** : `isbn13Vers10` (`9782290424476`→`2290424471`,
  `9780553573404`→`0553573403`, clé `X`, 979→`null`, invalide→`null`) ; `extraireArk`
  (XML SRU réel → ark ; sans ark → `null`) ; constructeurs d'URL.
- **Manuel (après déploiement de `cover`)** :
  1. Livre français sans couverture OL (ex. `9782290424476`) → couverture **BnF** en 3D et 2D.
  2. Livre anglophone (ex. `9780553573404`) → couverture (OL) toujours OK.
  3. ISBN inconnu de tout le monde → couverture générée (repli intact).
  4. `dev_book3d.html?isbn=9782290424476` en local → couverture via la fonction (origine dev autorisée).
  5. Étagère complète : pas de régression de chargement.

## Déploiement (étape manuelle de l'utilisateur)

- Dashboard Supabase → Edge Functions → créer **`cover`**, coller `index.ts` +
  `cover-core.mjs`, **désactiver « Verify JWT »**, Deploy.
  (CLI : `supabase functions deploy cover --no-verify-jwt`.)

## Hors périmètre (F1)

- Stockage de l'URL de couverture en base (colonne dédiée) → non, résolution à l'affichage.
- Cache des couvertures dans le service worker (hors-ligne) → non (inchangé depuis B2).
- Google Books → écarté (placeholders fréquents, détection peu fiable).
- Téléversement manuel d'une couverture → non.

## Critères de succès

- Les livres français scannés affichent leur **vraie couverture** (3D et 2D).
- Aucune régression pour les couvertures OL existantes ni pour le repli généré.
- Logique pure verte en CI ; la fonction ne fait aucun fetch sur entrée invalide.
