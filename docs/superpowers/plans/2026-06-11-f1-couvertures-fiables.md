# F1 — Couvertures fiables (proxy Edge multi-sources) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fonction Edge `cover` qui résout la couverture d'un ISBN via OpenLibrary → BnF (SRU→ark→vignette) → Amazon (ISBN-10), renvoyée avec CORS + cache ; le client (3D + 2D) pointe sur la fonction.

**Architecture:** voir la spec (`2026-06-11-f1-couvertures-fiables-design.md`). Logique pure auto-contenue dans `cover-core.mjs` (testable node), I/O dans `index.ts`.

**Tech Stack:** Deno (Edge), JS ESM pur, tests node. Node absent en local → vérif par CI.

---

### Task 1 : Logique pure `cover-core.mjs` (TDD)

- [ ] `web/test_cover_core.mjs` : `isbn13Vers10` (`9782290424476`→`2290424471`, `9780553573404`→`0553573403`, clé X `9781558608320`→`155860832X`, `979…`→null, invalide→null) ; `extraireArk` (XML SRU → `ark:/12148/cb…`, absent → null) ; constructeurs d'URL (OL `-L.jpg?default=false`, SRU encodée, vignette ark, Amazon `.08.L.jpg`).
- [ ] Run `node web/test_cover_core.mjs` → FAIL puis PASS.
- [ ] Commit `feat: F1 cover-core — isbn13Vers10, extraireArk, URLs sources (node tests)`.

### Task 2 : Fonction Edge `cover/index.ts`

- [ ] GET `?isbn=` (et OPTIONS) ; validation 13 chiffres avant tout fetch ; chaîne OL → BnF → Amazon avec timeout 5 s ; image retenue si `Content-Type: image/*` et > 1 500 octets ; réponse : octets + `Access-Control-Allow-Origin` (allowlist Pages + `http://127.0.0.1:8000`) + `Cache-Control: public, max-age=604800, immutable` ; sinon 404 JSON.
- [ ] Commit `feat: F1 fonction Edge cover — proxy OL→BnF→Amazon avec CORS allowlist + cache`.

### Task 3 : Client

- [ ] `web/book3d.js` (`appliquerCouverture`) et `web/shelf.js` (`couverture2D`) : URL → `window.SUPABASE_URL + '/functions/v1/cover?isbn=' + isbn`.
- [ ] `web/dev_book3d.html` : inclure `config.js`.
- [ ] `web/sw.js` : bump `biblio-v5`. CI : ajouter le test cover.
- [ ] Vérif locale : sans fonction déployée → repli couverture générée intact (capture headless).
- [ ] Commit `feat: F1 client — couvertures via la fonction cover (3D + 2D), SW v5, CI`.

### Task 4 : Déploiement + checklist + PR

- [ ] Déploiement **manuel** : Dashboard → Edge Functions → `cover`, **Verify JWT désactivé**.
- [ ] Checklist de la spec (1–5). PR `f1-couvertures` → `main`.
