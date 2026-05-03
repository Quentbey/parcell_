// ============================================================
// auth.js — Authentification complète (email + Google OAuth)
// ============================================================

// ── État utilisateur global ──
let currentUser = null;
let currentProfile = null;

// ── Initialisation : vérifie la session au chargement ──
async function initAuth() {
  // Récupère la session existante (persistance)
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session) {
    await onUserLoggedIn(session.user);
  } else {
    showAuthWall('login');
  }

  // Écoute les changements d'état (login, logout, token refresh)
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await onUserLoggedIn(session.user);
    } else if (event === 'SIGNED_OUT') {
      onUserLoggedOut();
    } else if (event === 'PASSWORD_RECOVERY') {
      showAuthWall('reset-password');
    }
  });
}

// ── Connexion réussie ──
async function onUserLoggedIn(user) {
  currentUser = user;

  // Charge ou crée le profil dans la table "profiles"
  currentProfile = await loadOrCreateProfile(user);

  // Met à jour l'interface
  updateNavUser(user, currentProfile);

  // Masque le mur auth, affiche l'app
  document.getElementById('authWall').style.display = 'none';
  document.getElementById('appRoot').style.display = 'block';

  // Initialise l'app principale
  if (typeof initApp === 'function') initApp();
}

// ── Déconnexion ──
function onUserLoggedOut() {
  currentUser = null;
  currentProfile = null;
  document.getElementById('appRoot').style.display = 'none';
  showAuthWall('login');
}

// ── Charge ou crée le profil utilisateur ──
async function loadOrCreateProfile(user) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) {
    // Crée le profil si première connexion
    const newProfile = {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || '',
      avatar_url: user.user_metadata?.avatar_picture || '',
      plan: 'free',
      created_at: new Date().toISOString(),
      preferences: {
        budget_max: null,
        types_biens: ['Apt'],
        departements_cibles: [],
        objectif: 'cashflow'
      }
    };
    await supabaseClient.from('profiles').insert(newProfile);
    return newProfile;
  }
  return data;
}

