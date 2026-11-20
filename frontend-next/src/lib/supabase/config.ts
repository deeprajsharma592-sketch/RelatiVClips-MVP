const DEFAULT_SUPABASE_URL = "https://avyfsbbzdahfbcdhzoxv.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_92hUQKytRADNih6pWij9dw_S6rcY031";

export function getSupabasePublicConfig() {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    DEFAULT_SUPABASE_URL
  );
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_KEY
  )?.trim();

  if (!url || !key) return null;
  return { url, key };
}

