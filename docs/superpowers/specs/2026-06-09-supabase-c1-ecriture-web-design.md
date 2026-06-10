# Sous-projet C1 — Écriture web (CRUD manuel)

**Date :** 2026-06-09
**Statut :** Design validé, prêt pour planification
**Auteur :** Nicolas Rossel (avec Claude)

## Contexte

Le frontend statique sur Supabase est en ligne (B1) et installable/hors-ligne (B2), en
**lecture seule**. C1 ajoute l'**écriture depuis le web** : ajouter / modifier / supprimer
un livre, depuis n'importe quel appareil connecté. La base Supabase autorise déjà les
écritures du propriétaire (politiques RLS insert/update/delete posées au sous-projet A).

### Rappel de la décomposition (re-plateformage Supabase)

- A — Socle Supabase + migration. ✅
- B1 — Frontend statique privé (lecture). ✅
- B2 — PWA hors-ligne + installable. ✅
- **C1 — Écriture web (CRUD manuel).** *(ce document)*
- C2 — Remplissage par ISBN (recherche OpenLibrary/BnF en JS).
- D — Scan mobile.

## Objectif de C1

Gérer entièrement la collection depuis le web : un bouton **« ➕ Ajouter »** et le bouton
**✏️** (aujourd'hui inerte) ouvrent une **modale** de formulaire ; on peut **enregistrer**
(ajout/modif) et **supprimer** (avec confirmation). Validation côté client + détection de
doublon. Écriture **en ligne uniquement**. Aucun changement de schéma Supabase.

## Décisions (issues du brainstorming)

- **Modale** : ajout via « ➕ Ajouter » (en-tête), édition via ✏️ (détail), suppression
  depuis la modale (confirmation). On reste sur l'étagère, la modale apparaît par-dessus.
- **Validation** : `validerLivre` **pure** dans `shelf-logic.mjs` (testable node).
- **Doublons** : détection **côté client** sur la liste déjà chargée (pas de requête en
  plus) ; à l'ajout, même ISBN (si renseigné) sinon même titre+auteur (insensible à la
  casse) → **avertir et bloquer**. Pas de contrôle en modification (contre soi-même).
- **Écriture en ligne uniquement** (cohérent avec B2 : hors-ligne = lecture seule).
- **`validerLivre` pur / I/O dans `app.js`** : séparation logique testable / effets.

## Champs du formulaire

titre\*, auteur\*, annee_publication, isbn, saga, tome, statut_lecture
(à lire / en cours / lu), possede (case), wishlist (case), note (0–5), commentaire.
(\* obligatoire.) Les valeurs par défaut correspondent au modèle : saga « Aucune »,
statut « non_lu », possede/wishlist false, note/tome vides.

## Architecture & fichiers

| Fichier | Changement |
|---|---|
| `web/shelf-logic.mjs` | Ajout `validerLivre(livre)` (pure, exportée) |
| `web/test_shelf_logic.mjs` | Cas de test pour `validerLivre` |
| `web/index.html` | Bouton « ➕ Ajouter » dans `#controles` + modale `#modale-edition` (formulaire + Enregistrer / Supprimer / Annuler) |
| `web/app.js` | Ouvre/remplit la modale, valide, détecte les doublons, `insert`/`update`/`delete` Supabase, recharge ; expose `window.ouvrirEdition(id)` ; garde-fou hors-ligne |
| `web/shelf.js` | Réactive le ✏️ → `window.ouvrirEdition(d.id)` |
| `web/shelf.css` | Style de la modale |

`app.js` orchestre déjà le client Supabase, le rendu et le rechargement (`chargerLivres`) ;
la logique CRUD/modale y vit. `validerLivre` reste pure dans `shelf-logic.mjs`.

## Flux

1. **Ajouter** : clic « ➕ Ajouter » → modale vide. **Modifier** : ✏️ du détail →
   `window.ouvrirEdition(id)` → modale pré-remplie depuis les `data-*` du livre (ou un
   objet retrouvé par id dans la liste chargée).
