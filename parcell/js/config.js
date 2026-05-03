// ============================================================
// config.js — Configuration Supabase & paramètres globaux
// ============================================================
// 📌 INSTRUCTIONS DE SETUP :
// 1. Créer un compte sur https://supabase.com
// 2. Créer un nouveau projet "parcell"
// 3. Aller dans Settings > API
// 4. Copier "Project URL" et "anon public key" ci-dessous

const SUPABASE_URL = 'VOTRE_SUPABASE_URL';        // ex: https://xxxx.supabase.co
const SUPABASE_ANON_KEY = 'VOTRE_SUPABASE_ANON_KEY'; // clé publique (safe côté client)

// Initialisation du client Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Paramètres globaux de l'app ──
const APP_CONFIG = {
  name: 'Parcell',
  version: '1.0.0',
  maxProjectsFree: 5,       // Limite plan gratuit
  maxProjectsPro: Infinity,
  defaultCity: 'Lyon',
};

// ── Couleurs cohérentes avec le design ──
const COLORS = [
  '#c9a84c','#2dd4bf','#818cf8','#f472b6','#34d399',
  '#fb923c','#60a5fa','#a78bfa','#4ade80','#fbbf24',
  '#e879f9','#38bdf8'
];
