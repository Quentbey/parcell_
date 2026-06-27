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
  // Précharge les projets uniquement si connecté
  if (typeof currentUser !== 'undefined' && currentUser) loadProjects();
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
  const exemples = [
    { ville:'Lyon', dept:'Rhône (69)', pop:'522 000 hab.', prix:'5 100', loyer:'17,5', tension:'9,2', rdt:'4,1' },
    { ville:'Saint-Étienne', dept:'Loire (42)', pop:'170 000 hab.', prix:'1 200', loyer:'9,8', tension:'7,5', rdt:'8,1' },
    { ville:'Bordeaux', dept:'Gironde (33)', pop:'259 000 hab.', prix:'4 800', loyer:'15,0', tension:'8,8', rdt:'4,5' },
  ];
  const card = e => `<div style="background:var(--card2);border:1px solid var(--border2);border-radius:var(--radius);padding:20px;">
    <div style="font-family:'Outfit',sans-serif;font-weight:700;font-size:17px;margin-bottom:3px;">${e.ville}</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:16px;">${e.dept} · ${e.pop}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:2px;">Prix m²</div><div style="font-family:'Outfit',sans-serif;font-weight:700;font-size:18px;color:var(--text);">${e.prix} €</div></div>
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:2px;">Loyer m²</div><div style="font-family:'Outfit',sans-serif;font-weight:700;font-size:18px;color:var(--teal);">${e.loyer} €</div></div>
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:2px;">Tension</div><div style="font-family:'Outfit',sans-serif;font-weight:700;font-size:18px;color:var(--gold);">${e.tension}/10</div></div>
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:2px;">Rdt brut</div><div style="font-family:'Outfit',sans-serif;font-weight:700;font-size:18px;color:var(--green);">${e.rdt} %</div></div>
    </div>
  </div>`;
  return `
<div id="tab-analyse" class="tab-content active">
  <div style="max-width:920px;margin:24px auto;">
    <!-- Hero "Bientôt disponible" -->
    <div style="text-align:center;padding:64px 32px 56px;background:linear-gradient(135deg,var(--card),var(--card2));border:1px solid var(--border2);border-radius:24px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-180px;left:50%;transform:translateX(-50%);width:520px;height:520px;background:radial-gradient(circle,rgba(45,212,191,0.18) 0%,rgba(201,168,76,0.05) 40%,transparent 65%);pointer-events:none;"></div>
      <div style="position:relative;z-index:2;">
        <div style="width:92px;height:92px;margin:0 auto 28px;border-radius:24px;background:linear-gradient(135deg,rgba(45,212,191,0.25),rgba(45,212,191,0.05));border:1px solid rgba(45,212,191,0.35);display:flex;align-items:center;justify-content:center;box-shadow:0 16px 40px rgba(45,212,191,0.15);">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3v18h18"/><path d="M7 14l3 -3 4 4 5 -7"/>
          </svg>
        </div>
        <h1 style="font-family:'Outfit',sans-serif;font-size:clamp(28px,4.5vw,40px);font-weight:800;letter-spacing:-0.02em;margin-bottom:14px;">Analyse comparative des villes</h1>
        <div style="display:inline-flex;align-items:center;gap:10px;padding:7px 18px;background:rgba(45,212,191,0.15);border:1px solid rgba(45,212,191,0.32);border-radius:30px;font-size:13px;color:var(--teal);font-weight:700;margin-bottom:22px;text-transform:uppercase;letter-spacing:0.08em;">
          <span style="width:8px;height:8px;border-radius:50%;background:var(--teal);box-shadow:0 0 12px var(--teal);"></span>
          Bientôt disponible
        </div>
        <p style="color:var(--text2);font-size:16px;line-height:1.65;max-width:560px;margin:0 auto 32px;">
          Comparez prix au m², loyers réels, tension locative et score d'attractivité de centaines de villes françaises. Carte interactive, tableaux comparatifs et graphiques pour repérer les meilleures opportunités d'investissement.
        </p>
        <a href="/#newsletter" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:10px;padding:14px 28px;background:linear-gradient(135deg,var(--gold),var(--gold2));color:#0a0d14;border-radius:12px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 8px 28px rgba(201,168,76,0.22);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>
          M'informer quand c'est en ligne
        </a>
      </div>
    </div>

    <!-- Apercu : 3 villes en exemple -->
    <div style="margin-top:48px;">
      <div style="text-align:center;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.12em;font-weight:700;margin-bottom:22px;">Aperçu de ce qui arrive</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">
        ${exemples.map(card).join('')}
      </div>
    </div>
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

  <div style="display:flex;justify-content:center;margin-bottom:18px;">
    <button class="import-btn" disabled title="Fonctionnalité IA en cours de développement" style="opacity:0.6;cursor:not-allowed;display:inline-flex;align-items:center;gap:8px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
      Importer une annonce (bientôt disponible)
    </button>
  </div>

  <div class="section"><div class="sim-layout">
    <div class="card" style="padding:24px;">
      <div class="input-block" style="position:relative;"><label>Ville</label>
        <input class="field" type="text" id="simVille" autocomplete="off" placeholder="Tapez une ville (ex: Lyon)" oninput="onSimVilleInput()" onfocus="onSimVilleInput()" onblur="hideSimVilleDropdown()">
        <div id="simVilleDropdown" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;max-height:260px;overflow-y:auto;background:var(--card2);border:1px solid var(--border2);border-radius:var(--radius-sm);z-index:30;box-shadow:0 8px 24px rgba(0,0,0,0.4);"></div>
      </div>

      <!-- Bloc ville personnalisée (apparaît uniquement quand "Ville personnalisée" est choisie) -->
      <div class="input-block" id="customCityBlock" style="display:none;background:rgba(201,168,76,0.05);border:1px solid rgba(201,168,76,0.2);border-radius:var(--radius-sm);padding:14px;margin-top:-4px;">
        <div style="font-size:12px;color:var(--gold);font-weight:600;margin-bottom:10px;">✦ Paramètres de la ville personnalisée</div>
        <div class="input-row" style="display:flex;gap:12px;">
          <div style="flex:1;">
            <label style="font-size:11px;color:var(--text2);">Loyer (€/m²)</label>
            <input class="field" type="number" id="customLoyer" value="12" step="0.5" min="0" oninput="updateSimLoyer()">
          </div>
          <div style="flex:1;">
            <label style="font-size:11px;color:var(--text2);">Tension locative : <span id="customTensionVal" class="range-val">5/10</span></label>
            <input type="range" id="customTension" min="1" max="10" step="1" value="5" oninput="document.getElementById('customTensionVal').textContent=this.value+'/10';updateSimLoyer()">
          </div>
        </div>
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
        <div class="input-block"><label>Colocation <span style="color:var(--text3);font-size:11px;">· loyer ajusté automatiquement</span></label>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <div class="toggle-group" style="flex:1;min-width:220px;">
              <button class="toggle-btn active" id="btnColocOff" onclick="setColoc(false)">🛏️ Location classique</button>
              <button class="toggle-btn" id="btnColocOn" onclick="setColoc(true)">👥 Colocation</button>
            </div>
            <div id="colocCountWrap" style="display:none;align-items:center;gap:6px;">
              <span style="font-size:11px;color:var(--text3);">Colocs :</span>
              <select id="simColocN" class="field" style="width:64px;padding:5px 7px;font-size:13px;" onchange="setColocN(this.value)">
                <option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5+</option>
              </select>
              <span id="colocBonusInfo" style="font-size:11px;color:var(--teal);font-weight:600;"></span>
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
            <label class="checkbox-item" id="opt-parking_ext" onclick="toggleOpt('parking_ext',this)"><input type="checkbox" id="cb-parking_ext" style="pointer-events:none;"> 🅿️ Place de parking / extérieur</label>
            <label class="checkbox-item" id="opt-garage" onclick="toggleOpt('garage',this)"><input type="checkbox" id="cb-garage" style="pointer-events:none;"> 🚗 Garage / Box fermé</label>
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
        <div class="input-block"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="opt-pret" checked onchange="setSimOption('pret', this.checked)" style="width:16px;height:16px;cursor:pointer;accent-color:var(--gold);"><span>Financer par un prêt bancaire</span></label></div>
        <div class="input-block"><label>Apport personnel (€)</label><div class="field-prefix-wrap"><span class="field-prefix">€</span><input class="field" type="number" id="simApport" value="20000" oninput="syncField('simApportS','simApport');calcSim()"></div></div>
        <div class="input-block"><label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="opt-duree" checked onchange="setSimOption('duree', this.checked)" style="width:14px;height:14px;cursor:pointer;accent-color:var(--gold);"><span>Durée du prêt : <span id="dureeVal" class="range-val">20 ans</span></span></label><input type="range" id="simDuree" min="10" max="25" value="20" oninput="document.getElementById('dureeVal').textContent=this.value+' ans';calcSim()"></div>
        <div class="input-block"><label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="opt-taux" checked onchange="setSimOption('taux', this.checked)" style="width:14px;height:14px;cursor:pointer;accent-color:var(--gold);"><span>Taux d'intérêt : <span id="tauxVal" class="range-val">3.6%</span></span></label><input type="range" id="simTaux" min="1" max="7" step="0.1" value="3.6" oninput="document.getElementById('tauxVal').textContent=parseFloat(this.value).toFixed(1)+'%';calcSim()"></div>
        <div class="input-block"><label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="opt-assurance" checked onchange="setSimOption('assurance', this.checked)" style="width:14px;height:14px;cursor:pointer;accent-color:var(--gold);"><span>Assurance emprunteur : <span id="assurVal" class="range-val">0.20%</span></span></label><input type="range" id="simAssur" min="0.10" max="0.50" step="0.01" value="0.20" oninput="document.getElementById('assurVal').textContent=parseFloat(this.value).toFixed(2)+'%';calcSim()"></div>
        <div class="input-block"><label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="opt-vacance" checked onchange="setSimOption('vacance', this.checked)" style="width:14px;height:14px;cursor:pointer;accent-color:var(--gold);"><span>Vacance locative : <span id="vacanceVal" class="range-val">1 mois/an</span></span></label><input type="range" id="simVacance" min="0" max="3" step="0.5" value="1" oninput="document.getElementById('vacanceVal').textContent=this.value+' mois/an';calcSim()"></div>
        <div class="input-block"><label>Charges copro (€/mois)</label><div class="field-prefix-wrap"><span class="field-prefix">€</span><input class="field" type="number" id="simCopro" value="0" data-prev="0" oninput="onSimCoproChange()"></div></div>
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
          <label id="ccToggleWrap" style="display:none;align-items:center;gap:6px;font-size:11px;color:var(--text2);margin-top:8px;cursor:pointer;">
            <input type="checkbox" id="optChargesInLoyer" onchange="setChargesInLoyer(this.checked)" style="cursor:pointer;accent-color:var(--gold);width:13px;height:13px;">
            Inclure les charges (CC)
          </label>
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
      <div onclick="openDrawer('marche')" id="marketCard" style="cursor:pointer;background:linear-gradient(135deg,rgba(45,212,191,0.08),rgba(201,168,76,0.05));border:1px solid rgba(45,212,191,0.25);border-radius:var(--radius);padding:14px 16px;margin:14px 0 12px;display:flex;align-items:center;gap:14px;transition:all 0.2s;">
        <div style="width:42px;height:42px;border-radius:10px;background:rgba(45,212,191,0.15);border:1px solid rgba(45,212,191,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:2px;">Marché local et tension locative</div>
          <div style="font-size:11.5px;color:var(--text2);" id="marketCardHint">Prix m², loyer de référence, attractivité de la ville</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <button class="save-btn" onclick="currentUser ? openSaveModal() : showAuthModal('login')">
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
      <div class="compte-nav-item" id="cnav-admin" onclick="showCompteSection('admin')" style="display:none;color:var(--gold);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Administration</div>
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
          <div style="font-size:12px;color:var(--text2);line-height:1.8;margin-bottom:14px;">✅ Tout du gratuit · ✅ Projets illimités · ✅ Mode Pro · ✅ Export PDF · ✅ Alertes prix · ✅ DVF réel</div>
          <button style="padding:10px 20px;background:var(--gold);border:none;border-radius:8px;color:#0a0d14;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:not-allowed;opacity:0.6;">Bientôt disponible</button>
        </div>
      </div>
      <div id="csection-admin" class="compte-section" style="display:none;">
        <div class="compte-section-title">🛡️ Administration</div>
        <div id="adminPanel" style="font-size:13px;color:var(--text3);">Chargement…</div>
      </div>
    </div>
  </div>
</div>`;
}