2. **Enregistrer** : `validerLivre` → si invalide, message dans la modale. Si valide :
   - **Ajout** : détection de doublon (client) → si doublon, avertir + ne pas insérer.
     Sinon `insert` avec `user_id` = `session.user.id`.
   - **Modif** : `update` par `id`.
3. **Supprimer** (mode édition) : confirmation → `delete` par `id`.
4. Après toute écriture réussie : fermer la modale, **recharger** (`chargerLivres` →
   étagère + cache `localStorage` à jour).
5. **Hors-ligne** : si `!navigator.onLine`, les actions affichent « nécessite une
   connexion » et n'écrivent pas.

## `validerLivre` (règles, miroir de la Phase 1)

Reçoit un objet livre (depuis le formulaire), retourne `{ ok: true, livre }` (normalisé,
champs texte `trim`és, saga vide → « Aucune ») ou `{ ok: false, erreur }` :
- titre et auteur requis (non vides après `trim`) ;
- `statut_lecture` ∈ {non_lu, en_cours, lu} ;
- `note` vide ou entier 0–5 ;
- `isbn` vide ou exactement 13 chiffres ;
- `tome` vide ou entier ≥ 0 ;
- longueurs max (ex. 500) sur titre/auteur/saga/commentaire.

## Sécurité

- **RLS = garantie d'écriture** : `insert` accepté seulement si `user_id` = `auth.uid()`
  (with check) ; `update`/`delete` seulement sur les lignes du propriétaire. Une tentative
  de tricher côté client est refusée par la base.
- **Contraintes `CHECK` de la base** (statut, note 0–5) : filet **serveur** en plus de
  `validerLivre` (défense en profondeur).
- **SEC-W1** : valeurs du formulaire lues/écrites via `.value` ; réaffichage via
  `textContent`/`setAttribute` (jamais `innerHTML` avec des données).
- **Écriture en ligne uniquement** ; `user_id` fixé depuis la session.
- Clé `anon` publique (inchangé) ; pas de `service_role` côté client.

## Tests

- **Automatisé** : `node web/test_shelf_logic.mjs` couvre `validerLivre` — titre/auteur
  requis, note hors bornes rejetée, statut invalide rejeté, ISBN non-13-chiffres rejeté,
  tome négatif rejeté, cas valide normalisé (espaces retirés, saga vide → « Aucune »).
- **Manuel (avec tes identifiants Supabase)** :
  1. « ➕ Ajouter » → remplir → Enregistrer → le livre **apparaît** sur l'étagère.
  2. ✏️ d'un livre → modifier (ex. statut, note) → Enregistrer → **persiste** (recharger
     la page confirme).
  3. Supprimer (confirmation) → le livre **disparaît**.
  4. Ajouter un **doublon** (même ISBN, ou même titre+auteur) → **bloqué** + message.
  5. Champ invalide (titre vide, note 9, ISBN « abc ») → **message d'erreur**, pas d'écriture.
  6. **Hors-ligne** (Network → Offline) → les actions d'écriture affichent « nécessite une
     connexion ».

## Hors périmètre (C1)

- Recherche/auto-remplissage par ISBN (OpenLibrary/BnF) → sous-projet **C2**.
- Scan code-barres → sous-projet **D**.
- Écriture hors-ligne / file de synchro → non (écriture en ligne uniquement).

## Critères de succès

- Ajout / modification / suppression fonctionnels depuis le web (modale), persistés dans
  Supabase, l'étagère et le cache se mettant à jour.
- Validation et détection de doublon opérationnelles ; messages clairs.
- Écriture bloquée hors-ligne.
- `validerLivre` vérifiée par le test node ; checklist manuelle validée.
- La lecture (B1) et l'hors-ligne (B2) restent fonctionnels ; RLS respectée.
