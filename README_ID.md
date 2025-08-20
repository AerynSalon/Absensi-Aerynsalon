# Absensi QR v1.3.1 — + Teks Berjalan
- Ticker (teks berjalan) di bawah header. Pesan default: "jangan lupa berdoa sebelum memulai aktifitas".
- Ubah pesan lewat `config.js` → `TICKER_TEXT`.
- Hover pada ticker untuk pause.

Fitur lain tetap: kamera belakang + dropdown + restart scanner, jam online sinkron server, UI polished, input manual, kirim ke Google Sheets.

## v1.4.1 — Admin Login Fix + Dashboard Lengkap (2025-08-20 17:32)
- Tombol **Admin** + modal login di index
- Login fallback: jalan di `http/https` maupun `file://`
- Tema ungu AerynSalon (bisa override `APP_CONFIG.BRAND_HEX`)
- Admin Dashboard:
  - Sumber data: **local** / **cloud (Google Sheets)** + tombol **Sync**
  - Filter tanggal/tipe/cari
  - Rekap harian, **grafik** (harian/mingguan/bulanan, bar/line)
  - Rekap **per karyawan** (Top Hadir/Telat)
  - Export CSV

### Konfigurasi cepat
Di `config.js`:
```js
window.APP_CONFIG = {
  SHEET_WEB_APP_URL: "https://script.google.com/macros/s/AKfycb.../exec",
  SECRET: "samakan_dengan_ScriptProperties",
  CUTOFF_IN: "09:00",       // opsional
  BRAND_HEX: "#7c3aed"      // opsional
};
```
