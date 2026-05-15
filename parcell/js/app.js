// ============================================================
// app.js — Orchestration principale de l'app
// ============================================================

// ── Point d'entrée après connexion ──
async function initApp() {
  // Injecte les onglets dans le DOM
  renderTabContents();
  // Charge les villes depuis Supabase (remplace data.js statique)
  await loadCitiesFromSupabase();
  // Initialise les composants qui dépendent des villes
  renderAll();
  populateSimVilleSelect();
  if (typeof initMap === 'function') initMap();
  onSimVilleChange();
  calcSim();
  // Précharge les projets en arrière-plan
  loadProjects();
}

// ── Injection des onglets ──
function renderTabContents() {
  document.getElementById('tabContainer').innerHTML = `
    ${renderAnalyseTab()}
    ${renderSimulateurTab()}
    ${renderCompteTab()}
  `;
}

// ══════════════════════════════════════════
// ONGLET ANALYSE
// ══════════════════════════════════════════
function renderAnalyseTab() {
  return `
<div id="tab-analyse" class="tab-content active">
  <div class="search-bar">
    <div class="sg"><label>Région</label>
      <select id="regionSel" onchange="onRegionChange()"><option value="">Toutes les régions</option></select>
    </div>
    <div class="sg"><label>Département</label>
      <select id="deptSel" onchange="onDeptChange()"><option value="">Tous les départements</option></select>
    </div>
    <div class="sg" style="flex:2"><label>Ajouter une ville</label>
      <div style="position:relative;">
        <input type="text" id="citySearch" placeholder="Taper ou choisir dans la liste…"
          oninput="onCityInput()" onfocus="showCityDropdown()" onblur="hideCityDropdown()" autocomplete="off"
          style="background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius-sm);color:var(--text);padding:9px 12px;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border-color 0.2s;width:100%;">
        <div id="cityDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:100;background:var(--card2);border:1px solid var(--border2);border-radius:var(--radius-sm);max-height:220px;overflow-y:auto;margin-top:3px;box-shadow:0 8px 24px rgba(0,0,0,0.4);"></div>
      </div>
    </div>
  </div>

  <div id="chipsSection" style="display:none;margin-bottom:18px;">
    <div class="chips-selected-label">Villes sélectionnées — cliquer pour retirer</div>
    <div class="chips-wrap" id="chipsWrap"></div>
  </div>

  <div class="sources-bar">
    <span>Sources :</span>
    <a href="https://www.insee.fr/fr/statistiques/serie/001641536" target="_blank">Population → INSEE</a>
    <a href="https://cerema.fr" target="_blank">Prix m² → DVF / CEREMA</a>
    <a href="https://www.locservice.fr" target="_blank">Tension → LocService 2024</a>
    <a href="https://www.insee.fr/fr/statistiques/2021266" target="_blank">Salaires → INSEE DADS</a>
  </div>

  <div class="section"><div class="section-title">Vue d'ensemble</div><div class="grid-4" id="kpiCards"></div></div>

  <div class="grid-2" style="margin-bottom:22px;">
    <div>
      <div class="section-title">Carte interactive <span id="mapHint" style="font-size:11px;color:var(--text3);font-weight:400;">· Zoom pour délimitations</span></div>
      <div class="map-card"><div id="leafletMap"></div></div>
    </div>
    <div>
      <div class="section-title">Classement attractivité</div>
      <div class="card" style="padding:16px 18px;min-height:400px;"><div id="attrRanking"></div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Tableau comparatif <small style="font-size:12px;color:var(--text3);font-weight:400;font-family:'DM Sans'">villes sélectionnées · cliquer pour retirer</small></div>
    <div class="table-wrap">
      <table id="mainTable" style="display:none;">
        <thead><tr>
          <th id="th-Ville" onclick="sortByCol('Ville')">Ville</th>
          <th id="th-Dept" onclick="sortByCol('Dept')">Département</th>
          <th id="th-2022" onclick="sortByCol('2022')">Population</th>
          <th id="th-Prix_m2" onclick="sortByCol('Prix_m2')">Prix m²</th>
          <th id="th-Loyer_m2_Apt" onclick="sortByCol('Loyer_m2_Apt')">Loyer réel</th>
          <th id="th-Tension" onclick="sortByCol('Tension')">Tension loc.</th>
          <th id="th-Attractivite" onclick="sortByCol('Attractivite')">Attractivité</th>
        </tr></thead>
        <tbody id="tableBody"></tbody>
      </table>
    </div>
    <div id="tableEmpty" style="text-align:center;padding:36px;color:var(--text3);font-size:14px;">Sélectionnez des villes via la recherche ou la carte.</div>
  </div>

  <div class="grid-2" style="margin-bottom:32px;">
    <div class="chart-card"><div class="chart-title">📈 Évolution population 1970–2022</div><canvas id="popChart"></canvas></div>
    <div class="chart-card"><div class="chart-title">💶 Prix m² vs Salaire médian</div><canvas id="salPriceChart"></canvas></div>
  </div>
</div>`;
}

