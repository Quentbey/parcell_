// ============================================================
// cities_loader.js — Chargement dynamique des villes depuis Supabase
// Remplace le fichier data.js statique
// ============================================================

// ── État global ──────────────────────────────────────────────
let VILLES = [];
let VILLES_PAR_REGION = {};
let VILLES_PAR_DEPT = {};
let _citiesLoaded = false;
let _selectedVilles = [];   // villes sélectionnées dans l'onglet Analyse
let _sortCol = null;
let _sortAsc = true;

// ── Chargement depuis Supabase ────────────────────────────────
async function loadCitiesFromSupabase() {
  if (_citiesLoaded) return VILLES;
  try {
    const { data, error } = await supabaseClient
      .from('cities')
      .select('*')
      .eq('actif', true)
      .order('nom', { ascending: true });

    if (error) throw error;

    VILLES = (data || []).map(c => ({
      // Identifiants
      Ville: c.nom,
      code_insee: c.code_insee,
      // Géo
      Dept: c.dept_code,
      Département: c.departement,
      Région: c.region,
      lat: parseFloat(c.lat) || 0,
      lon: parseFloat(c.lon) || 0,
      // Populations
      '2022': c.pop_2022 || 0,
      Pop_2015: c.pop_2015 || 0,
      Pop_2011: c.pop_2011 || 0,
      Pop_1999: c.pop_1999 || 0,
      Pop_1990: c.pop_1990 || 0,
      Pop_1982: c.pop_1982 || 0,
      Pop_1970: c.pop_1970 || 0,
      // Prix
      Prix_m2: parseFloat(c.prix_m2_apt) || 0,
      Prix_m2_Apt: parseFloat(c.prix_m2_apt) || 0,
      Prix_m2_Msn: parseFloat(c.prix_m2_msn) || 0,
      // Loyers
      Loyer_m2_Apt: parseFloat(c.loyer_m2_apt) || 0,
      Loyer_m2_Msn: parseFloat(c.loyer_m2_msn) || 0,
      // Socio-éco
      Salaire_Median: parseFloat(c.salaire_median) || 0,
      Age_Median: parseFloat(c.age_median) || 0,
      // Scores
      Attractivite: parseFloat(c.attractivite) || 0,
      Tension: parseFloat(c.tension_loc) || 0,
      // Meta
      source_prix: c.source_prix || 'DVF',
      source_loyer: c.source_loyer || 'estimé',
    }));

    // Indexation par région et département
    VILLES_PAR_REGION = {};
    VILLES_PAR_DEPT = {};
    VILLES.forEach(v => {
      if (!VILLES_PAR_REGION[v.Région]) VILLES_PAR_REGION[v.Région] = [];
      VILLES_PAR_REGION[v.Région].push(v);
      if (!VILLES_PAR_DEPT[v.Dept]) VILLES_PAR_DEPT[v.Dept] = [];
      VILLES_PAR_DEPT[v.Dept].push(v);
    });

    _citiesLoaded = true;
    console.log(`✅ ${VILLES.length} villes chargées depuis Supabase`);
    return VILLES;

  } catch (err) {
    console.error('❌ Erreur chargement villes depuis Supabase:', err);
    // Affiche un message dans l'UI si disponible
    const tableEmpty = document.getElementById('tableEmpty');
    if (tableEmpty) {
      tableEmpty.textContent = 'Impossible de charger les villes. Vérifiez votre connexion.';
    }
    return [];
  }
}

// ── Selects Région / Département (onglet Analyse) ─────────────
function populateRegionDeptSelects() {
  const regionSel = document.getElementById('regionSel');
  const deptSel   = document.getElementById('deptSel');
  if (!regionSel || !deptSel) return;

  const regions = [...new Set(VILLES.map(v => v.Région))].sort();
  regionSel.innerHTML = '<option value="">Toutes les régions</option>';
  regions.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    regionSel.appendChild(opt);
  });

  _populateDeptSelectFrom(VILLES);
}

function _populateDeptSelectFrom(villes) {
  const deptSel = document.getElementById('deptSel');
  if (!deptSel) return;
  const depts = [...new Map(villes.map(v => [v.Dept, v.Département])).entries()]
    .sort((a, b) => a[0].localeCompare(b[0]));
  deptSel.innerHTML = '<option value="">Tous les départements</option>';
  depts.forEach(([code, nom]) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = `${code} — ${nom}`;
    deptSel.appendChild(opt);
  });
}

// ── Handlers filtres région/département ──────────────────────
function onRegionChange() {
  const region = document.getElementById('regionSel')?.value || '';
  const filtered = region ? VILLES.filter(v => v.Région === region) : VILLES;
  _populateDeptSelectFrom(filtered);
  onDeptChange();
}

