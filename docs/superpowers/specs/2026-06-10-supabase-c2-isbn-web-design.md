# Sous-projet C2 — Remplissage par ISBN (OpenLibrary + BnF via proxy Edge)

**Date :** 2026-06-10
**Statut :** Design validé, prêt pour planification
**Auteur :** Nicolas Rossel (avec Claude)

## Contexte

Le frontend statique sur Supabase est en ligne (B1), installable/hors-ligne (B2), et permet
l'écriture (C1 : modale d'ajout/modif/suppression, `validerLivre`, dédup, RLS). C2 ajoute le
**pré-remplissage du formulaire d'ajout à partir d'un ISBN** : on saisit l'ISBN, on clique
« 🔍 Rechercher », et titre/auteur/année/saga/tome se remplissent automatiquement.

### Rappel de la décomposition (re-plateformage Supabase)

- A — Socle Supabase + migration. ✅
- B1 — Frontend statique privé (lecture). ✅
- B2 — PWA hors-ligne + installable. ✅
- C1 — Écriture web (CRUD manuel). ✅
- **C2 — Remplissage par ISBN (OpenLibrary/BnF).** *(ce document)*
- D — Scan mobile (caméra).

## Objectif de C2

Dans la modale d'ajout, retrouver les métadonnées d'un livre par ISBN pour éviter la saisie
manuelle. Couverture des champs : **titre, auteur, année, saga, tome** (miroir de la logique
Python de la Phase 1). L'utilisateur reste libre d'ajuster avant d'enregistrer ; la validation
et la dédup de C1 s'appliquent ensuite normalement.

## Décision d'architecture (issue du brainstorming)

**Proxy Edge Supabase** plutôt que recherche directe dans le navigateur.

- **OpenLibrary** envoie des en-têtes CORS → appelable depuis le navigateur, mais sa couverture
  des éditions françaises est lacunaire.
- **La BnF (SRU Unimarc)** ne renvoie pas de CORS → **inappelable directement** depuis un
  navigateur. C'est précisément la source qui couvre les éditions françaises (collection de
  l'utilisateur).
- → Une **fonction Edge Supabase** (Deno) interroge OpenLibrary puis, en repli, la BnF **côté
  serveur** (pas de CORS, pas de limites navigateur), parse/normalise, et renvoie un JSON avec
  en-têtes CORS. La logique OL+BnF est ainsi **centralisée** (réutilisable par le scan D).

```
Modale d'ajout (web)  ──ISBN──►  Fonction Edge "lookup" (Deno)  ──►  OpenLibrary, puis BnF (SRU)
       ▲                              parse + normalise, renvoie                       │
       └──── { trouve, livre:{titre,auteur,annee,saga,tome} } ◄── JSON + CORS ◄────────┘
```

## Composants & fichiers

| Fichier | Changement |
|---|---|
| `supabase/functions/lookup/index.ts` | **Nouveau.** Fonction Edge Deno : reçoit un ISBN, interroge OL puis BnF, parse/normalise, renvoie JSON + CORS. Gère `OPTIONS` (préflight). |
| `supabase/functions/lookup/lookup-core.ts` | **Nouveau.** Logique **pure** (sans I/O) : `normaliserOpenLibrary`, `parserUnimarc`, `extraireAnnee`, `isbnValide`. Importée par `index.ts`. Testable. |
| `web/isbn.js` | **Nouveau.** Côté client : `rechercherIsbn(isbn)` appelle `supabase.functions.invoke('lookup', …)` ; remplit les champs du formulaire ; gère statut/erreurs. Classic script (comme `shelf.js`). |
| `web/index.html` | Bouton « 🔍 Rechercher » + zone de statut à côté du champ `#f-isbn` dans la modale ; inclusion de `isbn.js`. |
| `web/shelf.css` | Style du bouton de recherche et du message de statut. |
| `web/test_lookup_core.mjs` | **Nouveau.** Test node sur un jumeau `.mjs` des fonctions pures (ou `deno test` si Deno dispo). Mêmes cas que la Phase 1. |

> Note : `lookup-core.ts` reste **pur** (entrées = chaînes/JSON/XML déjà récupérés, sorties =
> objet normalisé). Les `fetch` OL/BnF vivent dans `index.ts`. Cette séparation permet de tester
> la normalisation sans réseau ni déploiement.

## Logique de recherche (miroir de la Phase 1)

1. **Validation entrée** : ISBN nettoyé (tirets/espaces retirés) ; doit faire **13 chiffres**.
   Sinon → erreur de format, **aucun fetch** (anti-injection URL / anti-SSRF).
2. **OpenLibrary** : `GET https://openlibrary.org/api/books?bibkeys=ISBN:<isbn>&format=json&jscmd=data`.
   Si trouvé → `titre` = `title`, `auteur` = `authors[0].name`, `annee` = `extraireAnnee(publish_date)`.
   OL ne donne pas saga/tome de façon fiable → laissés vides à cette étape.