// ── Écran invité dans Mon Espace ──
function renderGuestCompteOverlay() {
  const main = document.querySelector('#tab-compte .compte-main');
  if (!main || currentUser) return;
  main.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                min-height:340px;text-align:center;padding:40px 24px;">
      <div style="font-size:48px;margin-bottom:16px;">🔐</div>
      <div style="font-family:'Outfit',sans-serif;font-size:20px;font-weight:700;
                  color:var(--text);margin-bottom:10px;">Espace personnel</div>
      <div style="font-size:14px;color:var(--text3);max-width:320px;line-height:1.6;margin-bottom:28px;">
        Connectez-vous pour sauvegarder vos projets, accéder à votre profil
        et retrouver vos simulations depuis n'importe quel appareil.
      </div>
      <button onclick="showAuthModal('login')"
        style="padding:12px 28px;background:linear-gradient(135deg,#c9a84c,#e8c97a);
               border:none;border-radius:10px;color:#0a0d14;font-family:'DM Sans',sans-serif;
               font-size:14px;font-weight:700;cursor:pointer;transition:opacity 0.2s;
               margin-bottom:12px;letter-spacing:0.01em;"
        onmouseover="this.style.opacity='.9'" onmouseout="this.style.opacity='1'">
        Se connecter
      </button>
      <div style="font-size:13px;color:var(--text3);">
        Pas de compte ?
        <span onclick="showAuthModal('signup')"
          style="color:var(--gold,#c9a84c);cursor:pointer;font-weight:600;">
          Créer un compte gratuit →
        </span>
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
  if (tab === 'compte') {
    if (!currentUser) {
      // Invité : afficher l'écran de connexion à la place du contenu
      renderGuestCompteOverlay();
    } else {
      populateProfileForm();
      showCompteSection('projets');
    }
  }
}

// ── Compte sections ──
function showCompteSection(section) {
  ['projets','profil','notifs','abonnement','admin'].forEach(s => {
    const el  = document.getElementById('csection-' + s);
    const nav = document.getElementById('cnav-' + s);
    if (el) el.style.display = s === section ? 'block' : 'none';
    if (nav) nav.classList.toggle('active', s === section);
  });
  if (section === 'projets') renderProjets();
  if (section === 'admin' && typeof loadAdminData === 'function') loadAdminData();
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
  const ci = document.getElementById('profileCity');      if (ci) ci.value = currentProfile.preferences?.city || '';
  const ph = document.getElementById('profilePhone');     if (ph) ph.value = currentProfile.preferences?.phone || '';
  const ob = document.getElementById('profileObjectif');  if (ob) ob.value = currentProfile.preferences?.objectif || 'cashflow';
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
