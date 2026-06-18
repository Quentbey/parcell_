// ============================================================
// projects.js — Gestion des projets (Supabase)
// ============================================================

let savedProjects = [];

// ── Charge les projets depuis Supabase ──
async function loadProjects() {
  if (!currentUser) return [];
  const { data, error } = await supabaseClient
    .from('projects')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('loadProjects:', error); return []; }
  savedProjects = data || [];
  updateProjectCount();
  return savedProjects;
}

// ── Sauvegarde un projet ──
async function saveProjectToDB(projectData) {
  if (!currentUser) { showToast('Connectez-vous pour sauvegarder'); return null; }

  // Vérifie limite plan gratuit
  if (savedProjects.length >= APP_CONFIG.maxProjectsFree && currentProfile?.plan === 'free') {
    showToast('Limite de 5 projets atteinte — passez en Pro', 'warn');
    return null;
  }

  const payload = {
    user_id: currentUser.id,
    name: projectData.name,
    note: projectData.note || null,
    status: 'etude',
    ville: projectData.ville,
    quartier: projectData.quartier || null,
    type_bien: projectData.type,
    surface: projectData.surface,
    pieces: projectData.pieces,
    prix_achat: projectData.prix,
    loyer_mensuel: projectData.loyer,
    meuble: projectData.meuble,
    // KPIs calculés (snapshot)
    rent_brute: projectData.rentBrute,
    rent_nette: projectData.rentNette,
    mensualite: projectData.mensualite,
    cashflow: projectData.cashflow,
    // Tous les paramètres du simulateur
    params: projectData.params || {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient.from('projects').insert(payload).select().single();
  if (error) {
    console.error('saveProject error:', error, 'payload:', payload);
    const msg = error.message || error.code || error.details || 'erreur inconnue';
    showToast('Erreur sauvegarde : ' + msg, 'err');
    return null;
  }

  savedProjects.unshift(data);
  updateProjectCount();
  return data;
}

// ── Met à jour le statut d'un projet ──
async function updateProjectStatus(projectId, status) {
  const { error } = await supabaseClient
    .from('projects')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .eq('user_id', currentUser.id);
  if (error) { showToast('Erreur mise à jour', 'err'); return; }
  const p = savedProjects.find(x => x.id === projectId);
  if (p) p.status = status;
  renderProjets();
}

// ── Supprime un projet ──
async function deleteProjectFromDB(projectId) {
  const { error } = await supabaseClient
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', currentUser.id);
  if (error) { showToast('Erreur suppression', 'err'); return; }
  savedProjects = savedProjects.filter(p => p.id !== projectId);
  updateProjectCount();
  renderProjets();
  showToast('Projet supprimé');
}

// ── Génère un lien de partage ──
async function shareProject(projectId) {
  const project = savedProjects.find(p => p.id === projectId);
  if (!project) return;

  // Crée un token de partage public dans Supabase
  const shareToken = crypto.randomUUID();
  const { error } = await supabaseClient
    .from('projects')
    .update({ share_token: shareToken, shared: true, updated_at: new Date().toISOString() })
    .eq('id', projectId);

  if (error) { showToast('Erreur création du lien', 'err'); return; }

  const shareUrl = `${window.location.origin}/?share=${shareToken}`;
  await navigator.clipboard.writeText(shareUrl).catch(() => {});
  showToast('Lien copié ! 🔗');
  project.share_token = shareToken;
  project.shared = true;
}

// ── Met à jour le compteur de projets dans la sidebar ──
function updateProjectCount() {
  const el = document.getElementById('stat-projets');
  if (el) el.textContent = savedProjects.length;
}

// ══════════════════════════════════════════
// RENDER — Interface projets
// ══════════════════════════════════════════

const STATUS_CONFIG = {
  etude:    { label: 'En étude',    color: 'var(--teal)',  icon: '🔍' },
  visite:   { label: 'Visité',      color: 'var(--gold)',  icon: '👀' },
  offre:    { label: 'Offre faite', color: '#818cf8',      icon: '✉️' },
  acquis:   { label: 'Acquis',      color: 'var(--green)', icon: '✅' },
  abandonne:{ label: 'Abandonné',   color: 'var(--red)',   icon: '❌' },
};

// Echappement HTML (anti-XSS) puis detection des URLs pour les rendre cliquables.
function escapeHtml(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function linkify(text){
  if (!text) return '';
  return escapeHtml(text).replace(
    /(https?:\/\/[^\s<>"']+|www\.[a-z0-9.\-]+\.[a-z]{2,}[^\s<>"']*)/gi,
    function(m){
      const href = m.toLowerCase().startsWith('www.') ? 'http://' + m : m;
      return '<a href="' + href + '" target="_blank" rel="noopener noreferrer" style="color:var(--teal);text-decoration:underline;word-break:break-all;">' + m + '</a>';
    }
  );
}

// ─── Comparaison de projets ───
let compareMode = false;
const compareSelected = new Set();
let compareCriteria = [];

const COMPARE_CRITERIA = [
  { key:'ville',      label:'Ville',         defaut:true,  get:p => (p.ville||'—') + (p.quartier?' · '+p.quartier:'') },
  { key:'type',       label:'Type de bien',  defaut:true,  get:p => p.type_bien==='Apt'?'Appartement':'Maison' },
  { key:'surface',    label:'Surface',       defaut:true,  get:p => (p.surface||0)+' m²' },
  { key:'pieces',     label:'Pièces',        defaut:true,  get:p => (p.pieces||'—')+' P' },
  { key:'prix',       label:"Prix d'achat",  defaut:true,  get:p => Math.round(p.prix_achat||0).toLocaleString('fr-FR')+' €' },
  { key:'loyer',      label:'Loyer mensuel', defaut:true,  get:p => Math.round(p.loyer_mensuel||0).toLocaleString('fr-FR')+' €' },
  { key:'rentBrute',  label:'Rentabilité brute', defaut:true, get:p => p.rent_brute||'—' },
  { key:'rentNette',  label:'Rentabilité nette', defaut:true, get:p => p.rent_nette||'—' },
  { key:'mensualite', label:'Mensualité',    defaut:true,  get:p => Math.round(p.mensualite||0).toLocaleString('fr-FR')+' €' },
  { key:'cashflow',   label:'Cashflow',      defaut:true,
      get:p => { const cf=parseFloat(p.cashflow)||0; return (cf>=0?'+':'')+Math.round(cf).toLocaleString('fr-FR')+' €'; },
      color:p => parseFloat(p.cashflow)>=0?'var(--green)':'var(--red)' },
  { key:'status',     label:'Statut',        defaut:false, get:p => (STATUS_CONFIG[p.status]?.label)||p.status||'—' },
  { key:'meuble',     label:'Meublé',        defaut:false, get:p => p.meuble?'Oui':'Non' },
  { key:'duree',      label:'Durée du prêt', defaut:false, get:p => (p.params?.duree||'—')+' ans' },
  { key:'taux',       label:"Taux d'intérêt",defaut:false, get:p => (p.params?.taux||'—')+' %' },
  { key:'apport',     label:'Apport',        defaut:false, get:p => p.params?.apport ? Math.round(parseFloat(p.params.apport)).toLocaleString('fr-FR')+' €' : '—' },
  { key:'coloc',      label:'Colocation',    defaut:false, get:p => (parseInt(p.params?.coloc)||0) >= 2 ? p.params.coloc+' colocs' : 'Non' },
  { key:'created',    label:'Créé le',       defaut:false, get:p => new Date(p.created_at).toLocaleDateString('fr-FR') },
  { key:'note',       label:'Note',          defaut:false, get:p => p.note ? linkify(p.note) : '—', raw:true },
];

function loadCompareCriteria(){
  try { const s=localStorage.getItem('parcell:compareCriteria'); if(s) compareCriteria=JSON.parse(s); } catch(_){}
  if(!compareCriteria.length) compareCriteria = COMPARE_CRITERIA.filter(c=>c.defaut).map(c=>c.key);
}
function saveCompareCriteria(){ try { localStorage.setItem('parcell:compareCriteria', JSON.stringify(compareCriteria)); } catch(_){} }

function toggleCompareMode(){
  compareMode = !compareMode;
  compareSelected.clear();
  renderProjets();
}
function toggleProjectInCompare(id, event){
  if(event) event.stopPropagation();
  if(compareSelected.has(id)) compareSelected.delete(id); else compareSelected.add(id);
  renderProjets();
}
function showComparison(){
  loadCompareCriteria();
  if(compareSelected.size < 2){ if(typeof showToast==='function') showToast('Sélectionnez au moins 2 projets'); return; }
  const grid = document.getElementById('projetsGrid'); if(!grid) return;
  grid.style.gridTemplateColumns = '1fr';
  grid.innerHTML = renderComparisonHTML();
}
function exitComparison(){
  compareMode = false; compareSelected.clear();
  const grid = document.getElementById('projetsGrid'); if(grid) grid.style.gridTemplateColumns = '';
  renderProjets();
}
function addCompareCriterion(key){
  if(!key || compareCriteria.includes(key)) return;
  compareCriteria.push(key); saveCompareCriteria(); showComparison();
}
function removeCompareCriterion(key){
  compareCriteria = compareCriteria.filter(k => k!==key); saveCompareCriteria(); showComparison();
}

function renderComparisonHTML(){
  const projects = savedProjects.filter(p => compareSelected.has(p.id));
  const cols = compareCriteria.map(k => COMPARE_CRITERIA.find(c=>c.key===k)).filter(Boolean);
  const others = COMPARE_CRITERIA.filter(c => !compareCriteria.includes(c.key));
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;gap:12px;flex-wrap:wrap;">
      <button onclick="exitComparison()" class="projet-action-btn" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;">← Retour aux projets</button>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="font-size:13px;color:var(--text2);">${projects.length} projet${projects.length>1?'s':''} comparé${projects.length>1?'s':''} · ${cols.length} critère${cols.length>1?'s':''}</span>
        ${others.length ? `
          <select onchange="addCompareCriterion(this.value);this.value='';" style="background:var(--bg3);color:var(--gold);border:1px solid var(--border2);border-radius:8px;padding:8px 14px;font-size:12px;font-family:'DM Sans',sans-serif;cursor:pointer;font-weight:600;outline:none;">
            <option value="">+ Ajouter un critère</option>
            ${others.map(c => `<option value="${c.key}">${c.label}</option>`).join('')}
          </select>` : ''}
      </div>
    </div>
    <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius);background:var(--card);">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:var(--card2);">
            <th style="text-align:left;padding:14px 16px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Critère</th>
            ${projects.map(p => `<th style="text-align:left;padding:14px 16px;border-bottom:1px solid var(--border);min-width:180px;">
              <div style="font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;color:var(--text);">${p.name||'—'}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:3px;">${(p.ville||'')}${p.quartier?' · '+p.quartier:''}</div>
            </th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${cols.map((c,i) => `
            <tr style="background:${i%2 ? 'rgba(255,255,255,0.015)' : 'transparent'};">
              <td style="padding:11px 16px;font-weight:600;color:var(--text2);border-bottom:1px solid var(--border);">
                <span style="display:inline-flex;align-items:center;gap:8px;">
                  ${c.label}
                  <button onclick="removeCompareCriterion('${c.key}')" title="Retirer ce critère" style="background:none;border:none;color:var(--text3);font-size:16px;cursor:pointer;opacity:0.4;line-height:1;padding:0 4px;" onmouseover="this.style.opacity='1';this.style.color='var(--red)'" onmouseout="this.style.opacity='0.4';this.style.color='var(--text3)'">×</button>
                </span>
              </td>
              ${projects.map(p => {
                const val = c.get(p);
                const color = c.color ? c.color(p) : 'var(--text)';
                const weight = c.color ? 600 : 400;
                return `<td style="padding:11px 16px;border-bottom:1px solid var(--border);color:${color};font-weight:${weight};">${val}</td>`;
              }).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function renderProjets() {
  const grid = document.getElementById('projetsGrid');
  if (!grid) return;

  // Charge depuis Supabase si pas encore fait
  if (savedProjects.length === 0) await loadProjects();

  if (savedProjects.length === 0) {
    grid.innerHTML = `
      <div class="new-projet-card" onclick="switchTab('simulateur',document.querySelector('.main-tab:nth-child(2)'))">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        <span style="font-size:14px;font-weight:600;">Créer ma première simulation</span>
        <span style="font-size:12px;color:var(--text3);">Aucun projet sauvegardé pour l'instant</span>
      </div>`;
    return;
  }

  // Barre d'actions (mode comparaison)
  const headerBar = `<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px;">
    <div style="font-size:13px;color:var(--text2);">
      ${compareMode
        ? `<strong style="color:var(--gold);">Mode comparaison</strong> · cochez les projets à comparer (${compareSelected.size} sélectionné${compareSelected.size>1?'s':''})`
        : `${savedProjects.length} projet${savedProjects.length>1?'s':''} sauvegardé${savedProjects.length>1?'s':''}`}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${compareMode ? `
        <button onclick="showComparison()" ${compareSelected.size<2?'disabled':''} style="padding:8px 16px;background:linear-gradient(135deg,var(--gold),var(--gold2));border:none;border-radius:8px;color:#0a0d14;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:700;cursor:${compareSelected.size<2?'not-allowed':'pointer'};opacity:${compareSelected.size<2?0.5:1};">Voir la comparaison${compareSelected.size>=2?` (${compareSelected.size})`:''}</button>
        <button onclick="toggleCompareMode()" style="padding:8px 14px;background:transparent;border:1px solid var(--border2);border-radius:8px;color:var(--text2);font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;">Annuler</button>
      ` : `
        <button onclick="toggleCompareMode()" ${savedProjects.length<2?'disabled':''} style="padding:8px 16px;background:rgba(45,212,191,0.12);border:1px solid rgba(45,212,191,0.3);border-radius:8px;color:var(--teal);font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;cursor:${savedProjects.length<2?'not-allowed':'pointer'};opacity:${savedProjects.length<2?0.5:1};display:inline-flex;align-items:center;gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M9 8h6M9 12h6M9 16h6"/></svg>
          Comparer mes projets
        </button>
      `}
    </div>
  </div>`;

  grid.innerHTML = headerBar + savedProjects.map(p => {
    const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.etude;
    const cf = parseFloat(p.cashflow) || 0;
    const cfColor = cf >= 0 ? 'var(--green)' : 'var(--red)';
    const cfStr = (cf >= 0 ? '+' : '') + Math.round(cf) + ' €';
    const selected = compareSelected.has(p.id);
    const cardClick = compareMode ? `toggleProjectInCompare('${p.id}', event)` : `loadProject('${p.id}')`;
    const cardBorder = (compareMode && selected) ? 'border-color:var(--gold);box-shadow:0 0 0 2px rgba(201,168,76,0.25);' : '';
    return `
    <div class="projet-card" style="position:relative;${cardBorder}" onclick="${cardClick}">
      ${compareMode ? `<div style="position:absolute;top:12px;left:12px;width:22px;height:22px;border-radius:6px;border:2px solid ${selected?'var(--gold)':'var(--border2)'};background:${selected?'var(--gold)':'transparent'};display:flex;align-items:center;justify-content:center;z-index:2;">${selected?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0a0d14" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>` : ''}
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span class="projet-card-badge ${p.type_bien === 'Apt' ? 'badge-apt' : 'badge-msn'}">
          ${p.type_bien === 'Apt' ? '🏠 Appartement' : '🏡 Maison'}
        </span>
        <div class="status-dropdown-wrap" onclick="event.stopPropagation()">
          <button class="status-btn" style="color:${st.color};background:${st.color}18;border:1px solid ${st.color}44;padding:3px 9px;border-radius:10px;font-size:11px;font-weight:600;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;" onclick="toggleStatusMenu('${p.id}')">
            ${st.icon} ${st.label}
          </button>
          <div class="status-menu" id="statusMenu_${p.id}" style="display:none;position:absolute;right:0;top:100%;margin-top:4px;background:var(--card2);border:1px solid var(--border2);border-radius:10px;padding:6px;z-index:50;min-width:150px;box-shadow:0 8px 24px rgba(0,0,0,0.4);">
            ${Object.entries(STATUS_CONFIG).map(([key, cfg]) => `
              <div onclick="updateProjectStatus('${p.id}','${key}')" style="padding:7px 10px;border-radius:6px;cursor:pointer;font-size:12px;color:${cfg.color};transition:background 0.15s;" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background=''">
                ${cfg.icon} ${cfg.label}
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="projet-card-ville">${p.name}</div>
      <div class="projet-card-adresse">${p.ville}${p.quartier ? ' · ' + p.quartier : ''} · ${p.surface}m² · ${p.pieces}P ${p.meuble ? '· Meublé' : ''}</div>
      <div class="projet-card-kpis">
        <div class="projet-kpi"><div class="projet-kpi-label">Renta. brute</div><div class="projet-kpi-val" style="color:var(--teal)">${p.rent_brute || '—'}</div></div>
        <div class="projet-kpi"><div class="projet-kpi-label">Mensualité</div><div class="projet-kpi-val">${Math.round(p.mensualite || 0)} €</div></div>
        <div class="projet-kpi"><div class="projet-kpi-label">Cashflow</div><div class="projet-kpi-val" style="color:${cfColor}">${cfStr}</div></div>
      </div>
      <div class="projet-card-footer">
        <span>${new Date(p.created_at).toLocaleDateString('fr-FR', {day:'numeric',month:'short',year:'numeric'})}</span>
        <div class="projet-card-actions" onclick="event.stopPropagation()">
          <button class="projet-action-btn" onclick="shareProject('${p.id}')" title="Copier le lien de partage">🔗</button>
          <button class="projet-action-btn" onclick="loadProject('${p.id}')">Ouvrir</button>
          <button class="projet-action-btn danger" onclick="deleteProjectFromDB('${p.id}')">✕</button>
        </div>
      </div>
      ${p.note ? `<div onclick="event.stopPropagation()" style="margin-top:10px;padding:8px 10px;background:var(--bg3);border-radius:6px;font-size:11px;color:var(--text3);font-style:italic;white-space:pre-wrap;word-break:break-word;">"${linkify(p.note)}"</div>` : ''}
    </div>`;
  }).join('') + `
    <div class="new-projet-card" onclick="switchTab('simulateur',document.querySelector('.main-tab:nth-child(2)'))">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
      <span style="font-size:13px;font-weight:500;">Nouvelle simulation</span>
    </div>`;
}

function toggleStatusMenu(projectId) {
  const menu = document.getElementById('statusMenu_' + projectId);
  if (!menu) return;
  const isOpen = menu.style.display !== 'none';
  // Ferme tous les autres
  document.querySelectorAll('.status-menu').forEach(m => m.style.display = 'none');
  menu.style.display = isOpen ? 'none' : 'block';
}
document.addEventListener('click', () => {
  document.querySelectorAll('.status-menu').forEach(m => m.style.display = 'none');
});

// ── Charge un projet dans le simulateur ──
function loadProject(id) {
  const p = savedProjects.find(x => String(x.id) === String(id));
  if (!p) return;

  switchTab('simulateur', document.querySelector('.main-tab:nth-child(2)'));

  setTimeout(() => {
    const simV = document.getElementById('simVille');
    if (simV) { simV.value = p.ville; onSimVilleChange(); }
    document.getElementById('simSurf').value = p.surface;
    document.getElementById('simSurfS').value = p.surface;
    document.getElementById('simPcs').value = p.pieces;
    document.getElementById('pcsVal').textContent = p.pieces;
    document.getElementById('simPrix').value = p.prix_achat;
    document.getElementById('simPrixS').value = p.prix_achat;
    document.getElementById('simLoyer').value = p.loyer_mensuel;
    setType(p.type_bien === 'Apt' ? 'Apt' : 'Msn');
    p.meuble ? setMeuble(true) : setMeuble(false);

    if (p.quartier) {
      setTimeout(() => {
        const sel = document.getElementById('simQuartier');
        if (sel) { sel.value = p.quartier; }
        updateSimLoyer();
      }, 80);
    }

    // Restore mode Simple/Pro (avant les autres champs pour que les blocs corrects soient visibles)
    if (p.params?.mode && typeof setMode === 'function') {
      setMode(p.params.mode);
    }

    // Restore params avancés
    if (p.params) {
      if (p.params.duree)  { document.getElementById('simDuree').value = p.params.duree; document.getElementById('dureeVal').textContent = p.params.duree + ' ans'; }
      if (p.params.taux)   { document.getElementById('simTaux').value = p.params.taux;   document.getElementById('tauxVal').textContent = parseFloat(p.params.taux).toFixed(1) + '%'; }
      if (p.params.vacance){ document.getElementById('simVacance').value = p.params.vacance; document.getElementById('vacanceVal').textContent = p.params.vacance + ' mois/an'; }
      if (p.params.apport) { document.getElementById('simApport').value = p.params.apport; document.getElementById('simApportS').value = p.params.apport; }
      if (p.params.notaire){ document.getElementById('simNotaire').value = p.params.notaire; }
      if (p.params.travaux){ document.getElementById('simTravaux').value = p.params.travaux; }
      if (p.params.assur)  { document.getElementById('simAssur').value = p.params.assur; document.getElementById('assurVal').textContent = parseFloat(p.params.assur).toFixed(2) + '%'; }
      if (p.params.copro != null){ document.getElementById('simCopro').value = p.params.copro; }
      if (p.params.meublePct){ document.getElementById('meublePct').value = p.params.meublePct; }

      // Colocation
      const cn = parseInt(p.params.coloc) || 0;
      if (typeof setColoc === 'function') {
        if (cn >= 2) {
          setColoc(true);
          const sel = document.getElementById('simColocN');
          if (sel) sel.value = String(Math.min(cn, 5));
          if (typeof setColocN === 'function') setColocN(Math.min(cn, 5));
        } else {
          setColoc(false);
        }
      }

      // Equipements coches (Pro)
      if (Array.isArray(p.params.opts) && typeof activeOpts !== 'undefined') {
        activeOpts.clear();
        p.params.opts.forEach(name => {
          activeOpts.add(name);
          const cb = document.getElementById('cb-' + name);
          const item = document.getElementById('opt-' + name);
          if (cb) cb.checked = true;
          if (item) item.classList.add('checked');
        });
      }

      // Toggles de cases a cocher des options Pro
      if (p.params.options && typeof setSimOption === 'function') {
        ['pret','duree','taux','assurance','vacance'].forEach(k => {
          const v = p.params.options[k] !== false;
          const cb = document.getElementById('opt-' + k);
          if (cb) cb.checked = v;
          setSimOption(k, v);
        });
      }
    }

    // Si on n'a pas restaure de notaire personnalise, on calcule
    if (!p.params?.notaire) autoNotaire();
    calcSim();
    showToast(`"${p.name}" chargé ✓`);
  }, 100);
}

// ── Modal de sauvegarde ──
function openSaveModal() {
  const ville = document.getElementById('simVille')?.value || '';
  const surf  = document.getElementById('simSurf')?.value || document.getElementById('simSurfS')?.value || '';
  const qCode = document.getElementById('simQuartier')?.value || '';
  document.getElementById('saveProjectName').value = `${ville}${qCode ? ' ' + qCode : ''} — ${surf}m²`;
  document.getElementById('saveProjectNote').value = '';
  document.getElementById('saveModal').classList.add('open');
}

function closeSaveModal(e) {
  if (!e || e.target === document.getElementById('saveModal'))
    document.getElementById('saveModal').classList.remove('open');
}

async function saveProject() {
  const name  = document.getElementById('saveProjectName').value.trim() || 'Projet sans nom';
  const note  = document.getElementById('saveProjectNote').value.trim();
  const ville = document.getElementById('simVille')?.value || '';
  const qCode = document.getElementById('simQuartier')?.value || '';
  const surf  = parseFloat(document.getElementById('simSurf')?.value  || document.getElementById('simSurfS')?.value)  || 0;
  const pcs   = parseInt(document.getElementById('simPcs')?.value)   || 1;
  const prix  = parseFloat(document.getElementById('simPrix')?.value  || document.getElementById('simPrixS')?.value)  || 0;
  const loyer = parseFloat(document.getElementById('simLoyer')?.value) || 0;
  const meuble = document.getElementById('btnMeuble')?.classList.contains('active') || false;

  const result = await saveProjectToDB({
    name, note, ville, quartier: qCode || null,
    type: simType, surface: surf, pieces: pcs,
    prix, loyer, meuble,
    rentBrute: document.getElementById('rentBrute')?.textContent || '—',
    rentNette: document.getElementById('rentNette')?.textContent || '—',
    mensualite: parseFloat(document.getElementById('mensualite')?.textContent) || 0,
    cashflow: parseFloat(document.getElementById('cashflowVal')?.textContent) || 0,
    params: {
      mode:    (typeof simMode !== 'undefined' ? simMode : 'simple'),
      duree:   document.getElementById('simDuree')?.value,
      taux:    document.getElementById('simTaux')?.value,
      vacance: document.getElementById('simVacance')?.value,
      apport:  document.getElementById('simApport')?.value || document.getElementById('simApportS')?.value,
      notaire: document.getElementById('simNotaire')?.value,
      travaux: document.getElementById('simTravaux')?.value,
      assur:   document.getElementById('simAssur')?.value,
      copro:   document.getElementById('simCopro')?.value,
      meublePct: document.getElementById('meublePct')?.value,
      coloc:   (typeof simColoc !== 'undefined' && simColoc.on) ? simColoc.n : 0,
      options: (typeof simOptions !== 'undefined') ? {
        pret: !!simOptions.pret, duree: !!simOptions.duree, taux: !!simOptions.taux,
        assurance: !!simOptions.assurance, vacance: !!simOptions.vacance
      } : null,
      // Liste des equipements coches (Pro)
      opts: (typeof activeOpts !== 'undefined' && activeOpts && activeOpts.size) ? Array.from(activeOpts) : [],
    }
  });

  if (result) {
    document.getElementById('saveModal').classList.remove('open');
    showToast(`"${name}" sauvegardé !`);
  }
}
