// Recherche par ISBN (C2) — DOM + statut. Délègue l'appel réseau à window.lookupIsbn (app.js).

function remplirChamps(livre) {
  const set = (id, v) => {
    if (v !== null && v !== undefined && String(v).trim() !== '') {
      document.getElementById(id).value = String(v).trim();
    }
  };
  set('f-titre', livre.titre);
  set('f-auteur', livre.auteur);
  set('f-annee', livre.annee);
  set('f-saga', livre.saga);
  set('f-tome', livre.tome);
}

async function rechercherIsbn() {
  const statut = document.getElementById('isbn-statut');
  const isbn = document.getElementById('f-isbn').value.replace(/[\s-]/g, '');
  if (!/^\d{13}$/.test(isbn)) { statut.textContent = 'ISBN : 13 chiffres attendus.'; return; }
  if (!navigator.onLine) { statut.textContent = 'Recherche en ligne uniquement.'; return; }
  if (!window.lookupIsbn) { statut.textContent = 'Indisponible (recharge la page).'; return; }

  statut.textContent = 'Recherche…';
  try {
    const data = await window.lookupIsbn(isbn);
    if (!data || !data.trouve) { statut.textContent = 'Introuvable — saisis à la main.'; return; }
    remplirChamps(data.livre);
    statut.textContent = 'Trouvé ✓';
  } catch (e) {
    console.error('Recherche ISBN', e);
    statut.textContent = 'Erreur de recherche.';
  }
}

document.getElementById('btn-isbn').addEventListener('click', rechercherIsbn);

// --- Scan caméra (D1) : remplit l'ISBN puis lance la recherche C2 ---
// Le bouton est révélé par scan.js (module) uniquement si BarcodeDetector + caméra dispo.
document.getElementById('btn-scan').addEventListener('click', async () => {
  const statut = document.getElementById('isbn-statut');
  try {
    await window.demarrerScan({
      continu: false,
      surIsbn: async (isbn) => {
        document.getElementById('f-isbn').value = isbn;
        await rechercherIsbn();              // recherche C2 déclenchée automatiquement
      },
    });
  } catch (e) {
    statut.textContent = "Caméra indisponible ou refusée — saisis l'ISBN à la main.";
  }
});
