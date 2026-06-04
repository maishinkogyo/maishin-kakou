/**
 * Supabase クライアント（全画面共通）
 * 変更時はこのファイルのみ編集してください。
 */
(function (global) {
  const SB_URL = 'https://eejudrgbzemtzzsffrgg.supabase.co';
  const SB_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlanVkcmdiemVtdHp6c2ZmcmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODU2MDksImV4cCI6MjA5MDM2MTYwOX0.ILiz-E7j_ZW52o0HHPxARGEUfUaXJ_-yDUFfBne2Fsc';

  if (!global.supabase || typeof global.supabase.createClient !== 'function') {
    console.error('Supabase JS SDK が読み込まれていません');
    return;
  }

  const sb = global.supabase.createClient(SB_URL, SB_KEY);
  global.sb = sb;
  global.MaishinSupabase = { SB_URL, SB_KEY, sb };
})(typeof window !== 'undefined' ? window : globalThis);
