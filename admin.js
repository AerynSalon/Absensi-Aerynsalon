// Admin page script
async function sha256Hex(text){
  try{
    if (!(window.crypto && window.crypto.subtle)) return null;
    const enc = new TextEncoder().encode(text);
    const buf = await window.crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
  }catch(e){ return null; }
}
function ensureAdmin(){
  if (localStorage.getItem("isAdmin") !== "true"){
    alert("Akses ditolak. Silakan login admin di halaman utama.");
    window.location.href = "index.html";
  }
}
function $(id){ return document.getElementById(id); }

// Helpers
function parseDateOnly(s){ if (!s) return null; try{ const [y,m,d]=s.split("-").map(Number); return new Date(y, m-1, d);}catch(e){return null;} }
function within(d, from, to){ if (!d) return false; const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()); if (from && day < from) return false; if (to && day > to) return false; return true; }
function ymd(d){ return d.toISOString().slice(0,10); }
function startOfISOWeek(d){ const date=new Date(d); const day=(date.getDay()+6)%7; date.setDate(date.getDate()-day); date.setHours(0,0,0,0); return date; }
function isoWeekString(d){ const date=new Date(d.valueOf()); date.setHours(0,0,0,0); date.setDate(date.getDate()+3-((date.getDay()+6)%7)); const week1=new Date(date.getFullYear(),0,4); const weekNo=1+Math.round(((date-week1)/86400000-3+((week1.getDay()+6)%7))/7); const y=date.getFullYear(); return y+"-W"+String(weekNo).padStart(2,"0"); }
function monthKey(d){ const y=d.getFullYear(); const m=d.getMonth()+1; return y+"-"+String(m).padStart(2,"0"); }
function getCutoff(){ return (window.APP_CONFIG && (window.APP_CONFIG.CUTOFF_IN || window.APP_CONFIG.CUTOFF)) || "09:00"; }
function parseCutoffToHM(cut){ const [h,m]=(cut||"09:00").split(":").map(x=>parseInt(x||"0")); return {h:h||9, m:m||0}; }

// Data sources
function getHistoryRaw(){ try { return JSON.parse(localStorage.getItem("lastSubmissions")||"[]"); } catch(e){ return []; } }
function getCloudRaw(){ try { return JSON.parse(localStorage.getItem("cloudSubmissions")||"[]"); } catch(e){ return []; } }
function getDataForFilter(){ const src = $("dataSource") ? $("dataSource").value : "local"; return src==="cloud" ? getCloudRaw() : getHistoryRaw(); }
async function syncFromSheets(){
  const base = (window.APP_CONFIG && window.APP_CONFIG.SHEET_WEB_APP_URL) || "";
  const secret = (window.APP_CONFIG && window.APP_CONFIG.SECRET) || "";
  if (!base || !secret){ alert("SHEET_WEB_APP_URL / SECRET belum diatur di config.js"); return; }
  const url = base + (base.includes("?") ? "&" : "?") + "action=read&limit=2000&secret=" + encodeURIComponent(secret);
  const resp = await fetch(url, { method:"GET", mode:"cors" });
  if (!resp.ok){ alert("Gagal membaca dari Sheets: " + resp.status); return; }
  const data = await resp.json();
  if (!Array.isArray(data.rows)){ alert("Format respons tidak sesuai"); return; }
  const mapped = data.rows.map(r=>({ at: r.timestamp_client || r.timestamp_server || r.at || "", payload: {
    employee_id: r.employee_id, employee_name: r.employee_name, type: r.type, salon: r.salon, clock_source: r.clock_source
  }}));
  localStorage.setItem("cloudSubmissions", JSON.stringify(mapped));
  alert("Sync selesai: " + mapped.length + " baris");
}

