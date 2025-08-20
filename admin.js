// Admin page script
async function sha256Hex(text){
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function ensureAdmin(){
  if (localStorage.getItem("isAdmin") !== "true"){
    alert("Akses ditolak. Silakan login admin di halaman utama.");
    window.location.href = "index.html";
  }
}
function $(id){ return document.getElementById(id); }
function renderStatus(){
  $("statusLogin").textContent = "Aktif";
  const url = (window.APP_CONFIG && window.APP_CONFIG.SHEET_WEB_APP_URL) || "(belum diatur)";
  $("statusSheetUrl").textContent = url || "(belum diatur)";
}

function getHistoryRaw(){
  try { return JSON.parse(localStorage.getItem("lastSubmissions")||"[]"); } catch(e){ return []; }
}
function parseDateOnly(s){ // 'YYYY-MM-DD' -> Date at 00:00 local
  if (!s) return null;
  try { const [y,m,d]=s.split("-").map(Number); return new Date(y, m-1, d); } catch(e){ return null; }
}
function within(d, from, to){
  if (!d) return false;
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}
function applyFilter(){
  return applyFilterWithSource();
}
function _applyFilterOriginal(){
  const q = $("fQuery").value.trim().toLowerCase();
  const t = $("fType").value;
  const from = parseDateOnly($("fFrom").value);
  const to = parseDateOnly($("fTo").value);
  const raw = getDataForFilter();
  const filtered = raw.filter(it=>{
    const p = it.payload||{};
    const when = new Date(it.at||p.timestamp_client||0);
    if (!within(when, from, to)) return false;
    if (t && (p.type||"") !== t) return false;
    const name = (p.employee_name||"").toLowerCase();
    const id = String(p.employee_id||"").toLowerCase();
    if (q && !(name.includes(q) || id.includes(q))) return false;
    return true;
  });
  renderTable(filtered);
  const sum = buildSummary(filtered); renderSummary(sum);
  renderCharts(filtered);
}

function ymd(d){ return d.toISOString().slice(0,10); }
function buildSummary(list){
  const map = new Map(); // key: YYYY-MM-DD -> {IN, OUT}
  for (const it of list){
    const p = it.payload||{};
    const when = new Date(it.at||p.timestamp_client||0);
    if (isNaN(when)) continue;
    const k = ymd(new Date(when.getFullYear(), when.getMonth(), when.getDate()));
    if (!map.has(k)) map.set(k, {IN:0, OUT:0});
    const t = (p.type||"").toUpperCase();
    if (t === "IN") map.get(k).IN++;
    else if (t === "OUT") map.get(k).OUT++;
  }
  // convert to rows sorted by date desc
  const rows = Array.from(map.entries()).map(([date, v]) => ({ date, IN: v.IN, OUT: v.OUT, total: v.IN + v.OUT }));
  rows.sort((a,b)=>a.date < b.date ? 1 : -1);
  return rows;
}
function renderSummary(rows){
  const tbody = $("sumTbody");
  tbody.innerHTML = "";
  if (!rows.length){
    tbody.innerHTML = '<tr><td class="p-2 text-gray-500" colspan="4">Tidak ada data.</td></tr>';
    return;
  }
  for (const r of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="p-2">${r.date}</td>
                    <td class="p-2">${r.IN}</td>
                    <td class="p-2">${r.OUT}</td>
                    <td class="p-2 font-semibold">${r.total}</td>`;
    tbody.appendChild(tr);
  }
}

function renderTable(list){
  const tbody = $("logTbody");
  tbody.innerHTML = "";
  if (!list.length){
    tbody.innerHTML = '<tr><td class="p-2 text-gray-500" colspan="4">Tidak ada data.</td></tr>';
    return;
  }
  renderTable(list);
  renderSummary(buildSummary(list));
  renderCharts(list);
  return;
  for (const item of list){
    const p = item.payload || {};
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="p-2 font-mono">${(item.at||"").replace("T"," ").slice(0,19)}</td>
                    <td class="p-2">${p.employee_name||"-"}</td>
                    <td class="p-2">${p.employee_id||"-"}</td>
                    <td class="p-2">${p.type||"-"}</td>`;
    tbody.appendChild(tr);
  }
}

function loadHistory(){
  let list = [];
  try { list = JSON.parse(localStorage.getItem("lastSubmissions")||"[]"); } catch(e){}
  const tbody = $("logTbody");
  tbody.innerHTML = "";
  if (!list.length){
    tbody.innerHTML = '<tr><td class="p-2 text-gray-500" colspan="4">Tidak ada data.</td></tr>';
    return;
  }
  renderTable(list);
  return;
  for (const item of list){
    const p = item.payload || {};
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="p-2 font-mono">${(item.at||"").replace("T"," ").slice(0,19)}</td>
                    <td class="p-2">${p.employee_name||"-"}</td>
                    <td class="p-2">${p.employee_id||"-"}</td>
                    <td class="p-2">${p.type||"-"}</td>`;
    tbody.appendChild(tr);
  }
}
function exportCsv(){
  let list = [];
  try { list = JSON.parse(localStorage.getItem("lastSubmissions")||"[]"); } catch(e){}
  if (!list.length){ alert("Belum ada riwayat untuk diexport."); return; }
  const header = ["waktu_client","employee_id","employee_name","type","salon","clock_source"];
  const rows = [header.join(",")];
  for (const it of list){
    const p = it.payload||{};
    const row = [
      (it.at||"").replace("T"," ").slice(0,19),
      p.employee_id||"",
      (p.employee_name||"").replace(/,/g," "),
      p.type||"",
      p.salon||"",
      p.clock_source||""
    ];
    rows.push(row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(","));
  }
  const blob = new Blob([rows.join("\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "riwayat_kirim_perangkat.csv";
  a.click();
  URL.revokeObjectURL(url);
}
function clearHistory(){
  localStorage.removeItem("lastSubmissions");
  loadHistory();
}
function bind(){
  $("btnSyncCloud").addEventListener("click", async ()=>{ await syncFromSheets(); applyFilterWithSource(); });
  $("dataSource").addEventListener("change", ()=>applyFilterWithSource());
  const hookCharts = ()=>{ const raw = getHistoryRaw(); applyFilter(); };
  $("chartPeriod").addEventListener("change", ()=>{ const raw = getHistoryRaw(); applyFilter(); });
  $("chartKind").addEventListener("change", ()=>{ const raw = getHistoryRaw(); applyFilter(); });
  $("btnApplyFilter").addEventListener("click", applyFilter);
  $("btnResetFilter").addEventListener("click", ()=>{ $("fFrom").value=""; $("fTo").value=""; $("fType").value=""; $("fQuery").value=""; loadHistory(); });
  $("btnLogout").addEventListener("click", ()=>{ localStorage.removeItem("isAdmin"); window.location.href="index.html"; });
  $("btnExportCsv").addEventListener("click", exportCsv);
  $("btnClearHistory").addEventListener("click", clearHistory);
  $("btnSetPass").addEventListener("click", async ()=>{
    const pw = $("newPass").value.trim();
    if (!pw){ alert("Masukkan password baru."); return; }
    const h = await sha256Hex(pw);
    localStorage.setItem("adminPassHash", h);
    alert("Password admin tersimpan di perangkat ini.");
    $("newPass").value = "";
  });
  $("btnClearPass").addEventListener("click", ()=>{
    localStorage.removeItem("adminPassHash");
    alert("Password direset ke default (aeryn123).");
  });
}
window.addEventListener("DOMContentLoaded", ()=>{
  ensureAdmin();
  renderStatus();
  loadHistory();
  bind();
  applyFilterWithSource();
});


// === Grouping & Charts ===
function startOfISOWeek(d){
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Mon=0..Sun=6
  date.setDate(date.getDate() - day);
  date.setHours(0,0,0,0);
  return date;
}
function isoWeekString(d){
  // returns 'YYYY-Www'
  const date = new Date(d.valueOf());
  date.setHours(0,0,0,0);
  // Thursday in current week decides the year
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(),0,4);
  const weekNo = 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  const y = date.getFullYear();
  return y + "-W" + String(weekNo).padStart(2,"0");
}
function monthKey(d){
  const y = d.getFullYear(); const m = d.getMonth()+1;
  return y + "-" + String(m).padStart(2,"0");
}
function buildGrouped(list, period){
  const map = new Map();
  for (const it of list){
    const p = it.payload||{};
    const when = new Date(it.at||p.timestamp_client||0);
    if (isNaN(when)) continue;
    let key;
    if (period === "weekly") key = isoWeekString(when);
    else if (period === "monthly") key = monthKey(when);
    else key = ymd(new Date(when.getFullYear(), when.getMonth(), when.getDate()));
    if (!map.has(key)) map.set(key, {IN:0, OUT:0});
    const t = (p.type||"").toUpperCase();
    if (t === "IN") map.get(key).IN++;
    else if (t === "OUT") map.get(key).OUT++;
  }
  const rows = Array.from(map.entries()).map(([k,v])=>({ key:k, IN:v.IN, OUT:v.OUT, total:v.IN+v.OUT }));
  rows.sort((a,b)=> a.key < b.key ? -1 : 1 ); // asc
  return rows;
}
let chartTotalRef = null, chartInOutRef = null;
function renderCharts(list){
  const period = $("chartPeriod").value || "daily";
  const kind = $("chartKind").value || "bar";
  const rows = buildGrouped(list, period);
  const labels = rows.map(r=>r.key);
  const totals = rows.map(r=>r.total);
  const ins = rows.map(r=>r.IN);
  const outs = rows.map(r=>r.OUT);
  const type = kind;

  if (chartTotalRef){ chartTotalRef.destroy(); }
  if (chartInOutRef){ chartInOutRef.destroy(); }

  const ctx1 = document.getElementById("chartTotal").getContext("2d");
  chartTotalRef = new Chart(ctx1, {
    type,
    data: { labels, datasets: [{ label: "Total", data: totals }] },
    options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
  });

  const ctx2 = document.getElementById("chartInOut").getContext("2d");
  chartInOutRef = new Chart(ctx2, {
    type,
    data: { labels, datasets: [
      { label: "IN", data: ins },
      { label: "OUT", data: outs }
    ]},
    options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
  });
}


// === Cloud sync & per-employee recap ===
function getCutoff(){ return (window.APP_CONFIG && (window.APP_CONFIG.CUTOFF_IN || window.APP_CONFIG.CUTOFF)) || "09:00"; }
function parseCutoffToHM(cut){ const [h,m] = (cut||"09:00").split(":").map(x=>parseInt(x||"0")); return {h: h||9, m: m||0}; }
function combineData(source){
  if (source === "cloud"){
    try { return JSON.parse(localStorage.getItem("cloudSubmissions")||"[]"); } catch(e){ return []; }
  }
  // default local
  try { return JSON.parse(localStorage.getItem("lastSubmissions")||"[]"); } catch(e){ return []; }
}
async function syncFromSheets(){
  const base = (window.APP_CONFIG && window.APP_CONFIG.SHEET_WEB_APP_URL) || "";
  const secret = (window.APP_CONFIG && window.APP_CONFIG.SECRET) || "";
  if (!base || !secret){ alert("SHEET_WEB_APP_URL / SECRET belum diatur di config.js"); return; }
  const url = base + (base.includes("?") ? "&" : "?") + "action=read&limit=2000&secret=" + encodeURIComponent(secret);
  const resp = await fetch(url, { method: "GET", mode: "cors" });
  if (!resp.ok){ alert("Gagal membaca dari Sheets: " + resp.status); return; }
  const data = await resp.json();
  if (!Array.isArray(data.rows)){ alert("Format respons tidak sesuai"); return; }
  // expect rows as array of objects with at least: timestamp_client, employee_id, employee_name, type, salon, clock_source
  const mapped = data.rows.map(r=>({ at: r.timestamp_client || r.timestamp_server || r.at || "", payload: {
    employee_id: r.employee_id, employee_name: r.employee_name, type: r.type, salon: r.salon, clock_source: r.clock_source
  }}));
  localStorage.setItem("cloudSubmissions", JSON.stringify(mapped));
  alert("Sync selesai: " + mapped.length + " baris");
}
function getDataForFilter(){
  const src = $("dataSource") ? $("dataSource").value : "local";
  return combineData(src);
}
function applyFilterWithSource(){
  const raw = getDataForFilter();
  // reuse existing filter controls
  const q = $("fQuery").value.trim().toLowerCase();
  const t = $("fType").value;
  const from = parseDateOnly($("fFrom").value);
  const to = parseDateOnly($("fTo").value);
  const filtered = raw.filter(it=>{
    const p = it.payload||{};
    const when = new Date(it.at||p.timestamp_client||0);
    if (isNaN(when)) return false;
    if (!within(when, from, to)) return false;
    if (t && (p.type||"") !== t) return false;
    const name = (p.employee_name||"").toLowerCase();
    const id = String(p.employee_id||"").toLowerCase();
    if (q && !(name.includes(q) || id.includes(q))) return false;
    return true;
  });
  renderTable(filtered);
  const sum = buildSummary(filtered); renderSummary(sum);
  renderCharts(filtered);
  renderPerEmployee(filtered);
}
function renderPerEmployee(list){
  const cutoff = parseCutoffToHM(getCutoff());
  const per = new Map(); // key=id -> {name, present, late}
  for (const it of list){
    const p = it.payload||{};
    const id = String(p.employee_id||"");
    const name = p.employee_name||"";
    if (!per.has(id)) per.set(id, {name, present:0, late:0});
    const when = new Date(it.at||p.timestamp_client||0);
    const isIn = (p.type||"").toUpperCase() === "IN";
    if (isIn){
      per.get(id).present++;
      const hh = when.getHours(), mm = when.getMinutes();
      if (hh > cutoff.h || (hh===cutoff.h && mm > cutoff.m)) per.get(id).late++;
    }
  }
  const arr = Array.from(per.entries()).map(([id, o])=>({id, name:o.name, present:o.present, late:o.late}));
  // Top hadir (present desc)
  const topPresent = [...arr].sort((a,b)=> b.present - a.present).slice(0,10);
  // Top telat (late desc)
  const topLate = [...arr].sort((a,b)=> b.late - a.late).slice(0,10);
  const tp = $("topPresentTbody"), tl = $("topLateTbody");
  tp.innerHTML = topPresent.length ? "" : '<tr><td class="p-2 text-gray-500" colspan="3">Tidak ada data.</td></tr>';
  for (const r of topPresent){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="p-2">${r.name||"-"}</td><td class="p-2">${r.id}</td><td class="p-2 font-semibold">${r.present}</td>`;
    tp.appendChild(tr);
  }
  tl.innerHTML = topLate.length ? "" : '<tr><td class="p-2 text-gray-500" colspan="3">Tidak ada data.</td></tr>';
  for (const r of topLate){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="p-2">${r.name||"-"}</td><td class="p-2">${r.id}</td><td class="p-2 font-semibold">${r.late}</td>`;
    tl.appendChild(tr);
  }
}