// ── Met à jour le nav avec les infos utilisateur ──
function updateNavUser(user, profile) {
  const name = profile?.full_name || user.email.split('@')[0];
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const nameEl = document.getElementById('navUserName');
  const avatarEl = document.getElementById('navAvatar');
  const ddName = document.getElementById('ddName');
  const ddEmail = document.getElementById('ddEmail');

  if (nameEl) nameEl.textContent = name.split(' ')[0];
  if (avatarEl) {
    if (profile?.avatar_url) {
      avatarEl.innerHTML = `<img src="${profile.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    } else {
      avatarEl.textContent = initials;
    }
  }
  if (ddName) ddName.textContent = name || user.email;
  if (ddEmail) ddEmail.textContent = user.email;
}

// ══════════════════════════════════════════
// MUR D'AUTHENTIFICATION — interface login/signup
// ══════════════════════════════════════════

function showAuthWall(mode = 'login') {
  const wall = document.getElementById('authWall');
  wall.style.display = 'flex';
  wall.style.cssText = `
    display:flex; align-items:center; justify-content:center;
    min-height:100vh; padding:24px;
    background: var(--bg, #080b12);
  `;
  wall.innerHTML = renderAuthHTML(mode);
}

function renderAuthHTML(mode) {
  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const isReset = mode === 'forgot';
  const isNewPwd = mode === 'reset-password';

  return `
  <div style="width:100%;max-width:420px;">
    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:48px;height:48px;background:linear-gradient(135deg,#c9a84c,#e8c97a);border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;box-shadow:0 4px 20px rgba(201,168,76,0.3);">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0a0d14" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </div>
      <div style="font-family:'Outfit',sans-serif;font-weight:700;font-size:24px;color:#e4e8f2;letter-spacing:-0.02em;">Parc<span style="color:#c9a84c;">ell</span></div>
      <div style="font-size:13px;color:#7e8a9e;margin-top:4px;">
        ${isLogin ? 'Bon retour 👋' : isSignup ? 'Créez votre compte gratuit' : isNewPwd ? 'Choisissez un nouveau mot de passe' : 'Réinitialiser le mot de passe'}
      </div>
    </div>

    <!-- Card -->
    <div style="background:#161c2e;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px;">

      ${isLogin || isSignup ? `
      <!-- Google OAuth -->
      <button onclick="signInWithGoogle()" style="width:100%;padding:11px;background:#fff;border:none;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;color:#1a1a2e;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:18px;transition:opacity 0.2s;" onmouseover="this.style.opacity='.92'" onmouseout="this.style.opacity='1'">
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Continuer avec Google
      </button>

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
        <div style="flex:1;height:1px;background:rgba(255,255,255,0.08);"></div>
        <span style="font-size:12px;color:#4e5a6e;">ou</span>
        <div style="flex:1;height:1px;background:rgba(255,255,255,0.08);"></div>
      </div>
      ` : ''}

      <!-- Formulaire email -->
      <div id="authError" style="display:none;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);border-radius:8px;padding:10px 14px;font-size:13px;color:#f87171;margin-bottom:14px;"></div>
      <div id="authSuccess" style="display:none;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);border-radius:8px;padding:10px 14px;font-size:13px;color:#34d399;margin-bottom:14px;"></div>

      ${isSignup ? `
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:12px;color:#7e8a9e;margin-bottom:5px;font-weight:500;">Prénom et nom</label>
        <input id="authFullName" type="text" placeholder="Thomas Dupont" style="width:100%;background:#0e1220;border:1px solid rgba(255,255,255,0.11);border-radius:8px;color:#e4e8f2;padding:10px 13px;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='#c9a84c'" onblur="this.style.borderColor='rgba(255,255,255,0.11)'">
      </div>
      ` : ''}

      ${!isNewPwd ? `
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:12px;color:#7e8a9e;margin-bottom:5px;font-weight:500;">Email</label>
        <input id="authEmail" type="email" placeholder="vous@email.fr" style="width:100%;background:#0e1220;border:1px solid rgba(255,255,255,0.11);border-radius:8px;color:#e4e8f2;padding:10px 13px;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='#c9a84c'" onblur="this.style.borderColor='rgba(255,255,255,0.11)'" onkeydown="if(event.key==='Enter')handleAuthSubmit()">
      </div>
      ` : ''}

      ${!isReset ? `
      <div style="margin-bottom:${isLogin ? '8px' : '16px'};">
        <label style="display:block;font-size:12px;color:#7e8a9e;margin-bottom:5px;font-weight:500;">${isNewPwd ? 'Nouveau mot de passe' : 'Mot de passe'}</label>
        <div style="position:relative;">
          <input id="authPassword" type="password" placeholder="${isSignup ? 'Minimum 8 caractères' : '••••••••'}" style="width:100%;background:#0e1220;border:1px solid rgba(255,255,255,0.11);border-radius:8px;color:#e4e8f2;padding:10px 40px 10px 13px;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='#c9a84c'" onblur="this.style.borderColor='rgba(255,255,255,0.11)'" onkeydown="if(event.key==='Enter')handleAuthSubmit()">
          <span onclick="togglePwdVisibility()" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);cursor:pointer;color:#4e5a6e;font-size:16px;" title="Afficher/masquer">👁</span>
        </div>
      </div>
      ` : ''}

      ${isSignup ? `
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:12px;color:#7e8a9e;margin-bottom:5px;font-weight:500;">Confirmer le mot de passe</label>
        <input id="authPasswordConfirm" type="password" placeholder="••••••••" style="width:100%;background:#0e1220;border:1px solid rgba(255,255,255,0.11);border-radius:8px;color:#e4e8f2;padding:10px 13px;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='#c9a84c'" onblur="this.style.borderColor='rgba(255,255,255,0.11)'" onkeydown="if(event.key==='Enter')handleAuthSubmit()">
      </div>
      ` : ''}

      ${isLogin ? `
      <div style="text-align:right;margin-bottom:16px;">
        <span onclick="showAuthWall('forgot')" style="font-size:12px;color:#7e8a9e;cursor:pointer;" onmouseover="this.style.color='#c9a84c'" onmouseout="this.style.color='#7e8a9e'">Mot de passe oublié ?</span>
      </div>
      ` : ''}

      <!-- Bouton principal -->
      <button id="authSubmitBtn" onclick="handleAuthSubmit()" style="width:100%;padding:12px;background:linear-gradient(135deg,#c9a84c,#e8c97a);border:none;border-radius:10px;color:#0a0d14;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:opacity 0.2s;letter-spacing:0.01em;" onmouseover="this.style.opacity='.9'" onmouseout="this.style.opacity='1'">
        ${isLogin ? 'Se connecter' : isSignup ? 'Créer mon compte' : isReset ? 'Envoyer le lien' : 'Mettre à jour le mot de passe'}
      </button>

      ${isSignup ? `
      <div style="font-size:11px;color:#4e5a6e;text-align:center;margin-top:12px;line-height:1.5;">
        En vous inscrivant, vous acceptez nos <span style="color:#7e8a9e;cursor:pointer;text-decoration:underline;">CGU</span> et notre <span style="color:#7e8a9e;cursor:pointer;text-decoration:underline;">politique de confidentialité</span>.
      </div>
      ` : ''}
    </div>

    <!-- Switch mode -->
    <div style="text-align:center;margin-top:18px;font-size:13px;color:#7e8a9e;">
      ${isLogin ? `Pas encore de compte ? <span onclick="showAuthWall('signup')" style="color:#c9a84c;cursor:pointer;font-weight:600;">Créer un compte</span>` : ''}
      ${isSignup ? `Déjà un compte ? <span onclick="showAuthWall('login')" style="color:#c9a84c;cursor:pointer;font-weight:600;">Se connecter</span>` : ''}
      ${isReset ? `<span onclick="showAuthWall('login')" style="color:#c9a84c;cursor:pointer;font-weight:600;">← Retour à la connexion</span>` : ''}
    </div>
  </div>`;
}

// ── Dispatch du formulaire selon le mode ──
async function handleAuthSubmit() {
  const btn = document.getElementById('authSubmitBtn');
  const errEl = document.getElementById('authError');
  const sucEl = document.getElementById('authSuccess');

  // Détermine le mode actuel
  const hasName = !!document.getElementById('authFullName');
  const hasConfirm = !!document.getElementById('authPasswordConfirm');
  const hasEmail = !!document.getElementById('authEmail');
  const hasPwd = !!document.getElementById('authPassword');
  const hasEmailOnly = hasEmail && !hasPwd; // mode reset

  const showError = (msg) => {
    if(errEl){ errEl.textContent = msg; errEl.style.display = 'block'; }
    if(sucEl) sucEl.style.display = 'none';
  };
  const showSuccess = (msg) => {
    if(sucEl){ sucEl.textContent = msg; sucEl.style.display = 'block'; }
    if(errEl) errEl.style.display = 'none';
  };

  btn.textContent = 'Chargement…';
  btn.style.opacity = '0.7';
  btn.disabled = true;

  try {
    if (hasEmailOnly) {
      // ── Mode : mot de passe oublié ──
      const email = document.getElementById('authEmail').value.trim();
      if (!email) { showError('Veuillez entrer votre email.'); return; }
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/?reset=true'
      });
      if (error) throw error;
      showSuccess('Lien de réinitialisation envoyé ! Vérifiez votre boîte mail.');

    } else if (hasName || hasConfirm) {
      // ── Mode : inscription ──
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      const confirm = document.getElementById('authPasswordConfirm')?.value;
      const fullName = document.getElementById('authFullName')?.value.trim() || '';

      if (!email || !password) { showError('Email et mot de passe requis.'); return; }
      if (password.length < 8) { showError('Le mot de passe doit faire au moins 8 caractères.'); return; }
      if (password !== confirm) { showError('Les mots de passe ne correspondent pas.'); return; }

      const { data, error } = await supabaseClient.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } }
      });
      if (error) throw error;
      showSuccess('Compte créé ! Vérifiez votre email pour confirmer votre inscription.');

    } else {
      // ── Mode : connexion ──
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;

      if (!email || !password) { showError('Email et mot de passe requis.'); return; }

      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // onAuthStateChange prend le relais
    }

  } catch (err) {
    const msg = translateAuthError(err.message);
    showError(msg);
  } finally {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = btn.textContent.replace('Chargement…', btn.getAttribute('data-label') || 'Valider');
  }
}

// ── OAuth Google ──
async function signInWithGoogle() {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { prompt: 'select_account' }
    }
  });
  if (error) console.error('Google OAuth error:', error);
}

// ── Déconnexion ──
async function signOut() {
  await supabaseClient.auth.signOut();
  closeUserDropdown();
}

// ── Afficher/masquer mot de passe ──
function togglePwdVisibility() {
  const input = document.getElementById('authPassword');
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

// ── Traduction des erreurs Supabase ──
function translateAuthError(msg) {
  const errors = {
    'Invalid login credentials': 'Email ou mot de passe incorrect.',
    'Email not confirmed': 'Veuillez confirmer votre email avant de vous connecter.',
    'User already registered': 'Un compte existe déjà avec cet email.',
    'Password should be at least 6 characters': 'Le mot de passe doit faire au moins 6 caractères.',
    'Unable to validate email address: invalid format': 'Format d\'email invalide.',
    'signup is disabled': 'Les inscriptions sont temporairement désactivées.',
    'Email rate limit exceeded': 'Trop de tentatives. Attendez quelques minutes.',
  };
  return errors[msg] || msg || 'Une erreur est survenue. Réessayez.';
}

// ── Nav dropdown ──
function toggleUserDropdown() {
  document.getElementById('userDropdown').classList.toggle('open');
}
function closeUserDropdown() {
  document.getElementById('userDropdown').classList.remove('open');
}
document.addEventListener('click', e => {
  const nav = document.querySelector('.nav-user');
  if (nav && !nav.contains(e.target)) closeUserDropdown();
});

// ── Lance l'auth au chargement ──
document.addEventListener('DOMContentLoaded', initAuth);
