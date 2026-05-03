# 🚀 Guide de mise en ligne Parcell — Étape par Étape

## Ce que tu vas avoir à la fin
- Une vraie app en ligne avec une URL du type `https://parcell.netlify.app`
- Authentification email + Google qui fonctionne
- Projets sauvegardés en base de données réelle
- Déploiement automatique à chaque modification du code

---

## ÉTAPE 1 — Créer le compte GitHub (5 min)

1. Va sur **https://github.com** → "Sign up"
2. Choisis un nom d'utilisateur (ex: `thomas-parcell`)
3. Vérifie ton email
4. Crée un **nouveau repository** :
   - Clique sur "+" en haut à droite → "New repository"
   - Nom : `parcell`
   - Visibilité : **Private** (recommandé)
   - Clique "Create repository"

5. Sur ta machine, installe **Git** : https://git-scm.com/downloads
6. Ouvre un terminal dans le dossier `parcell/` et tape :
```bash
git init
git add .
git commit -m "Initial commit — Parcell v1"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/parcell.git
git push -u origin main
```
> Remplace `TON_USERNAME` par ton nom GitHub

---

## ÉTAPE 2 — Créer le projet Supabase (10 min)

1. Va sur **https://supabase.com** → "Start your project" → Créer un compte
2. Clique "New project" :
   - Nom : `parcell`
   - Mot de passe BDD : génère-en un fort, **sauvegarde-le**
   - Région : **West EU (Ireland)** (le plus proche de la France)
3. Attends ~2 minutes que le projet se crée

### Configurer la base de données
4. Dans le menu gauche : **SQL Editor** → "New query"
5. Copie-colle tout le contenu de `supabase_schema.sql`
6. Clique "Run" → Tu devrais voir "Success"

### Récupérer les clés API
7. Menu gauche : **Settings** → **API**
8. Copie :
   - **Project URL** → ex: `https://abcdefgh.supabase.co`
   - **anon public** (section "Project API keys")

9. Ouvre `js/config.js` et remplace :
```javascript
const SUPABASE_URL = 'https://abcdefgh.supabase.co';   // ← ta vraie URL
const SUPABASE_ANON_KEY = 'eyJhbGci...';                // ← ta vraie clé
```

### Activer l'authentification email
10. Menu gauche : **Authentication** → **Providers** → **Email**
    - "Enable Email provider" : ✅
    - "Confirm email" : ✅ (envoie un email de vérification)
    - Sauvegarde

---

## ÉTAPE 3 — Activer Google OAuth (15 min)

### Créer les credentials Google
1. Va sur **https://console.cloud.google.com**
2. Crée un nouveau projet : "Parcell"
3. Menu → **APIs & Services** → **Credentials**
4. "Create Credentials" → "OAuth 2.0 Client IDs"
5. Application type : **Web application**
6. Authorized redirect URIs → ajoute :
   ```
   https://abcdefgh.supabase.co/auth/v1/callback
   ```
   (remplace avec ton URL Supabase)
7. Clique "Create" → note le **Client ID** et **Client Secret**

### Brancher dans Supabase
8. Supabase → **Authentication** → **Providers** → **Google**
9. Enable Google : ✅
10. Colle le Client ID et Client Secret
11. Sauvegarde

---

## ÉTAPE 4 — Déployer sur Netlify (5 min)

1. Va sur **https://netlify.com** → "Sign up" (avec ton compte GitHub)
2. Clique **"Add new site"** → **"Import an existing project"**
3. Choisis **GitHub** → Autorise Netlify → Sélectionne le repo `parcell`
4. Paramètres de build :
   - Build command : *(laisser vide)*
   - Publish directory : `.` (un point)
5. Clique **"Deploy site"**
6. Dans ~30 secondes → ton app est en ligne ! 🎉

### Configurer les redirections OAuth
7. Dans Netlify → **Site settings** → **Domain management**
8. Note ton URL : ex `https://amazing-name-123.netlify.app`
9. Retourne dans Supabase → **Authentication** → **URL Configuration**
10. Site URL : `https://amazing-name-123.netlify.app`
11. Redirect URLs : ajoute `https://amazing-name-123.netlify.app`

### Retourne dans Google Cloud Console
12. **APIs & Services** → **Credentials** → ton Client OAuth
13. Ajoute dans "Authorized redirect URIs" :
    ```
    https://amazing-name-123.netlify.app/
    ```

---

## ÉTAPE 5 — Tester (5 min)

1. Ouvre `https://amazing-name-123.netlify.app`
2. Tu devrais voir l'écran de connexion Parcell
3. Teste l'inscription avec un email → vérifie que l'email de confirmation arrive
4. Teste la connexion Google
5. Crée une simulation → sauvegarde → ferme l'onglet → reconnecte → vérifie que le projet est là ✅

---

## Déployer des modifications

Chaque fois que tu modifies le code :
```bash
git add .
git commit -m "Description de la modification"
git push
```
Netlify redéploie automatiquement en ~30 secondes. C'est tout.

---

## En cas de problème

| Problème | Solution |
|---|---|
| Écran blanc | Ouvre la console navigateur (F12) → regarde les erreurs |
| "Invalid API key" | Vérifie `js/config.js` → les clés Supabase |
| Google OAuth ne fonctionne pas | Vérifie les Redirect URIs dans Google Cloud Console |
| Email de vérification non reçu | Vérifie les spams, ou désactive "Confirm email" pour tester |
| Erreur SQL | Ré-exécute `supabase_schema.sql` dans SQL Editor |

---

## Structure finale du projet

```
parcell/
├── index.html          ← Point d'entrée de l'app
├── netlify.toml        ← Config déploiement
├── supabase_schema.sql ← Schéma base de données
├── SETUP.md            ← Ce fichier
├── css/
│   └── main.css        ← Tous les styles
└── js/
    ├── config.js       ← Clés Supabase (⚠️ ne jamais committer en public)
    ├── auth.js         ← Login, signup, OAuth, session
    ├── app.js          ← Orchestration, onglets, compte
    ├── data.js         ← Données villes, quartiers Lyon
    ├── simulator.js    ← Calculs financiers
    ├── projects.js     ← Sauvegarde/chargement projets (Supabase)
    └── map.js          ← Carte Leaflet, polygones
```

---

## Sécurité importante

⚠️ **Ne jamais mettre `config.js` dans un repo public GitHub** — la clé `anon` est safe côté client mais par habitude, ajoute `.gitignore` :

```
# .gitignore
.DS_Store
node_modules/
```

La clé `anon` Supabase est conçue pour être utilisée côté client — elle ne donne accès qu'aux données autorisées par les politiques RLS (Row Level Security) que tu as configurées.
