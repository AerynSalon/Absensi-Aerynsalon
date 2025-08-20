# Absensi QR v1.3.1 — + Teks Berjalan
- Ticker (teks berjalan) di bawah header. Pesan default: "jangan lupa berdoa sebelum memulai aktifitas".
- Ubah pesan lewat `config.js` → `TICKER_TEXT`.
- Hover pada ticker untuk pause.

Fitur lain tetap: kamera belakang + dropdown + restart scanner, jam online sinkron server, UI polished, input manual, kirim ke Google Sheets.


## v1.3.1 + Admin Role (build 2025-08-20 16:21:44)
- Tambah role admin (login lokal, default password `aeryn123`)
- Halaman baru: `admin.html` + `admin.js`
- Tombol **Admin** di header index → buka modal login / masuk dashboard
- Dashboard menampilkan riwayat kirim terakhir (perangkat ini) + Export CSV + ubah password admin
- Catatan: proteksi bersifat lokal (client-side). Untuk proteksi server/Sheets, gunakan validasi di Apps Script (SECRET dsb).


## v1.3.2 — Branding ungu + Filter Admin (2025-08-20 16:33)
- Utilitas CSS brand: .btn-brand, .badge-brand, dll (default ungu, bisa override lewat `APP_CONFIG.BRAND_HEX`)
- Tombol utama diganti ke warna brand
- Admin Dashboard: filter tanggal (From/To), tipe IN/OUT, dan pencarian nama/ID


## v1.3.3 — Rekap Ringkas per Hari (2025-08-20 16:39)
- Admin Dashboard: tabel rekap harian (IN/OUT/Total) mengikuti filter yang dipilih


## v1.3.4 — Rekap Mingguan/Bulanan + Grafik (2025-08-20 16:40)
- Admin: Periode grafik bisa dipilih (Harian/Mingguan/Bulanan)
- Jenis grafik: Bar atau Line
- Grafik mengikuti hasil filter yang aktif


## v1.4.0 — Rekap per Karyawan + Sinkron Sheets (2025-08-20 16:44)
- Admin: Rekap per karyawan (Top Hadir & Top Telat, cutoff default 09:00, bisa ubah via `APP_CONFIG.CUTOFF_IN`)
- Sumber data: pilih **Perangkat ini** atau **Gabungan (Google Sheets)**
- Tombol **Sync dari Sheets** memuat data via endpoint `action=read`

### Apps Script: Endpoint READ (gabungkan data semua perangkat)
Tambahkan ke `Code.gs`:

```javascript
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "info";
  if (action === "read") return handleRead_(e);
  // fallback info
  return ContentService.createTextOutput(JSON.stringify({ok:true, action: action})).setMimeType(ContentService.MimeType.JSON);
}

function handleRead_(e){
  try{
    var secret = e.parameter.secret || "";
    var LIMIT = parseInt(e.parameter.limit || "2000", 10);
    if (!validateSecret_(secret)) return json_({ok:false, error:"unauthorized"});
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName("Absensi"); // sesuaikan
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return json_({ok:true, rows: []});
    var startRow = Math.max(2, lastRow - LIMIT + 1);
    var rng = sh.getRange(startRow, 1, lastRow - startRow + 1, sh.getLastColumn());
    var values = rng.getValues();
    var headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
    var rows = values.map(function(row){
      var obj = {};
      for (var i=0;i<headers.length;i++){ obj[headers[i]] = row[i]; }
      // Normalisasi beberapa nama kolom umum
      obj.timestamp_client = obj.timestamp_client || obj["timestamp client"] || obj["timestamp_client"];
      obj.timestamp_server = obj.timestamp_server || obj["timestamp server"] || obj["timestamp_server"];
      obj.employee_id = obj.employee_id || obj["employee id"] || obj["employee_id"];
      obj.employee_name = obj.employee_name || obj["employee name"] || obj["employee_name"];
      obj.type = obj.type || obj["type"];
      obj.salon = obj.salon || obj["salon"];
      obj.clock_source = obj.clock_source || obj["clock source"] || obj["clock_source"];
      return obj;
    });
    return json_({ok:true, rows: rows});
  }catch(err){
    return json_({ok:false, error: String(err)});
  }
}

function validateSecret_(s){
  var prop = PropertiesService.getScriptProperties().getProperty("SECRET");
  // atau jika Anda menyimpan SECRET di sel tertentu:
  // var prop = SpreadsheetApp.getActive().getSheetByName("Config").getRange("B2").getValue();
  return prop && s && String(prop) === String(s);
}
function json_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
```
Pastikan `SECRET` di **Script Properties** sama dengan `APP_CONFIG.SECRET` di `config.js`.