// ══════════════════════════════════════════
// ONGLET SIMULATEUR
// ══════════════════════════════════════════
function renderSimulateurTab() {
  return `
<div id="tab-simulateur" class="tab-content">
  <div style="display:flex;justify-content:center;padding:16px 0 4px;">
    <div class="mode-switcher">
      <button class="mode-btn active simple" id="modeSimple" onclick="setMode('simple')">✨ Simple</button>
      <button class="mode-btn pro" id="modePro" onclick="setMode('pro')">⚙️ Pro</button>
    </div>
  </div>
  <p style="text-align:center;font-size:12px;color:var(--text3);margin-bottom:16px;" id="modeDesc">Estimez rapidement la rentabilité d'un bien en quelques clics.</p>

  <div class="import-bar" id="importBar">
    <span style="font-size:13px;color:var(--teal);white-space:nowrap;display:flex;align-items:center;gap:5px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>IA
    </span>
    <textarea id="importInput" placeholder="Collez le texte d'une annonce (LeBonCoin, SeLoger, PAP…)" style="background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius-sm);color:var(--text);padding:8px 12px;font-family:'DM Sans',sans-serif;font-size:13px;outline:none;transition:border-color 0.2s;resize:vertical;min-height:52px;max-height:140px;width:100%;line-height:1.5;" onfocus="this.style.borderColor='var(--teal)'" onblur="this.style.borderColor='var(--border2)'"></textarea>
    <button class="import-btn" id="importBtn" onclick="parseAnnonceAI()"><span id="importBtnText">Analyser ✦</span></button>
  </div>
  <div class="import-result" id="importResult"></div>

  <div class="section"><div class="sim-layout">
    <div class="card" style="padding:24px;">
      <div class="input-block"><label>Ville</label>
        <select class="field" id="simVille" onchange="onSimVilleChange()"></select>
      </div>
      <div class="input-block" id="quartierBlock" style="display:none;"><label>Quartier <span style="color:var(--teal);font-size:11px;">· influe sur le loyer</span></label>
        <select class="field" id="simQuartier" onchange="updateSimLoyer()"></select>
      </div>
      <div class="input-block"><label>Type de bien</label>
        <div class="toggle-group">
          <button class="toggle-btn active" id="btnApt" onclick="setType('Apt')">🏠 Appartement</button>
          <button class="toggle-btn" id="btnMsn" onclick="setType('Msn')">🏡 Maison</button>
        </div>
      </div>

      <div id="blockSimple">
        <div class="input-block"><label>Surface estimée (m²)</label>
          <input class="field" type="number" id="simSurfS" value="45" min="9" oninput="syncSurf(this);updateSimLoyer()">
        </div>
        <div class="input-block"><label>Budget d'achat estimé (€)</label>
          <div class="prix-field-wrap">
            <input type="number" id="simPrixS" class="prix-field-inline" value="150000" step="5000" placeholder="Ex : 150 000" oninput="syncPrix(this);autoNotaire();calcSim()">
            <span class="prix-suffix-inline">€</span>
          </div>
        </div>
        <div class="input-block"><label>Apport personnel (€)</label>
          <div class="field-prefix-wrap"><span class="field-prefix">€</span>
            <input class="field" type="number" id="simApportS" value="20000" oninput="syncField('simApport','simApportS');calcSim()">
          </div>
        </div>
      </div>

      <div id="blockPro" style="display:none;">
        <div class="input-block"><label>Location meublée</label>
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="toggle-group" style="flex:1">
              <button class="toggle-btn" id="btnNonMeuble" onclick="setMeuble(false)">🪑 Non meublé</button>
              <button class="toggle-btn active" id="btnMeuble" onclick="setMeuble(true)">🛋️ Meublé</button>
            </div>
            <div style="display:flex;align-items:center;gap:4px;min-width:75px;">
              <span style="font-size:11px;color:var(--text3);">+</span>
              <input type="number" id="meublePct" class="field" style="width:50px;padding:5px 7px;font-size:13px;" value="15" min="0" max="50" oninput="updateSimLoyer()">
              <span style="font-size:11px;color:var(--text3);">%</span>
            </div>
          </div>
        </div>
        <div class="input-block"><div class="input-row">
          <div style="flex:1"><label>Surface (m²)</label><input class="field" type="number" id="simSurf" value="45" min="9" oninput="syncSurf(this);updateSimLoyer()"></div>
          <div style="flex:1"><label>Pièces : <span id="pcsVal" class="range-val">2</span></label><input type="range" id="simPcs" min="1" max="6" value="2" style="margin-top:10px;" oninput="document.getElementById('pcsVal').textContent=this.value;updateSimLoyer()"></div>
        </div></div>

        <div class="pro-section">
          <div class="pro-section-title">Équipements & atouts</div>
          <div class="checkbox-grid">
            <label class="checkbox-item" id="opt-parking" onclick="toggleOpt('parking',this)"><input type="checkbox" id="cb-parking" style="pointer-events:none;"> 🚗 Parking / Garage</label>
            <label class="checkbox-item" id="opt-balcon" onclick="toggleOpt('balcon',this)"><input type="checkbox" id="cb-balcon" style="pointer-events:none;"> 🌿 Balcon / Terrasse</label>
            <label class="checkbox-item" id="opt-jardin" onclick="toggleOpt('jardin',this)"><input type="checkbox" id="cb-jardin" style="pointer-events:none;"> 🌳 Jardin privatif</label>
            <label class="checkbox-item" id="opt-cave" onclick="toggleOpt('cave',this)"><input type="checkbox" id="cb-cave" style="pointer-events:none;"> 📦 Cave / Cellier</label>
            <label class="checkbox-item" id="opt-digicode" onclick="toggleOpt('digicode',this)"><input type="checkbox" id="cb-digicode" style="pointer-events:none;"> 🔒 Gardien / Digicode</label>
            <label class="checkbox-item" id="opt-renove" onclick="toggleOpt('renove',this)"><input type="checkbox" id="cb-renove" style="pointer-events:none;"> ✨ Récemment rénové</label>
          </div>
        </div>

        <div class="divider"></div>
        <div class="input-block"><label>Prix d'achat net vendeur</label>
          <div class="prix-field-wrap">
            <input type="number" id="simPrix" class="prix-field-inline" value="150000" step="1000" placeholder="Ex : 150 000" oninput="syncPrix(this);autoNotaire();calcSim()">
            <span class="prix-suffix-inline">€</span>
          </div>
        </div>
        <div class="input-block"><div class="input-row">
          <div style="flex:1"><label>Frais de notaire (€)</label><div class="field-prefix-wrap"><span class="field-prefix">€</span><input class="field" type="number" id="simNotaire" value="11250" oninput="calcSim()"></div></div>
          <div style="flex:1"><label>Travaux / Meubles (€)</label><div class="field-prefix-wrap"><span class="field-prefix">€</span><input class="field" type="number" id="simTravaux" value="10000" oninput="calcSim()"></div></div>
        </div></div>
        <div class="input-block"><label>Apport personnel (€)</label><div class="field-prefix-wrap"><span class="field-prefix">€</span><input class="field" type="number" id="simApport" value="20000" oninput="syncField('simApportS','simApport');calcSim()"></div></div>
        <div class="input-block"><label>Durée du prêt : <span id="dureeVal" class="range-val">20 ans</span></label><input type="range" id="simDuree" min="10" max="25" value="20" oninput="document.getElementById('dureeVal').textContent=this.value+' ans';calcSim()"></div>
        <div class="input-block"><label>Taux d'intérêt : <span id="tauxVal" class="range-val">3.6%</span></label><input type="range" id="simTaux" min="1" max="7" step="0.1" value="3.6" oninput="document.getElementById('tauxVal').textContent=parseFloat(this.value).toFixed(1)+'%';calcSim()"></div>
        <div class="input-block"><label>Assurance emprunteur : <span id="assurVal" class="range-val">0.20%</span></label><input type="range" id="simAssur" min="0.10" max="0.50" step="0.01" value="0.20" oninput="document.getElementById('assurVal').textContent=parseFloat(this.value).toFixed(2)+'%';calcSim()"></div>
        <div class="input-block"><label>Vacance locative : <span id="vacanceVal" class="range-val">1 mois/an</span></label><input type="range" id="simVacance" min="0" max="3" step="0.5" value="1" oninput="document.getElementById('vacanceVal').textContent=this.value+' mois/an';calcSim()"></div>
        <div class="input-block"><label>Charges copro (€/mois)</label><div class="field-prefix-wrap"><span class="field-prefix">€</span><input class="field" type="number" id="simCopro" value="0" oninput="calcSim()"></div></div>
      </div>
    </div>

    <div class="results-panel">
      <div class="result-hero">
        <div class="result-hero-label">Coût total estimé</div>
        <div class="result-hero-value" id="totalProjet">—</div>
        <div class="result-hero-sub">dont <span id="montantPret">—</span> à emprunter</div>
      </div>
      <div class="loyer-kpi">
        <div class="loyer-kpi-left">
          <label>Loyer mensuel estimé ✏️</label>
          <div class="loyer-kpi-sub" id="lyrInfo">—</div>
        </div>
        <div><input class="loyer-kpi-input" type="number" id="simLoyer" value="680" oninput="calcSim()"><div style="text-align:center;font-size:11px;color:var(--text3);margin-top:3px;">€/mois</div></div>
      </div>
      <div class="kpi-grid-2">
        <div class="sim-kpi"><div class="detail-badge" onclick="openDrawer('rentabilite')">ℹ</div><div class="sim-kpi-label">Renta. Brute</div><div class="sim-kpi-value" id="rentBrute" style="color:var(--teal)">—</div><div class="sim-kpi-sub">Loyers / coût</div></div>
        <div class="sim-kpi"><div class="detail-badge" onclick="openDrawer('rentabilite')">ℹ</div><div class="sim-kpi-label">Renta. Nette</div><div class="sim-kpi-value" id="rentNette" style="color:var(--gold)">—</div><div class="sim-kpi-sub">Après charges</div></div>
        <div class="sim-kpi"><div class="detail-badge" onclick="openDrawer('credit')">ℹ</div><div class="sim-kpi-label">Mensualité</div><div class="sim-kpi-value" id="mensualite">—</div><div class="sim-kpi-sub">Crédit</div></div>
        <div class="sim-kpi"><div class="detail-badge" onclick="openDrawer('credit')">ℹ</div><div class="sim-kpi-label">Assurance</div><div class="sim-kpi-value" id="assurMens">—</div><div class="sim-kpi-sub">/mois</div></div>
      </div>
      <div class="cashflow-indicator" id="cashflowBox">
        <div><div class="cashflow-label">Cashflow net mensuel</div><div style="font-size:11px;color:var(--text3);margin-top:1px;">Loyer − crédit − assurance − charges</div></div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="cashflow-val" id="cashflowVal">—</div>
          <div class="detail-badge" style="position:static;flex-shrink:0;" onclick="openDrawer('cashflow')">📈</div>
        </div>
      </div>
      <button class="more-btn" onclick="openDrawer('marche')">🏘️ Marché local &amp; tension locative →</button>
      <button class="save-btn" onclick="openSaveModal()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Sauvegarder ce projet
      </button>
    </div>
  </div></div>
</div>`;
}