3. **BnF (repli)** : si OL ne trouve pas (ou champs essentiels manquants), requête SRU
   `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=bib.isbn all "<isbn>"&recordSchema=unimarcxchange`.
   Parse Unimarc : `200$a` (titre), `700$a`+`700$b` (auteur), `214$d`/`210$d` (année → `extraireAnnee`),
   `461$t` (saga) + `461$v` (tome), repli saga `225$a`.
4. **Résultat** : `{ trouve: true, livre: { titre, auteur, annee, saga, tome } }` ou
   `{ trouve: false }`. Champs absents → vides (le client ne les écrase pas avec du vide).

## Flux client (modale)

1. L'utilisateur saisit l'ISBN, clique **« 🔍 Rechercher »**.
2. Garde-fou : si `!navigator.onLine` → « nécessite une connexion », pas d'appel.
3. Statut « Recherche… » ; `supabase.functions.invoke('lookup', { body: { isbn } })`.
4. **Trouvé** → remplit `#f-titre`, `#f-auteur`, `#f-annee`, `#f-saga`, `#f-tome` via `.value`
   (uniquement les champs non vides renvoyés) ; statut « Trouvé ✓ ». L'utilisateur ajuste si besoin.
5. **Introuvable** → statut « Introuvable — saisis à la main ». Aucun champ modifié.
6. **Erreur réseau/fonction** → statut d'erreur clair ; aucun champ modifié.
7. L'enregistrement passe ensuite par `validerLivre` + dédup de C1 (inchangés).

## Sécurité

- **Aucune donnée privée** : la fonction ne lit pas `books`, n'utilise pas `service_role`, ne
  touche pas la DB — elle ne relaie que des recherches bibliographiques publiques.
- **Appel authentifié** : `functions.invoke` joint le jeton de la session → seul l'utilisateur
  connecté peut appeler la fonction (limite l'abus). `verify_jwt` activé.
- **Validation d'entrée stricte** : ISBN = 13 chiffres avant tout `fetch` (anti-injection dans
  les URL OL/BnF, anti-SSRF — on ne fetch que des URL OL/BnF construites à partir de chiffres).
- **CORS restreint** : `Access-Control-Allow-Origin` limité à l'origine du site Pages (pas `*`).
- **SEC-W1 maintenu** : résultat écrit dans les champs via `.value` ; jamais `innerHTML` avec
  des données distantes.
- **Écriture en ligne uniquement** (inchangé) : la recherche est elle aussi en ligne.

## Tests

- **Automatisé** : `web/test_lookup_core.mjs` (node) couvre la **logique pure** :
  - `isbnValide` : 13 chiffres OK ; 10 chiffres / lettres / vide rejetés ;
  - `extraireAnnee` : « 2014 », « impr. 2014 », « 1998-2000 » → année ; vide → null ;
  - `normaliserOpenLibrary` : extrait titre/auteur/année d'un JSON OL d'exemple ;
  - `parserUnimarc` : extrait titre/auteur/année/saga/tome d'une notice Unimarc d'exemple ;
    notice sans `461` → saga/tome vides.
  (Si Deno est installé : `deno test` sur `lookup-core.ts` directement.)
- **Manuel (après déploiement de la fonction)** :
  1. ISBN français connu (ex. édition Robin Hobb) → « 🔍 Rechercher » → champs remplis (BnF).
  2. ISBN anglophone connu → champs remplis (OpenLibrary).
  3. ISBN inconnu → « Introuvable », aucun champ modifié.
  4. ISBN à 10 chiffres / « abc » → message de format, aucun appel.
  5. Hors-ligne (Network → Offline) → « nécessite une connexion ».
  6. Après remplissage : ajuster, Enregistrer → le livre apparaît (dédup/validation C1 OK).

## Déploiement (étape manuelle de l'utilisateur)

- Livrable : `supabase/functions/lookup/` dans le dépôt.
- Déploiement au choix :
  - **Dashboard Supabase** → *Edge Functions* → créer `lookup`, coller le code, *Deploy* ;
  - ou **CLI** `supabase functions deploy lookup`.
- Aucune variable secrète à configurer (OL et BnF sont des API publiques).

## Hors périmètre (C2)

- Scan code-barres caméra → sous-projet **D** (réutilisera `rechercherIsbn`).
- Recherche par titre/auteur (sans ISBN) → non.
- Mise en cache hors-ligne des résultats de recherche → non (recherche en ligne uniquement).
- Remplissage des champs statut/note/possede/wishlist/commentaire → non (choix de l'utilisateur).

## Critères de succès

- Depuis la modale d'ajout, un ISBN valide remplit titre/auteur/année (+ saga/tome si la BnF
  les fournit), via la fonction Edge — sans erreur CORS.
- OpenLibrary couvre l'anglophone ; la BnF couvre le français (repli).
- Messages clairs : trouvé / introuvable / format invalide / hors-ligne / erreur.
- Logique pure couverte par les tests ; checklist manuelle validée.
- Lecture (B1), hors-ligne (B2) et écriture (C1) restent fonctionnels ; RLS et SEC-W1 respectés.
