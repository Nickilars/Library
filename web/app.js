// Frontend Supabase : authentification, récupération des livres (RLS), rendu de l'étagère.
import { grouperLivres, couleurTranche } from './shelf-logic.mjs';

const client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const elLogin = document.getElementById('login');
const elEtagere = document.getElementById('etagere');
const elControles = document.getElementById('controles');
const elErreur = document.getElementById('login-erreur');

function montrerLogin() {
  elLogin.hidden = false; elEtagere.hidden = true; elControles.hidden = true;
}
async function montrerApp() {
  elLogin.hidden = true; elEtagere.hidden = false; elControles.hidden = false;
  await chargerLivres();
}

async function chargerLivres() {
  const { data, error } = await client.from('books').select('*');
  if (error) { elEtagere.replaceChildren(); const p = document.createElement('p'); p.className = 'vide'; p.textContent = 'Erreur de chargement.'; elEtagere.appendChild(p); return; }
  construireEtagere(data || []);
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
  const email = document.getElementById('email').value.trim();
  const motdepasse = document.getElementById('motdepasse').value;
  const { error } = await client.auth.signInWithPassword({ email, password: motdepasse });
  if (error) { elErreur.textContent = 'Email ou mot de passe incorrect.'; elErreur.hidden = false; return; }
  await montrerApp();
});

document.getElementById('btn-deconnexion').addEventListener('click', async () => {
  await client.auth.signOut();
  elEtagere.replaceChildren();
  montrerLogin();
});

(async function init() {
  const { data: { session } } = await client.auth.getSession();
  if (session) await montrerApp(); else montrerLogin();
})();