// ══════════════════════════════════════════
// ONGLET MON ESPACE
// ══════════════════════════════════════════
function renderCompteTab() {
  return `
<div id="tab-compte" class="tab-content">
  <div class="compte-layout">
    <div class="compte-sidebar">
      <div class="compte-avatar-big" id="profileAvatarBig"></div>
      <div class="compte-name" id="profileName">—</div>
      <div class="compte-email" id="profileEmail">—</div>
      <span class="compte-plan-badge">⭐ Plan Gratuit</span>
      <div class="compte-nav-item active" id="cnav-projets" onclick="showCompteSection('projets')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>Mes projets</div>
      <div class="compte-nav-item" id="cnav-profil" onclick="showCompteSection('profil')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg>Mon profil</div>
      <div class="compte-nav-item" id="cnav-notifs" onclick="showCompteSection('notifs')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>Notifications</div>
      <div class="compte-nav-item" id="cnav-abonnement" onclick="showCompteSection('abonnement')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>Abonnement</div>
      <div class="compte-stats">
        <div class="compte-stat"><div class="compte-stat-val" id="stat-projets">0</div><div class="compte-stat-label">Projets</div></div>
        <div class="compte-stat"><div class="compte-stat-val" id="stat-simulations">0</div><div class="compte-stat-label">Simulations</div></div>
      </div>
    </div>
    <div class="compte-main">
      <div id="csection-projets" class="compte-section">
        <div class="compte-section-title">📁 Mes projets sauvegardés</div>
        <div class="projets-grid" id="projetsGrid"></div>
      </div>
      <div id="csection-profil" class="compte-section" style="display:none;">
        <div class="compte-section-title">👤 Mon profil</div>
        <div class="profil-grid">
          <div class="profil-field"><label>Prénom</label><input type="text" id="profileFirstName"></div>
          <div class="profil-field"><label>Nom</label><input type="text" id="profileLastName"></div>
        </div>
        <div class="profil-field"><label>Email</label><input type="email" id="profileEmailEdit" readonly style="opacity:0.6;cursor:not-allowed;"></div>
        <div class="profil-grid">
          <div class="profil-field"><label>Ville de résidence</label><input type="text" id="profileCity"></div>
          <div class="profil-field"><label>Téléphone</label><input type="tel" id="profilePhone"></div>
        </div>
        <div class="profil-field"><label>Objectif investissement</label>
          <select id="profileObjectif" style="width:100%;background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius-sm);color:var(--text);padding:9px 13px;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;">
            <option value="cashflow">Complément de revenus (cashflow)</option>
            <option value="patrimoine">Constitution de patrimoine</option>
            <option value="retraite">Préparation à la retraite</option>
            <option value="fisca">Défiscalisation</option>
          </select>
        </div>
        <div style="margin-top:6px;"><button class="profil-save-btn" onclick="saveProfile()">Enregistrer les modifications</button></div>
      </div>
      <div id="csection-notifs" class="compte-section" style="display:none;">
        <div class="compte-section-title">🔔 Notifications</div>
        <div id="notifsList">
          <div style="color:var(--text3);font-size:13px;padding:20px 0;">Aucune notification pour l'instant.</div>
        </div>
      </div>
      <div id="csection-abonnement" class="compte-section" style="display:none;">
        <div class="compte-section-title">💳 Abonnement</div>
        <div style="background:var(--bg3);border-radius:var(--radius);padding:20px;margin-bottom:14px;border:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div><div style="font-family:'Outfit',sans-serif;font-size:16px;font-weight:700;">Plan Gratuit</div><div style="font-size:13px;color:var(--text2);margin-top:2px;">Fonctionnalités essentielles</div></div><span style="font-family:'Outfit',sans-serif;font-size:22px;font-weight:700;color:var(--text3);">0 €</span></div>
          <div style="font-size:12px;color:var(--text2);line-height:1.8;">✅ Analyse marché · ✅ Simulateur simple · ✅ 5 projets · ❌ Mode Pro · ❌ Export PDF · ❌ Alertes prix</div>
        </div>
        <div style="background:linear-gradient(135deg,var(--card2),var(--bg3));border:1px solid rgba(201,168,76,0.25);border-radius:var(--radius);padding:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div><div style="font-family:'Outfit',sans-serif;font-size:16px;font-weight:700;color:var(--gold);">Plan Pro <span style="font-size:11px;background:var(--gold);color:#0a0d14;padding:2px 7px;border-radius:8px;margin-left:6px;vertical-align:middle;">Bientôt</span></div><div style="font-size:13px;color:var(--text2);margin-top:2px;">Toutes les fonctionnalités</div></div><span style="font-family:'Outfit',sans-serif;font-size:22px;font-weight:700;color:var(--gold);">9 € <span style="font-size:13px;font-weight:400;color:var(--text3)">/mois</span></span></div>
          <div style="font-size:12px;color:var(--text2);line-height:1.8;margin-bottom:14px;">✅ Tout du gratuit · ✅ Projets illimités · ✅ Mode Pro · ✅ Export PDF · ✅ Alertes prix · ✅ DVF reel</div>
          <button style="padding:10px 20px;background:var(--gold);border:none;border-radius:8px;color:#0a0d14;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:not-allowed;opacity:0.6;">Bientôt disponible</button>
        </div>
      </div>
    </div>
  </div>
</div>`;
}