function onDeptChange() {
  const region = document.getElementById('regionSel')?.value || '';
  const dept   = document.getElementById('deptSel')?.value || '';
  let villes = VILLES;
  if (region) villes = villes.filter(v => v.Région === region);
  if (dept)   villes = villes.filter(v => v.Dept === dept);
  _updateCityDropdownSource(villes);
}

// ── Dropdown recherche ville (onglet Analyse) ─────────────────
let _cityDropdownSource = [];

function _updateCityDropdownSource(villes) {
  _cityDropdownSource = villes;
  const input = document.getElementById('citySearch');
  if (input) onCityInput();
}

function onCityInput() {
  const input = document.getElementById('citySearch');
  if (!input) return;
  const q = input.value.trim().toLowerCase();
  const source = _cityDropdownSource.length ? _cityDropdownSource : VILLES;
  const filtered = q
    ? source.filter(v => v.Ville.toLowerCase().startsWith(q)).slice(0, 30)
    : source.slice(0, 30);
  renderCityDropdown(filtered);
}

function renderCityDropdown(villes) {
  const dd = document.getElementById('cityDropdown');
  if (!dd) return;
  if (!villes.length) { dd.style.display = 'none'; return; }
  dd.style.display = 'block';
  dd.innerHTML = villes.map(v =>
    `<div style="padding:8px 12px;cursor:pointer;font-size:13px;color:var(--text);border-bottom:1px solid var(--border2);"
      onmousedown="addVille('${v.Ville.replace(/'/g,"\\'")}');document.getElementById('citySearch').value='';"
      onmouseover="this.style.background='var(--bg3)'"
      onmouseout="this.style.background=''"
    >${v.Ville} <span style="color:var(--text3);font-size:11px;">${v.Dept}</span></div>`
  ).join('');
}

function showCityDropdown() {
  const source = _cityDropdownSource.length ? _cityDropdownSource : VILLES;
  renderCityDropdown(source.slice(0, 30));
}

function hideCityDropdown() {
  setTimeout(() => {
    const dd = document.getElementById('cityDropdown');
    if (dd) dd.style.display = 'none';
  }, 200);
}

function addVille(nom) {
  const v = VILLES.find(x => x.Ville === nom);
  if (!v) return;
  if (_selectedVilles.find(x => x.Ville === nom)) return; // déjà ajoutée
  _selectedVilles.push(v);
  renderAnalyseView();
}

function removeVille(nom) {
  _selectedVilles = _selectedVilles.filter(v => v.Ville !== nom);
  renderAnalyseView();
}

// ── Render complet de la vue Analyse ─────────────────────────
function renderAnalyseView() {
  renderChips();
  renderKPICards();
  renderRanking();
  renderTable();
  if (typeof updateMapMarkers === 'function') updateMapMarkers(_selectedVilles);
  if (typeof renderCharts === 'function') renderCharts(_selectedVilles);
}

