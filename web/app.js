// Frontend Supabase : authentification, récupération des livres (RLS), rendu de l'étagère.
// B2 : cache des livres en localStorage (lecture hors-ligne) + enregistrement du service worker.
import { grouperLivres, couleurTranche } from './shelf-logic.mjs';

const client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const elLogin = document.getElementById('login');
const elEtagere = document.getElementById('etagere');
const elControles = document.getElementById('controles');
const elErreur = document.getElementById('login-erreur');
const elBandeau = document.getElementById('bandeau-hors-ligne');

const CLE_LIVRES = 'biblio:livres';
const CLE_DATE = 'biblio:livres:date';

function montrerLogin() {
  elLogin.hidden = false; elEtagere.hidden = true; elControles.hidden = true;
}
async function montrerApp() {
  elLogin.hidden = true; elEtagere.hidden = false; elControles.hidden = false;
  await chargerLivres();
}

function afficherBandeau(dateISO) {
  let txt = '📴 Hors-ligne';
  if (dateISO) txt += ' — données du ' + new Date(dateISO).toLocaleDateString('fr-FR');
  elBandeau.textContent = txt; elBandeau.hidden = false;
}
function masquerBandeau() { elBandeau.hidden = true; }

async function chargerLivres() {
  const { data, error } = await client.from('books').select('*');
  if (!error && data) {
    try {
      localStorage.setItem(CLE_LIVRES, JSON.stringify(data));
      localStorage.setItem(CLE_DATE, new Date().toISOString());
    } catch (e) { /* quota dépassé : on ignore le cache */ }
    masquerBandeau();
    construireEtagere(data);
    return;
  }
  // Échec (typiquement hors-ligne) : repli sur le cache local.
  const cache = localStorage.getItem(CLE_LIVRES);
  if (cache) {
    afficherBandeau(localStorage.getItem(CLE_DATE));
    construireEtagere(JSON.parse(cache));
  } else {
    elEtagere.replaceChildren();
    const p = document.createElement('p'); p.className = 'vide';
    p.textContent = 'Hors-ligne et aucune donnée en cache. Connecte-toi une fois en ligne.';
    elEtagere.appendChild(p);
  }
}

function construireEtagere(livres) {
  elEtagere.replaceChildren();
  const groupes = grouperLivres(livres);
  if (!groupes.length) {
    const p = document.createElement('p'); p.className = 'vide'; p.textContent = 'Votre collection est vide.';
    elEtagere.appendChild(p); return;
  }
  for (const g of groupes) {
    const section = document.createElement('section'); section.className = 'auteur';
    const h2 = document.createElement('h2'); h2.className = 'auteur-nom'; h2.textContent = g.auteur;
    section.appendChild(h2);
    for (const s of g.sagas) {
      const divS = document.createElement('div'); divS.className = 'saga'; divS.setAttribute('data-saga', s.nom);
      const nom = document.createElement('div'); nom.className = 'saga-nom'; nom.setAttribute('onclick', 'basculerSaga(this)');
      nom.textContent = s.nom;
      if (s.nom !== 'Aucune') {
        const c = document.createElement('span'); c.className = 'saga-compte'; c.textContent = ` (${s.livres.length})`;
        nom.appendChild(c);
      }
      divS.appendChild(nom);
      const rangee = document.createElement('div'); rangee.className = 'rangee';
      for (const b of s.livres) {
        const livre = document.createElement('div'); livre.className = 'livre';
        livre.setAttribute('data-id', b.id);
        livre.setAttribute('data-titre', b.titre);
        livre.setAttribute('data-auteur', b.auteur);
        livre.setAttribute('data-annee', b.annee_publication || '');
        livre.setAttribute('data-saga', b.saga || 'Aucune');
        livre.setAttribute('data-tome', (b.tome ?? '') + '');
        livre.setAttribute('data-statut', b.statut_lecture || 'non_lu');
        livre.setAttribute('data-note', (b.note ?? '') + '');
        livre.setAttribute('data-isbn', b.isbn || '');
        livre.setAttribute('data-commentaire', b.commentaire || '');
        livre.setAttribute('data-possede', b.possede ? '1' : '0');
        livre.style.setProperty('--c', couleurTranche(b.titre, b.auteur));
        livre.setAttribute('onclick', 'choisirLivre(this)');
        const t = document.createElement('span'); t.className = 'tranche-titre'; t.textContent = b.titre;
        livre.appendChild(t);
        rangee.appendChild(livre);
      }
      divS.appendChild(rangee);
      section.appendChild(divS);
    }
    elEtagere.appendChild(section);
  }
}

elLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  elErreur.hidden = true;
  if (!navigator.onLine) { elErreur.textContent = 'Connexion impossible hors-ligne.'; elErreur.hidden = false; return; }
  const email = document.getElementById('email').value.trim();
  const motdepasse = document.getElementById('motdepasse').value;
  const { error } = await client.auth.signInWithPassword({ email, password: motdepasse });
  if (error) { elErreur.textContent = 'Email ou mot de passe incorrect.'; elErreur.hidden = false; return; }
  await montrerApp();
});

document.getElementById('btn-deconnexion').addEventListener('click', async () => {
  await client.auth.signOut();
  localStorage.removeItem(CLE_LIVRES);
  localStorage.removeItem(CLE_DATE);
  masquerBandeau();
  elEtagere.replaceChildren();
  montrerLogin();
});

(async function init() {
  const { data: { session } } = await client.auth.getSession();
  if (session) await montrerApp(); else montrerLogin();
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
