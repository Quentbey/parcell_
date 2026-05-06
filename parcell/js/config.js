const SUPABASE_URL = 'https://odjxxbbufbumlyxgqkaq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MOcAWRPbtcgnLOPMbTP5Sg_VLWoTZO8';

// Initialisation — nom "supabaseClient" pour éviter le conflit avec le SDK
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const APP_CONFIG = {
  name: 'Parcell',
  version: '1.0.0',
  maxProjectsFree: 5,
  maxProjectsPro: Infinity,
  defaultCity: 'Lyon',
};
