/**
 * config.js — Konfigurasi terpusat untuk Firebase Hybrid
 * Setelah deploy Apps Script, isi APPS_SCRIPT_URL di bawah ini.
 *
 * CARA MENDAPATKAN URL:
 * 1. Buka Google Spreadsheet Anda → Ekstensi → Apps Script
 * 2. Paste isi file Code.gs
 * 3. Klik Deploy → New deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Salin URL yang muncul (berawalan https://script.google.com/macros/s/...)
 * 5. Ganti nilai APPS_SCRIPT_URL di bawah ini
 */

const APPS_SCRIPT_URL = 'PASTE_URL_APPS_SCRIPT_ANDA_DI_SINI';

/**
 * apiFetch — wrapper untuk semua request ke Apps Script
 * Semua request menggunakan GET (CORS-compatible dengan Apps Script doGet)
 * Data dikirim melalui query parameters
 */
async function apiFetch(params) {
  const url = new URL(APPS_SCRIPT_URL);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  // Tambahkan cache-buster untuk hindari browser cache pada data dinamis
  url.searchParams.set('_t', Date.now());

  const res = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('Server error: ' + res.status);
  return res.json();
}

// Export ke window global
window.API = { apiFetch, APPS_SCRIPT_URL };
