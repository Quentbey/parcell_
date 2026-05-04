// ============================================================
// projects.js — Gestion des projets (Supabase)
// ============================================================

let savedProjects = [];

// ── Charge les projets depuis Supabase ──
async function loadProjects() {
  if (!currentUser) return [];
  const { data, error } = await supabase
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
  if (error) { console.error('saveProject:', error); showToast('Erreur lors de la sauvegarde', 'err'); return null; }

  savedProjects.unshift(data);
  updateProjectCount();
  return data;
}

// ── Met à jour le statut d'un projet ──
async function updateProjectStatus(projectId, status) {
  const { error } = await supabase
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
  const { error } = await supabase
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
  const { error } = await supabase
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

  grid.innerHTML = savedProjects.map(p => {
    const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.etude;
    const cf = parseFloat(p.cashflow) || 0;
    const cfColor = cf >= 0 ? 'var(--green)' : 'var(--red)';
    const cfStr = (cf >= 0 ? '+' : '') + Math.round(cf) + ' €';
    return `
    <div class="projet-card" onclick="loadProject('${p.id}')">
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
      ${p.note ? `<div style="margin-top:10px;padding:8px 10px;background:var(--bg3);border-radius:6px;font-size:11px;color:var(--text3);font-style:italic;">"${p.note}"</div>` : ''}
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

    // Restore params avancés si mode Pro
    if (p.params) {
      if (p.params.duree) { document.getElementById('simDuree').value = p.params.duree; document.getElementById('dureeVal').textContent = p.params.duree + ' ans'; }
      if (p.params.taux)  { document.getElementById('simTaux').value = p.params.taux;   document.getElementById('tauxVal').textContent = parseFloat(p.params.taux).toFixed(1) + '%'; }
      if (p.params.vacance) { document.getElementById('simVacance').value = p.params.vacance; document.getElementById('vacanceVal').textContent = p.params.vacance + ' mois/an'; }
      if (p.params.apport) { document.getElementById('simApport').value = p.params.apport; document.getElementById('simApportS').value = p.params.apport; }
    }
    autoNotaire();
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
      duree:   document.getElementById('simDuree')?.value,
      taux:    document.getElementById('simTaux')?.value,
      vacance: document.getElementById('simVacance')?.value,
      apport:  document.getElementById('simApport')?.value || document.getElementById('simApportS')?.value,
    }
  });

  if (result) {
    document.getElementById('saveModal').classList.remove('open');
    showToast(`"${name}" sauvegardé !`);
  }
}