// ── Tab switch ──
function switchTab(tab, el) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
  const tabEl = document.getElementById('tab-' + tab);
  if (tabEl) tabEl.classList.add('active');
  if (el) el.classList.add('active');
  else {
    document.querySelectorAll('.main-tab').forEach(t => {
      if ((tab==='analyse'&&t.textContent.includes('Analyse'))||
          (tab==='simulateur'&&t.textContent.includes('Simulateur'))||
          (tab==='compte'&&t.textContent.includes('espace')))
        t.classList.add('active');
    });
  }
  if (tab === 'analyse') setTimeout(() => { if (typeof leafletMap !== 'undefined' && leafletMap) leafletMap.invalidateSize(); }, 200);
  if (tab === 'compte') { populateProfileForm(); showCompteSection('projets'); }
}

// ── Compte sections ──
function showCompteSection(section) {
  ['projets','profil','notifs','abonnement'].forEach(s => {
    const el  = document.getElementById('csection-' + s);
    const nav = document.getElementById('cnav-' + s);
    if (el) el.style.display = s === section ? 'block' : 'none';
    if (nav) nav.classList.toggle('active', s === section);
  });
  if (section === 'projets') renderProjets();
}

// ── Profil ──
function populateProfileForm() {
  if (!currentUser || !currentProfile) return;
  const name = currentProfile.full_name || '';
  const parts = name.split(' ');
  const bigAvatar = document.getElementById('profileAvatarBig');
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || currentUser.email[0].toUpperCase();
  if (bigAvatar) bigAvatar.textContent = initials;
  document.getElementById('profileName').textContent  = name || currentUser.email;
  document.getElementById('profileEmail').textContent = currentUser.email;
  const fn = document.getElementById('profileFirstName'); if (fn) fn.value = parts[0] || '';
  const ln = document.getElementById('profileLastName');  if (ln) ln.value = parts.slice(1).join(' ') || '';
  const em = document.getElementById('profileEmailEdit'); if (em) em.value = currentUser.email;
  const ci = document.getElementById('profileCity');      if (ci){ ci.value = currentProfile.preferences?.city || '';}
  const ph = document.getElementById('profilePhone');     if (ph){ ph.value = currentProfile.preferences?.phone || '';}
  const ob = document.getElementById('profileObjectif');  if (ob){ ob.value = currentProfile.preferences?.objectif || 'cashflow';}
}

