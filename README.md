# 📚 Ma bibliothèque — frontend statique (Supabase)

Application web de consultation de ma bibliothèque personnelle : étagère 3D (livres en
tranches groupés par auteur puis saga, livre 3D au clic), **privée** (login), servie en
**site statique** et adossée à **Supabase** (Postgres + Auth + RLS).

## Lancer en local
Renseigne `web/config.js` (URL + clé anon de ton projet Supabase), puis :
```bash
python -m http.server 8000 --directory web
```
Ouvre http://127.0.0.1:8000.

## Déploiement (GitHub Pages)
Le workflow `.github/workflows/deploy-pages.yml` publie `web/` à chaque push sur `main`.
Étape unique côté GitHub : **Settings → Pages → Source = GitHub Actions**.

## Données & sécurité
- Données dans Supabase ; chaque ligne porte un `user_id`, la **RLS** restreint la lecture
  au propriétaire connecté.
- La clé `anon` du frontend est **publique par conception** (la RLS protège). La clé
  `service_role` ne doit jamais être exposée.
- Pense à désactiver les inscriptions publiques (Authentication) pour cette app mono-utilisateur.

## Tests
- Fonctions pures : `node web/test_shelf_logic.mjs`.
- Le reste se vérifie manuellement dans le navigateur (login → étagère → livre 3D).