// Rendering
function renderStatus(){
  // Optional: bisa tambah info konfigurasi
}
function renderTable(list){
  const tbody = $("logTbody");
  tbody.innerHTML = "";
  if (!list.length){ tbody.innerHTML = '<tr><td class="p-2 text-gray-500" colspan="4">Tidak ada data.</td></tr>'; return; }
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
function buildSummary(list){
  const map = new Map();
  for (const it of list){
    const p = it.payload||{};
    const when = new Date(it.at||p.timestamp_client||0);
    if (isNaN(when)) continue;
    const k = ymd(new Date(when.getFullYear(), when.getMonth(), when.getDate()));
    if (!map.has(k)) map.set(k, {IN:0, OUT:0});
    const t = (p.type||"").toUpperCase();
    if (t === "IN") map.get(k).IN++; else if (t === "OUT") map.get(k).OUT++;
  }
  const rows = Array.from(map.entries()).map(([date, v]) => ({ date, IN:v.IN, OUT:v.OUT, total:v.IN+v.OUT })).sort((a,b)=>a.date<b.date?1:-1);
  return rows;
}
function renderSummary(rows){
  const tbody = $("sumTbody");
  tbody.innerHTML = "";
  if (!rows.length){ tbody.innerHTML = '<tr><td class="p-2 text-gray-500" colspan="4">Tidak ada data.</td></tr>'; return; }
  for (const r of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="p-2">${r.date}</td><td class="p-2">${r.IN}</td><td class="p-2">${r.OUT}</td><td class="p-2 font-semibold">${r.total}</td>`;
    tbody.appendChild(tr);
  }
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
    if (t === "IN") map.get(key).IN++; else if (t === "OUT") map.get(key).OUT++;
  }
  const rows = Array.from(map.entries()).map(([k,v])=>({ key:k, IN:v.IN, OUT:v.OUT, total:v.IN+v.OUT })).sort((a,b)=> a.key < b.key ? -1 : 1);
  return rows;
}
let chartTotalRef=null, chartInOutRef=null;
function renderCharts(list){
  const period = $("chartPeriod").value || "daily";
  const kind = $("chartKind").value || "bar";
  const rows = buildGrouped(list, period);
  const labels = rows.map(r=>r.key);
  const totals = rows.map(r=>r.total);
  const ins = rows.map(r=>r.IN);
  const outs = rows.map(r=>r.OUT);
  if (chartTotalRef){ chartTotalRef.destroy(); }
  if (chartInOutRef){ chartInOutRef.destroy(); }
  chartTotalRef = new Chart(document.getElementById("chartTotal").getContext("2d"), {
    type: kind, data: { labels, datasets: [{ label:"Total", data: totals }] },
    options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
  });
  chartInOutRef = new Chart(document.getElementById("chartInOut").getContext("2d"), {
    type: kind, data: { labels, datasets: [{ label:"IN", data: ins }, { label:"OUT", data: outs }] },
    options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
  });
}
function renderPerEmployee(list){
  const cutoff = parseCutoffToHM(getCutoff());
  const per = new Map();
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
  const topPresent = [...arr].sort((a,b)=> b.present - a.present).slice(0,10);
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

// Filter logic
function applyFilter(){
  return applyFilterWithSource();
}
function applyFilterWithSource(){
  const raw = getDataForFilter();
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
  renderSummary(buildSummary(filtered));
  renderCharts(filtered);
  renderPerEmployee(filtered);
}

// Export & bind
function exportCsv(){
  const raw = getDataForFilter();
  if (!raw.length){ alert("Belum ada data untuk diexport."); return; }
  const header = ["waktu_client","employee_id","employee_name","type","salon","clock_source"];
  const rows = [header.join(",")];
  for (const it of raw){
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
  const blob = new Blob([rows.join("\\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "rekap.csv"; a.click(); URL.revokeObjectURL(url);
}
function bind(){
  $("btnLogout").addEventListener("click", ()=>{ localStorage.removeItem("isAdmin"); window.location.href="index.html"; });
  $("btnExportCsv").addEventListener("click", exportCsv);
  $("btnClearHistory").addEventListener("click", ()=>{ localStorage.removeItem("lastSubmissions"); localStorage.removeItem("cloudSubmissions"); applyFilterWithSource(); });
  const elDS=$("dataSource"); if (elDS){ elDS.addEventListener("change", ()=>applyFilterWithSource()); }
  const btnSync=$("btnSyncCloud"); if (btnSync){ btnSync.addEventListener("click", async ()=>{ await syncFromSheets(); applyFilterWithSource(); }); }
  $("btnApplyFilter").addEventListener("click", applyFilterWithSource);
  $("btnResetFilter").addEventListener("click", ()=>{ $("fFrom").value=""; $("fTo").value=""; $("fType").value=""; $("fQuery").value=""; applyFilterWithSource(); });
}
window.addEventListener("DOMContentLoaded", ()=>{
  ensureAdmin();
  bind();
  applyFilterWithSource();
});
