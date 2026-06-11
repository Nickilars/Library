-- G3 : couleur dominante de la couverture, calculée côté client (couleurDominante)
-- puis stockée pour que l'étagère soit fidèle aux couvertures sans re-télécharger
-- les images à chaque chargement. NULL = pas encore calculée (file en arrière-plan).
--
-- À exécuter dans le SQL Editor du dashboard Supabase (ou `supabase db push`).

alter table public.books add column if not exists couleur_couverture text;