// ── Chips villes sélectionnées ────────────────────────────────
function renderChips() {
  const section = document.getElementById('chipsSection');
  const wrap    = document.getElementById('chipsWrap');
  if (!section || !wrap) return;

  if (!_selectedVilles.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  wrap.innerHTML = _selectedVilles.map(v =>
    `<div class="chip" onclick="removeVille('${v.Ville.replace(/'/g,"\\'")}')">
      ${v.Ville} <span style="opacity:.6;margin-left:4px;">×</span>
    </div>`
  ).join('');
}

// ── KPI Cards ─────────────────────────────────────────────────
function renderKPICards() {
  const el = document.getElementById('kpiCards');
  if (!el) return;
  if (!_selectedVilles.length) {
    el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:12px 0;">Sélectionnez des villes pour afficher les KPIs.</div>';
    return;
  }
  const avgPrix = Math.round(_selectedVilles.reduce((s, v) => s + v.Prix_m2, 0) / _selectedVilles.length);
  const avgLoyer = (_selectedVilles.reduce((s, v) => s + v.Loyer_m2_Apt, 0) / _selectedVilles.length).toFixed(2);
  const avgTension = (_selectedVilles.reduce((s, v) => s + v.Tension, 0) / _selectedVilles.length).toFixed(1);
  const avgAttr = (_selectedVilles.reduce((s, v) => s + v.Attractivite, 0) / _selectedVilles.length).toFixed(1);

  el.innerHTML = [
    { label: 'Prix m² moyen', value: `${fmt(avgPrix)} €`, sub: 'appartement', icon: '🏷️' },
    { label: 'Loyer m² moyen', value: `${avgLoyer} €`, sub: 'charges comprises estimées', icon: '💶' },
    { label: 'Tension locative', value: `${avgTension}/10`, sub: 'moyenne villes select.', icon: '🔥' },
    { label: 'Attractivité', value: `${avgAttr}/10`, sub: 'score composite', icon: '⭐' },
  ].map(k => `
    <div class="kpi-card">
      <div class="kpi-icon">${k.icon}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>
  `).join('');
}

// ── Classement attractivité ───────────────────────────────────
function renderRanking() {
  const el = document.getElementById('attrRanking');
  if (!el) return;
  const source = _selectedVilles.length ? _selectedVilles : VILLES.slice(0, 15);
  const sorted = [...source].sort((a, b) => b.Attractivite - a.Attractivite).slice(0, 12);
  const max = sorted[0]?.Attractivite || 10;
  el.innerHTML = sorted.map((v, i) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <span style="width:18px;text-align:right;font-size:11px;color:var(--text3);">${i+1}</span>
      <span style="flex:1;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${v.Ville}</span>
      <div style="width:90px;background:var(--bg3);border-radius:4px;height:6px;flex-shrink:0;">
        <div style="width:${(v.Attractivite/max*100).toFixed(0)}%;background:var(--teal);height:6px;border-radius:4px;"></div>
      </div>
      <span style="width:32px;text-align:right;font-size:12px;font-weight:600;color:var(--teal);">${v.Attractivite}</span>
    </div>
  `).join('');
}

// ── Tableau comparatif ────────────────────────────────────────
function sortByCol(col) {
  if (_sortCol === col) _sortAsc = !_sortAsc;
  else { _sortCol = col; _sortAsc = true; }
  renderTable();
}

function renderTable() {
  const table  = document.getElementById('mainTable');
  const empty  = document.getElementById('tableEmpty');
  const tbody  = document.getElementById('tableBody');
  if (!table || !tbody) return;

  if (!_selectedVilles.length) {
    table.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }
  table.style.display = 'table';
  if (empty) empty.style.display = 'none';

  // Sort
  let rows = [..._selectedVilles];
  if (_sortCol) {
    rows.sort((a, b) => {
      const va = a[_sortCol] ?? a['2022'];
      const vb = b[_sortCol] ?? b['2022'];
      if (typeof va === 'string') return _sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return _sortAsc ? va - vb : vb - va;
    });
  }

  // Reset header arrows
  document.querySelectorAll('#mainTable th').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
  });
  if (_sortCol) {
    const thEl = document.getElementById(`th-${_sortCol}`);
    if (thEl) thEl.classList.add(_sortAsc ? 'sorted-asc' : 'sorted-desc');
  }

  tbody.innerHTML = rows.map(v => `
    <tr onclick="removeVille('${v.Ville.replace(/'/g,"\\'")}');" style="cursor:pointer;">
      <td style="font-weight:600;">${v.Ville}</td>
      <td>${v.Dept}</td>
      <td>${fmt(v['2022'])}</td>
      <td>${fmt(v.Prix_m2)} €</td>
      <td>${v.Loyer_m2_Apt ? v.Loyer_m2_Apt.toFixed(2) + ' €' : '—'}</td>
      <td>
        <span style="display:inline-block;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;
          background:${v.Tension >= 7 ? 'rgba(248,113,113,0.15)' : v.Tension >= 5 ? 'rgba(201,168,76,0.15)' : 'rgba(52,211,153,0.15)'};
          color:${v.Tension >= 7 ? 'var(--red,#f87171)' : v.Tension >= 5 ? 'var(--gold)' : 'var(--teal)'}">
          ${v.Tension}/10
        </span>
      </td>
      <td>
        <span style="display:inline-block;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;
          background:rgba(52,211,153,0.1);color:var(--teal)">
          ${v.Attractivite}/10
        </span>
      </td>
    </tr>
  `).join('');
}

// ── Select Ville simulateur ────────────────────────────────────
function populateSimVilleSelect() {
  const sel = document.getElementById('simVille');
  if (!sel) return;

  sel.innerHTML = '';
  VILLES.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.Ville;
    opt.textContent = `${v.Ville} (${v.Dept})`;
    sel.appendChild(opt);
  });

  // Ville par défaut
  const defaultCity = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.defaultCity) || 'Lyon';
  const match = [...sel.options].find(o => o.value === defaultCity);
  if (match) sel.value = defaultCity;
}

// ── renderAll : point d'entrée appelé par initApp ─────────────
function renderAll() {
  populateRegionDeptSelects();
  _cityDropdownSource = [...VILLES];
  renderAnalyseView();
}
