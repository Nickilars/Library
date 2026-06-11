// Frontend Supabase : auth, lecture (RLS), rendu, cache hors-ligne (B2), et écriture (C1).
import { grouperLivres, couleurTranche, validerLivre } from './shelf-logic.mjs';
import { livreDepuisScan } from './scan-logic.mjs';

const client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const elLogin = document.getElementById('login');
const elEtagere = document.getElementById('etagere');
const elControles = document.getElementById('controles');
const elErreur = document.getElementById('login-erreur');
const elBandeau = document.getElementById('bandeau-hors-ligne');

const elModale = document.getElementById('modale-edition');
const elForm = document.getElementById('form-edition');
const elFormErreur = document.getElementById('form-erreur');
const elFormTitre = document.getElementById('form-titre-modale');
const elBtnSupprimer = document.getElementById('btn-supprimer');

const CLE_LIVRES = 'biblio:livres';
const CLE_DATE = 'biblio:livres:date';

let livresCharges = [];   // dernière liste chargée (pour pré-remplir l'édition + détecter les doublons)
let editionId = null;     // null = ajout ; sinon id du livre en cours d'édition

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
    livresCharges = data;
    try {
      localStorage.setItem(CLE_LIVRES, JSON.stringify(data));
      localStorage.setItem(CLE_DATE, new Date().toISOString());
    } catch (e) { /* quota dépassé : on ignore le cache */ }
    masquerBandeau();
    construireEtagere(data);
    return;
  }
  const cache = localStorage.getItem(CLE_LIVRES);
  if (cache) {
    livresCharges = JSON.parse(cache);
    afficherBandeau(localStorage.getItem(CLE_DATE));
    construireEtagere(livresCharges);
  } else {
    livresCharges = [];
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

// ---------- Connexion ----------
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
  livresCharges = [];
  masquerBandeau();
  elEtagere.replaceChildren();
  montrerLogin();
});

// ---------- Édition (C1) ----------
function champ(id) { return document.getElementById(id); }
function erreurForm(msg) { elFormErreur.textContent = msg; elFormErreur.hidden = false; }

function ouvrirModale(livre) {
  editionId = livre ? livre.id : null;
  elFormTitre.textContent = livre ? 'Modifier le livre' : 'Ajouter un livre';
  champ('f-titre').value = livre ? (livre.titre || '') : '';
  champ('f-auteur').value = livre ? (livre.auteur || '') : '';
  champ('f-annee').value = livre ? (livre.annee_publication || '') : '';
  champ('f-isbn').value = livre ? (livre.isbn || '') : '';
  champ('f-saga').value = (livre && livre.saga && livre.saga !== 'Aucune') ? livre.saga : '';
  champ('f-tome').value = (livre && livre.tome != null) ? livre.tome : '';
  champ('f-statut').value = livre ? (livre.statut_lecture || 'non_lu') : 'non_lu';
  champ('f-possede').checked = !!(livre && livre.possede);
  champ('f-wishlist').checked = !!(livre && livre.wishlist);
  champ('f-note').value = (livre && livre.note != null) ? livre.note : '';
  champ('f-commentaire').value = livre ? (livre.commentaire || '') : '';
  elFormErreur.hidden = true;
  const elIsbnStatut = document.getElementById('isbn-statut');
  if (elIsbnStatut) elIsbnStatut.textContent = '';
  elBtnSupprimer.hidden = !livre;
  elModale.classList.remove('cache');
}
function fermerModale() { elModale.classList.add('cache'); editionId = null; }

// Appelé par le ✏️ de shelf.js
window.ouvrirEdition = (id) => {
  const l = livresCharges.find(b => String(b.id) === String(id));
  if (l) ouvrirModale(l);
};

function doublon(livre) {
  const isbn = (livre.isbn || '').trim();
  if (isbn) {
    const parIsbn = livresCharges.find(b => (b.isbn || '') === isbn);
    if (parIsbn) return parIsbn;
  }
  const t = livre.titre.toLowerCase(), a = livre.auteur.toLowerCase();
  return livresCharges.find(b => (b.titre || '').toLowerCase() === t && (b.auteur || '').toLowerCase() === a) || null;
}

elForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  elFormErreur.hidden = true;
  if (!navigator.onLine) { erreurForm('Action impossible hors-ligne.'); return; }
  const v = validerLivre({
    titre: champ('f-titre').value, auteur: champ('f-auteur').value,
    annee_publication: champ('f-annee').value, isbn: champ('f-isbn').value,
    saga: champ('f-saga').value, tome: champ('f-tome').value,
    statut_lecture: champ('f-statut').value,
    possede: champ('f-possede').checked, wishlist: champ('f-wishlist').checked,
    note: champ('f-note').value, commentaire: champ('f-commentaire').value,
  });
  if (!v.ok) { erreurForm(v.erreur); return; }

  if (editionId === null) {
    const dup = doublon(v.livre);
    if (dup) { erreurForm(`Doublon : « ${dup.titre} » de ${dup.auteur} est déjà dans la collection.`); return; }
    const { data: { session } } = await client.auth.getSession();
    if (!session) { erreurForm('Session expirée, reconnecte-toi.'); return; }
    const { error } = await client.from('books').insert({ ...v.livre, user_id: session.user.id });
    if (error) { erreurForm("Échec de l'ajout : " + error.message); return; }
  } else {
    const { error } = await client.from('books').update(v.livre).eq('id', editionId);
    if (error) { erreurForm('Échec de la modification : ' + error.message); return; }
  }
  fermerModale();
  await chargerLivres();
});

elBtnSupprimer.addEventListener('click', async () => {
  if (editionId === null) return;
  if (!navigator.onLine) { erreurForm('Action impossible hors-ligne.'); return; }
  if (!confirm('Supprimer définitivement ce livre ?')) return;
  const { error } = await client.from('books').delete().eq('id', editionId);
  if (error) { erreurForm('Échec de la suppression : ' + error.message); return; }
  fermerModale();
  await chargerLivres();
});

document.getElementById('btn-ajouter').addEventListener('click', () => ouvrirModale(null));
document.getElementById('btn-annuler').addEventListener('click', fermerModale);
document.getElementById('btn-fermer-modale').addEventListener('click', fermerModale);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !elModale.classList.contains('cache')) fermerModale();
});

// ---------- Scan en rafale (D2) ----------
// Insertion directe d'un livre scanné. Renvoie { ok, raison?, titre? } — pas d'exception.
window.ajouterLivreScan = async (livreLookup, isbn) => {
  const v = validerLivre(livreDepuisScan(livreLookup, isbn));
  if (!v.ok) return { ok: false, raison: v.erreur };
  const dup = doublon(v.livre);
  if (dup) return { ok: false, raison: 'doublon', titre: dup.titre };
  const { data: { session } } = await client.auth.getSession();
  if (!session) return { ok: false, raison: 'session' };
  const { data, error } = await client.from('books')
    .insert({ ...v.livre, user_id: session.user.id }).select().single();
  if (error) return { ok: false, raison: error.message };
  livresCharges.push(data);                 // dédup à jour pendant la session de scan
  return { ok: true, titre: data.titre };
};

// Bouton « Scanner une pile » : visible si scan dispo (scan.js est exécuté avant app.js).
(async () => {
  const btn = document.getElementById('btn-scan-pile');
  if (!(window.scanDisponible && await window.scanDisponible())) return;
  btn.hidden = false;
  btn.addEventListener('click', async () => {
    if (!navigator.onLine) return;          // lookup + insert exigent le réseau
    let ajoutes = 0;
    try {
      await window.demarrerScan({
        continu: true,
        surIsbn: async (isbn, ui) => {
          ui.toast('Recherche ' + isbn + '…');
          let resultat;
          try { resultat = await window.lookupIsbn(isbn); }
          catch (e) { ui.toast('Erreur de recherche — réessaie.', 'erreur'); return; }
          if (!resultat || !resultat.trouve) { ui.toast('Introuvable : ' + isbn + ' — ajout manuel', 'erreur'); return; }
          const r = await window.ajouterLivreScan(resultat.livre, isbn);
          if (r.ok) { ajoutes++; ui.toast('Ajouté : ' + r.titre, 'ok'); }
          else if (r.raison === 'doublon') ui.toast('Déjà dans la collection : ' + r.titre, 'erreur');
          else if (r.raison === 'session') ui.toast('Session expirée — reconnecte-toi.', 'erreur');
          else ui.toast('Échec : ' + r.raison, 'erreur');
        },
        surFermeture: async () => { if (ajoutes > 0) await chargerLivres(); },  // un seul rechargement
      });
    } catch (e) { /* caméra refusée : overlay déjà fermé */ }
  });
})();

// ---------- Recherche par ISBN (C2) ----------
// Exposé pour isbn.js (script classique). Renvoie { trouve, livre? } ou lève en cas d'erreur réseau.
window.lookupIsbn = async (isbn) => {
  const { data, error } = await client.functions.invoke('lookup', { body: { isbn } });
  if (error) throw error;
  return data;
};

// ---------- Démarrage ----------
(async function init() {
  const { data: { session } } = await client.auth.getSession();
  if (session) await montrerApp(); else montrerLogin();
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
