// ============================================================
// admin.js : panneau d'administration applicatif
// Accessible uniquement aux profils ayant is_admin = true.
// Le menu "Administration" est revele dans la sidebar par auth.js
// quand currentProfile.is_admin est detecte.
// ============================================================

let adminUsers = [];
let adminProjects = [];

// Escape HTML pour empecher XSS via donnees utilisateur injectees dans innerHTML.
// On reutilise escapeHtml() de projects.js si disponible, fallback sinon.
const _esc = (s) => {
  if (typeof escapeHtml === 'function') return escapeHtml(s);
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Revele le menu "Administration" si le profil est admin.
function refreshAdminVisibility() {
  const nav = document.getElementById('cnav-admin');
  if (!nav) return;
  const isAdmin = !!(currentProfile && currentProfile.is_admin);
  nav.style.display = isAdmin ? '' : 'none';
}

// Charge toutes les donnees admin (utilisateurs + projets).
async function loadAdminData() {
  if (!currentProfile?.is_admin) return;
  const panel = document.getElementById('adminPanel');
  if (panel) panel.innerHTML = '<div style="padding:24px;color:var(--text3);font-size:13px;">Chargement des donnees…</div>';

  const [{ data: users, error: e1 }, { data: projects, error: e2 }] = await Promise.all([
    supabaseClient.from('profiles').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('projects').select('*').order('created_at', { ascending: false }),
  ]);
  if (e1) { console.error('admin profiles:', e1); if (panel) panel.innerHTML = '<div style="color:var(--red);padding:24px;">Erreur de chargement des utilisateurs : '+_esc(e1.message)+'</div>'; return; }
  if (e2) { console.error('admin projects:', e2); if (panel) panel.innerHTML = '<div style="color:var(--red);padding:24px;">Erreur de chargement des projets : '+_esc(e2.message)+'</div>'; return; }

  adminUsers = users || [];
  adminProjects = projects || [];
  renderAdminPanel();
}

function renderAdminPanel() {
  const panel = document.getElementById('adminPanel');
  if (!panel) return;

  // Statistiques
  const nbUsers = adminUsers.length;
  const nbProjects = adminProjects.length;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentProjects = adminProjects.filter(p => new Date(p.created_at).getTime() > weekAgo).length;
  const activeUserIds = new Set(adminProjects.map(p => p.user_id));
  const activePct = nbUsers > 0 ? Math.round(activeUserIds.size / nbUsers * 100) : 0;

  // Comptage projets par utilisateur
  const projectsByUser = {};
  adminProjects.forEach(p => { projectsByUser[p.user_id] = (projectsByUser[p.user_id] || 0) + 1; });

  // Top villes
  const villeCounts = {};
  adminProjects.forEach(p => { if (p.ville) villeCounts[p.ville] = (villeCounts[p.ville] || 0) + 1; });
  const topVilles = Object.entries(villeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxCount = topVilles[0]?.[1] || 1;

  panel.innerHTML = `
    <!-- Statistiques globales -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:28px;">
      ${statCard(nbUsers, 'Utilisateurs', 'var(--text)')}
      ${statCard(nbProjects, 'Projets totaux', 'var(--teal)')}
      ${statCard('+' + recentProjects, 'Cette semaine', 'var(--gold)')}
      ${statCard(activePct + '%', 'Actifs (≥ 1 projet)', 'var(--green)')}
    </div>

    ${topVilles.length ? `
      <div style="margin-bottom:32px;">
        <div style="font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px;">Top villes simulees<span style="flex:1;height:1px;background:var(--border);"></span></div>
        <div style="background:var(--card2);border:1px solid var(--border);border-radius:var(--radius);padding:18px 20px;">
          ${topVilles.map(([ville, count]) => `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">
              <span style="width:140px;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(ville)}</span>
              <div style="flex:1;background:var(--bg3);border-radius:4px;height:8px;overflow:hidden;">
                <div style="width:${(count / maxCount * 100).toFixed(0)}%;background:linear-gradient(90deg,var(--teal),var(--gold));height:100%;border-radius:4px;"></div>
              </div>
              <span style="font-size:12px;color:var(--text2);font-weight:600;width:36px;text-align:right;">${count}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Liste utilisateurs -->
    <div style="font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px;">Utilisateurs (${nbUsers})<span style="flex:1;height:1px;background:var(--border);"></span></div>
    <div style="overflow-x:auto;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:var(--card2);">
            ${['Email', 'Nom', 'Projets', 'Plan', 'Inscrit', 'Actions'].map(h => `<th style="text-align:left;padding:12px 14px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${adminUsers.map(u => userRow(u, projectsByUser[u.id] || 0)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function statCard(value, label, color) {
  return `<div style="background:var(--card2);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;">
    <div style="font-family:'Outfit',sans-serif;font-size:26px;font-weight:700;color:${color};letter-spacing:-0.02em;">${_esc(value)}</div>
    <div style="font-size:12px;color:var(--text2);margin-top:2px;">${_esc(label)}</div>
  </div>`;
}

function userRow(u, nbProjects) {
  const adminBadge = u.is_admin
    ? '<span style="display:inline-block;padding:1px 7px;background:var(--gold-glow);color:var(--gold);border:1px solid rgba(201,168,76,0.3);border-radius:8px;font-size:10px;font-weight:700;margin-left:6px;vertical-align:middle;">ADMIN</span>'
    : '';
  const isSelf = currentProfile && u.id === currentProfile.id;
  // Boutons : on utilise data-attributes (echappes) + delegated listener.
  // Jamais d'injection user-data dans une string JS inline (vecteur XSS classique).
  const actionBtns = `
    <button type="button" data-admin-action="view-projects" data-userid="${_esc(u.id)}" data-email="${_esc(u.email || '')}" style="padding:5px 10px;background:transparent;border:1px solid var(--border2);border-radius:6px;color:var(--text2);font-size:11px;cursor:pointer;font-family:'DM Sans',sans-serif;margin-right:4px;">Voir projets</button>
    ${isSelf ? '' : `<button type="button" data-admin-action="toggle-admin" data-userid="${_esc(u.id)}" data-make-admin="${!u.is_admin}" style="padding:5px 10px;background:${u.is_admin ? 'rgba(248,113,113,0.10)' : 'rgba(201,168,76,0.10)'};border:1px solid ${u.is_admin ? 'rgba(248,113,113,0.30)' : 'rgba(201,168,76,0.30)'};border-radius:6px;color:${u.is_admin ? 'var(--red)' : 'var(--gold)'};font-size:11px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;">${u.is_admin ? 'Retrograder' : 'Promouvoir'}</button>`}
  `;
  return `<tr style="border-bottom:1px solid var(--border);">
    <td style="padding:11px 14px;">${_esc(u.email || '—')}${adminBadge}</td>
    <td style="padding:11px 14px;color:var(--text2);">${_esc(u.full_name || '—')}</td>
    <td style="padding:11px 14px;color:var(--teal);font-weight:600;">${nbProjects}</td>
    <td style="padding:11px 14px;color:var(--text2);">${_esc(u.plan || 'free')}</td>
    <td style="padding:11px 14px;color:var(--text2);">${new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
    <td style="padding:11px 14px;white-space:nowrap;">${actionBtns}</td>
  </tr>`;
}

async function adminTogglePromote(userId, makeAdmin) {
  const confirmMsg = makeAdmin
    ? 'Promouvoir cet utilisateur administrateur ? Il pourra voir et modifier les donnees de tous les utilisateurs.'
    : 'Retrograder cet administrateur ? Il reviendra a un statut utilisateur normal.';
  if (!window.confirm(confirmMsg)) return;
  const { error } = await supabaseClient.from('profiles').update({ is_admin: makeAdmin }).eq('id', userId);
  if (error) { if (typeof showToast === 'function') showToast('Erreur : ' + error.message, 'err'); return; }
  if (typeof showToast === 'function') showToast(makeAdmin ? 'Promu administrateur ✓' : 'Retrograde');
  loadAdminData();
}

function adminViewUserProjects(userId, email) {
  const projects = adminProjects.filter(p => p.user_id === userId);
  const panel = document.getElementById('adminPanel');
  if (!panel) return;
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;gap:12px;flex-wrap:wrap;">
      <button type="button" data-admin-action="back-to-panel" style="padding:8px 14px;background:transparent;border:1px solid var(--border2);border-radius:8px;color:var(--text2);font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;">← Retour au panneau</button>
      <div style="font-size:13px;color:var(--text2);"><strong style="color:var(--text);">${projects.length}</strong> projet${projects.length > 1 ? 's' : ''} de <strong style="color:var(--gold);">${_esc(email)}</strong></div>
    </div>
    ${projects.length === 0 ? '<div style="text-align:center;padding:48px;color:var(--text3);font-size:14px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);">Aucun projet sauvegarde pour cet utilisateur.</div>' : `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">
        ${projects.map(p => {
          const cf = parseFloat(p.cashflow) || 0;
          return `
            <div style="background:var(--card2);border:1px solid var(--border2);border-radius:var(--radius);padding:16px;">
              <div style="font-family:'Outfit',sans-serif;font-weight:700;color:var(--text);margin-bottom:3px;">${_esc(p.name || '—')}</div>
              <div style="font-size:12px;color:var(--text3);margin-bottom:12px;">${_esc(p.ville || '')}${p.quartier ? ' · ' + _esc(p.quartier) : ''} · ${parseFloat(p.surface) || 0}m² · ${parseInt(p.pieces) || 0}P</div>
              <div style="display:flex;gap:16px;font-size:12px;">
                <div><div style="color:var(--text3);font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Renta nette</div><div style="color:var(--gold);font-weight:700;margin-top:2px;font-family:'Outfit',sans-serif;">${_esc(p.rent_nette || '—')}</div></div>
                <div><div style="color:var(--text3);font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Cashflow</div><div style="color:${cf >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:700;margin-top:2px;font-family:'Outfit',sans-serif;">${cf >= 0 ? '+' : ''}${Math.round(cf)} €</div></div>
              </div>
              <div style="font-size:10px;color:var(--text3);margin-top:10px;">${new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>`;
        }).join('')}
      </div>
    `}
  `;
}

// Delegated event listener : centralise tous les clics admin via data-attributes,
// elimine les inline onclick (vecteur XSS si user-data inject dans la string JS).
document.addEventListener('click', function(e) {
  const btn = e.target.closest('[data-admin-action]');
  if (!btn) return;
  // Garde-fou : seuls les admins peuvent declencher ces actions.
  // La verite est cote serveur (RLS Supabase), c'est juste une UX.
  if (!currentProfile?.is_admin) return;

  const action = btn.dataset.adminAction;
  if (action === 'view-projects') {
    adminViewUserProjects(btn.dataset.userid, btn.dataset.email || '');
  } else if (action === 'toggle-admin') {
    adminTogglePromote(btn.dataset.userid, btn.dataset.makeAdmin === 'true');
  } else if (action === 'back-to-panel') {
    renderAdminPanel();
  }
});