async function saveProfile() {
  if (!currentUser) return;
  const firstName  = document.getElementById('profileFirstName')?.value.trim() || '';
  const lastName   = document.getElementById('profileLastName')?.value.trim() || '';
  const fullName   = [firstName, lastName].filter(Boolean).join(' ');
  const city       = document.getElementById('profileCity')?.value.trim() || '';
  const phone      = document.getElementById('profilePhone')?.value.trim() || '';
  const objectif   = document.getElementById('profileObjectif')?.value || 'cashflow';

  // ✅ Correction : supabaseClient (pas supabase)
  const { error } = await supabaseClient.from('profiles').update({
    full_name: fullName,
    preferences: { ...currentProfile?.preferences, city, phone, objectif },
    updated_at: new Date().toISOString()
  }).eq('id', currentUser.id);

  if (error) { showToast('Erreur lors de la sauvegarde', 'err'); return; }
  if (currentProfile) { currentProfile.full_name = fullName; }
  updateNavUser(currentUser, currentProfile);
  showToast('Profil mis à jour ✓');
}

// ── Toast ──
function showToast(msg, type = 'ok') {
  const t = document.getElementById('saveToast');
  const m = document.getElementById('toastMsg');
  if (!t || !m) return;
  m.textContent = msg;
  t.style.borderColor = type === 'err'  ? 'rgba(248,113,113,0.3)'  :
                        type === 'warn' ? 'rgba(201,168,76,0.3)'   :
                                          'rgba(52,211,153,0.3)';
  t.style.color = type === 'err'  ? 'var(--red)'  :
                  type === 'warn' ? 'var(--gold)' :
                                    'var(--green)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

function fmt(n) { return (n || 0).toLocaleString('fr-FR'); }
