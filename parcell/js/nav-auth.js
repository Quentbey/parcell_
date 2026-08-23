// nav-auth.js : détection d'auth légère pour les pages statiques (guides, villes)
// Lit le token Supabase depuis localStorage SANS charger le SDK, et remplace
// les boutons Connexion/Lancer par l'avatar utilisateur si connecté.
(function(){
  function readSession(){
    try {
      // Scan tous les tokens Supabase (résiste aux changements de clé)
      var keys = Object.keys(localStorage).filter(function(k){
        return k.indexOf('sb-') === 0 && k.indexOf('-auth-token') !== -1;
      });
      for (var i = 0; i < keys.length; i++) {
        var raw = localStorage.getItem(keys[i]);
        if (!raw) continue;
        var data = JSON.parse(raw);
        if (!data || !data.user) continue;
        if (data.expires_at && (data.expires_at * 1000) < Date.now()) continue;
        return data;
      }
      return null;
    } catch(e){ return null; }
  }

  function initials(name){
    if (!name) return '?';
    return name.split(' ').map(function(n){return n[0];}).join('').slice(0,2).toUpperCase();
  }

  function ensureStyles(){
    if (document.getElementById('nav-auth-styles')) return;
    var s = document.createElement('style');
    s.id = 'nav-auth-styles';
    s.textContent = ''
      + '.nav-user-mini{position:relative;display:flex;align-items:center;gap:10px;}'
      + '.nav-user-mini .name{font-size:14px;color:var(--text2);font-weight:500;cursor:pointer;}'
      + '.nav-user-mini .avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--teal),#6366f1);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;cursor:pointer;font-family:"Outfit",sans-serif;overflow:hidden;}'
      + '.nav-user-mini .avatar img{width:100%;height:100%;object-fit:cover;}'
      + '.nav-user-mini .menu{position:absolute;top:calc(100% + 10px);right:0;width:220px;background:var(--card2,#171d2f);border:1px solid var(--border2,rgba(255,255,255,0.12));border-radius:12px;padding:8px;box-shadow:0 16px 48px rgba(0,0,0,0.5);z-index:300;opacity:0;pointer-events:none;transform:translateY(-8px);transition:all .2s;}'
      + '.nav-user-mini.open .menu{opacity:1;pointer-events:auto;transform:translateY(0);}'
      + '.nav-user-mini .menu .head{padding:10px 12px 12px;border-bottom:1px solid var(--border,rgba(255,255,255,0.08));margin-bottom:6px;}'
      + '.nav-user-mini .menu .head .h-name{font-size:13px;font-weight:700;color:var(--text,#e4e8f2);}'
      + '.nav-user-mini .menu .head .h-email{font-size:11px;color:var(--text3,#7e8a9e);margin-top:2px;word-break:break-all;}'
      + '.nav-user-mini .menu a, .nav-user-mini .menu button{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;color:var(--text2,#c4cad6);font-size:13px;text-decoration:none;background:none;border:none;width:100%;cursor:pointer;text-align:left;font-family:inherit;transition:background .15s;}'
      + '.nav-user-mini .menu a:hover, .nav-user-mini .menu button:hover{background:rgba(255,255,255,0.05);color:var(--text,#e4e8f2);}'
      + '.nav-user-mini .menu .logout{color:#f87171;}'
      + '@media(max-width:520px){.nav-user-mini .name{display:none;}}';
    document.head.appendChild(s);
  }

  function signOut(){
    // Purge tous les tokens Supabase du localStorage
    try {
      Object.keys(localStorage).forEach(function(k){
        if (k.indexOf('sb-') === 0) localStorage.removeItem(k);
      });
    } catch(e){}
    location.reload();
  }
  window.yrowSignOut = signOut;

  function renderConnected(container, session){
    var user = session.user || {};
    var meta = user.user_metadata || {};
    var name = meta.full_name || (user.email ? user.email.split('@')[0] : 'Compte');
    var firstName = name.split(' ')[0];
    var email = user.email || '';
    var avatar = meta.avatar_url || meta.avatar_picture || meta.picture;

    ensureStyles();

    // Vide le container et remplace par l'avatar
    container.innerHTML = ''
      + '<div class="nav-user-mini" id="navUserMini">'
      + '  <span class="name" onclick="document.getElementById(\'navUserMini\').classList.toggle(\'open\')">' + firstName + '</span>'
      + '  <div class="avatar" onclick="document.getElementById(\'navUserMini\').classList.toggle(\'open\')">'
      + (avatar ? '<img src="' + avatar + '" alt="">' : initials(name))
      + '  </div>'
      + '  <div class="menu">'
      + '    <div class="head"><div class="h-name">' + name + '</div><div class="h-email">' + email + '</div></div>'
      + '    <a href="/app.html#compte">Mon profil</a>'
      + '    <a href="/app.html#compte">Mes projets</a>'
      + '    <a href="/app.html#simulateur">Lancer le simulateur</a>'
      + '    <button class="logout" onclick="yrowSignOut()">Se déconnecter</button>'
      + '  </div>'
      + '</div>';

    // Ferme le menu au clic extérieur
    document.addEventListener('click', function(e){
      var el = document.getElementById('navUserMini');
      if (el && !el.contains(e.target)) el.classList.remove('open');
    });
  }

  function apply(){
    var session = readSession();
    if (!session) return; // Pas connecté : on garde la nav par défaut
    var cta = document.querySelector('.site-nav .nav-cta');
    if (!cta) return;
    renderConnected(cta, session);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
