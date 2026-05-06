const SUPABASE_URL = 'https://odjxxbbufbumlyxgqkaq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MOcAWRPbtcgnLOPMbTP5Sg_VLWoTZO8';

// Initialisation — nom "supabaseClient" pour éviter le conflit avec le SDK
const supabaseClient = window.supabase.createClient ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const APP_CONFIG = {
  name: 'Parcell',
  version: '1.0.0',
  maxProjectsFree: 5,
  maxProjectsPro: Infinity,
  defaultCity: 'Lyon',
};

const COLORS = [
  '#c9a84c','#2dd4bf','#818cf8','#f472b6','#34d399',
  '#fb923c','#60a5fa','#a78bfa','#4ade80','#fbbf24',
  '#e879f9','#38bdf8'
];
