// v1.3.1 — + Ticker running text
let currentMode = "IN";
let lastScanData = null;
let html5Qr;
const readerElId = "reader";

let cameras = [];
let currentCameraId = null;

// Online clock
let serverOffsetMs = 0; // server_now - Date.now()
let lastSyncAt = null;
let lastSyncSource = "Peramban"; // "Server" | "Peramban"

function toast(msg, type="info", ms=2000){
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  el.style.opacity = "1";
  el.style.background = type === "error" ? "#b91c1c" : type === "success" ? "#065f46" : "#111827";
  setTimeout(()=>{ el.style.opacity="0"; setTimeout(()=>el.classList.add("hidden"), 300); }, ms);
}
function format2(n){ return n < 10 ? "0"+n : ""+n; }
function fmtDate(d){
  const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][d.getDay()];
  const bln = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][d.getMonth()];
  return `${hari}, ${format2(d.getDate())} ${bln} ${d.getFullYear()}`;
}
function nowOnline(){ return new Date(Date.now() + serverOffsetMs); }
function renderClock(){
  const n = nowOnline();
  const hh = format2(n.getHours()), mm = format2(n.getMinutes()), ss = format2(n.getSeconds());
  document.getElementById("clock").textContent = `${hh}:${mm}:${ss}`;
  document.getElementById("clockDate").textContent = fmtDate(n);
}
function updateClockMeta(src){
  const offsetStr = `${serverOffsetMs >= 0 ? "+" : ""}${Math.round(serverOffsetMs)} ms`;
  const syncStr = lastSyncAt ? lastSyncAt.toLocaleString() : "—";
  const source = src === "server" ? "Server (Apps Script)" : "Peramban (lokal)";
  document.getElementById("clockMeta").textContent = `Sumber: ${source} | Offset: ${offsetStr} | Sinkron: ${syncStr}`;
}
async function syncServerTime(){
  const url = (window.APP_CONFIG && window.APP_CONFIG.SHEET_WEB_APP_URL) || "";
  serverOffsetMs = 0;
  let source = "local";
  if (url){
    try{
      const resp = await fetch(url, { method: "GET", cache: "no-store" });
      const txt = await resp.text();
      let data = null;
      try{ data = JSON.parse(txt); }catch(e){}
      let serverIso = data && (data.now || data.serverTime || data.date || data.time);
      if (!serverIso){
        const h = resp.headers.get("Date");
        if (h) serverIso = new Date(h).toISOString();
      }
      if (serverIso){
        serverOffsetMs = new Date(serverIso).getTime() - Date.now();
        source = "server";
      }
    }catch(e){}
  }
  lastSyncSource = (source === "server" ? "Server" : "Peramban");
  lastSyncAt = new Date();
  updateClockMeta(source);
  renderClock();
}

function initTicker(){
  const el = document.getElementById("tickerTrack");
  if (!el) return;
  const text = (window.APP_CONFIG && window.APP_CONFIG.TICKER_TEXT) || "jangan lupa berdoa sebelum memulai aktifitas";
  el.innerHTML = `<span class="px-6">• ${text}</span><span class="px-6">• ${text}</span><span class="px-6">• ${text}</span>`;
}

function setMode(mode) {
  currentMode = mode;
  document.getElementById("modeBadge").textContent = `Mode: ${mode === "IN" ? "Check-In" : "Check-Out"}`;
  document.getElementById("empType").textContent = mode;
}
function initButtons() {
  document.getElementById("btnCheckin").addEventListener("click", () => setMode("IN"));
  document.getElementById("btnCheckout").addEventListener("click", () => setMode("OUT"));
  document.getElementById("btnUlang").addEventListener("click", resetScan);
  document.getElementById("btnKirim").addEventListener("click", submitToSheet);
  document.getElementById("btnResync").addEventListener("click", async () => {
    await syncServerTime();
    toast("Jam tersinkron", "success");
  
  const adminBtn = document.getElementById("btnAdmin"); if (adminBtn){ adminBtn.addEventListener("click", ()=>{ if(localStorage.getItem("isAdmin")==="true"){ window.location.href="admin.html"; } else { showAdminModal(true); } }); }
  const adminLoginBtn = document.getElementById("adminLogin"); if (adminLoginBtn){ adminLoginBtn.addEventListener("click", ()=>loginAdmin()); }
  const adminCancelBtn = document.getElementById("adminCancel"); if (adminCancelBtn){ adminCancelBtn.addEventListener("click", ()=>showAdminModal(false)); }
});
  document.getElementById("btnRestart").addEventListener("click", async () => {
    await restartScanner();
    toast("Scanner di-restart", "info");
  });
  document.getElementById("manualForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = await buildPayload({
      id: document.getElementById("m_id").value.trim(),
      name: document.getElementById("m_nama").value.trim(),
      type: document.getElementById("m_type").value,
    });
    sendPayload(payload);
  });
}

function resetScan() {
  lastScanData = null;
  document.getElementById("empId").textContent = "-";
  document.getElementById("empName").textContent = "-";
  document.getElementById("empType").textContent = currentMode;
  document.getElementById("empTime").textContent = "-";
  document.getElementById("btnKirim").disabled = true;
  document.getElementById("serverResponse").innerHTML = "";
  document.getElementById("scanStatus").textContent = "Scanner siap.";
}
function parseQrText(text) {
  try {
    const obj = JSON.parse(text);
    if (obj && obj.id && obj.name) return { id: String(obj.id), name: String(obj.name) };
  } catch (e) {}
  if (text.includes("|")) {
    const [id, name] = text.split("|");
    return { id: (id || "").trim(), name: (name || "").trim() };
  }
  return null;
}
async function buildPayload(base) {
  const ts = new Date(nowOnline());
  let lat = null, lng = null;
  try {
    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
    });
    if (pos && pos.coords) { lat = pos.coords.latitude; lng = pos.coords.longitude; }
  } catch (e) {}
  return {
    secret: (window.APP_CONFIG && window.APP_CONFIG.SECRET) || "",
    salon: (window.APP_CONFIG && window.APP_CONFIG.SALON_NAME) || "AerynSalon",
    employee_id: base.id,
    employee_name: base.name,
    type: base.type || currentMode,
    timestamp_client: ts.toISOString(),
    timezone_offset_min: (new Date()).getTimezoneOffset(),
    location: (lat && lng) ? { lat, lng } : null,
    user_agent: navigator.userAgent,
    clock_source: lastSyncSource
  };
}
async function onScanSuccess(decodedText) {
  const parsed = parseQrText(decodedText);
  if (!parsed) {
    document.getElementById("scanStatus").textContent = "QR tidak dikenali. Gunakan format 'ID|NAMA' atau JSON {id,name}.";
    toast("QR tidak dikenali", "error");
    return;
  }
  lastScanData = await buildPayload({ id: parsed.id, name: parsed.name, type: currentMode });
  document.getElementById("empId").textContent = lastScanData.employee_id;
  document.getElementById("empName").textContent = lastScanData.employee_name;
  document.getElementById("empType").textContent = lastScanData.type;
  document.getElementById("empTime").textContent = new Date(nowOnline()).toLocaleString();
  document.getElementById("btnKirim").disabled = false;
  document.getElementById("scanStatus").textContent = "QR terbaca. Silakan kirim.";
}
function onScanFailure(error) {}

async function listCameras() {
  try {
    cameras = await Html5Qrcode.getCameras();
    const sel = document.getElementById("cameraSelect");
    sel.innerHTML = "";
    if (!cameras || !cameras.length) {
      sel.innerHTML = "<option>Tidak ada kamera</option>";
      return;
    }
    cameras.forEach((c, idx) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label || `Kamera ${idx+1}`;
      sel.appendChild(opt);
    });
    const back = cameras.find(c => /back|rear|environment/i.test(c.label || ""));
    currentCameraId = (back ? back.id : cameras[0].id);
    sel.value = currentCameraId;
    sel.addEventListener("change", (e) => switchCamera(e.target.value));
    document.getElementById("btnBackCam").addEventListener("click", async () => {
      if (!cameras.length) await listCameras();
      const back2 = cameras.find(c => /back|rear|environment/i.test(c.label || ""));
      await switchCamera(back2 ? back2.id : cameras[0].id);
    });
  } catch (e) {}
}
async function switchCamera(cameraId) {
  try {
    if (!html5Qr) return;
    if (html5Qr._isScanning) {
      await html5Qr.stop();
    }
    await html5Qr.start(cameraId, { fps: 10, qrbox: 250, aspectRatio: 1.777, rememberLastUsedCamera: true }, onScanSuccess, onScanFailure);
    currentCameraId = cameraId;
    document.getElementById("scanStatus").textContent = "Scanner aktif (kamera diganti).";
  } catch (e) {
    document.getElementById("scanStatus").textContent = "Gagal mengganti kamera: " + e.message;
    toast("Gagal mengganti kamera", "error");
  }
}
async function startScanner() {
  const waitLib = () => new Promise(res => {
    const check = () => { if (window.Html5Qrcode) res(); else setTimeout(check, 100); }; check();
  });
  await waitLib();
  html5Qr = new Html5Qrcode(readerElId);
  document.getElementById("scanStatus").textContent = "Meminta akses kamera...";
  try {
    await html5Qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250, aspectRatio: 1.777, rememberLastUsedCamera: true },
      onScanSuccess, onScanFailure
    );
    document.getElementById("scanStatus").textContent = "Scanner aktif (kamera belakang).";
  } catch (e) {
    await listCameras();
    if (!cameras || !cameras.length) throw new Error("Kamera tidak ditemukan.");
    await html5Qr.start(currentCameraId, { fps: 10, qrbox: 250, aspectRatio: 1.777, rememberLastUsedCamera: true }, onScanSuccess, onScanFailure);
    document.getElementById("scanStatus").textContent = "Scanner aktif.";
  }
  listCameras();
}
async function restartScanner(){
  try{ if (html5Qr && html5Qr._isScanning) await html5Qr.stop(); }catch(e){}
  await startScanner();
}

async function submitToSheet() {
  if (!lastScanData) return;
  sendPayload(lastScanData);
}
async function sendPayload(payload) {
  const url = (window.APP_CONFIG && window.APP_CONFIG.SHEET_WEB_APP_URL) || "";
  if (!url) {
    document.getElementById("serverResponse").innerHTML = `<span class="text-red-600">Belum mengatur SHEET_WEB_APP_URL di config.js</span>`;
    toast("Atur SHEET_WEB_APP_URL di config.js", "error");
    return;
  }
  document.getElementById("serverResponse").innerHTML = "Mengirim...";
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      mode: "cors",
    });
    const txt = await resp.text();
    let data;
    try { data = JSON.parse(txt); } catch (e) { data = { raw: txt }; }
    if (resp.ok && (data.ok || data.status === "ok")) {
      document.getElementById("serverResponse").innerHTML = `<span class="text-green-700">Tersimpan ✔</span>`;
      toast("Tersimpan ke Google Sheets", "success");
      resetScan();
    
      try {
        const list = JSON.parse(localStorage.getItem("lastSubmissions")||"[]");
        list.unshift({ at: new Date().toISOString(), payload });
        localStorage.setItem("lastSubmissions", JSON.stringify(list.slice(0,200)));
      } catch(e) {}
} else {
      document.getElementById("serverResponse").innerHTML = `<span class="text-red-600">Gagal simpan (${resp.status}). Detail: ${txt}</span>`;
      toast("Gagal simpan", "error");
    }
  } catch (err) {
    document.getElementById("serverResponse").innerHTML = `<span class="text-red-600">Error koneksi: ${err.message}</span>`;
    toast("Error koneksi", "error");
  }
}


// === Admin role helpers ===
async function sha256Hex(text){
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function loginAdmin(){
  const input = document.getElementById("adminPass");
  const pass = (input && input.value) || "";
  const stored = localStorage.getItem("adminPassHash");
  const defaultHash = await sha256Hex("aeryn123");
  const ok = (stored ? stored : defaultHash) === await sha256Hex(pass);
  if (ok){
    localStorage.setItem("isAdmin","true");
    window.location.href = "admin.html";
  } else {
    toast("Password salah", "error");
  }
}
function logout(){
  localStorage.removeItem("isAdmin");
  toast("Logout berhasil", "success");
  window.location.href = "index.html";
}
function showAdminModal(show){
  const m = document.getElementById("adminModal");
  if (!m) return;
  if (show){ m.classList.remove("hidden"); m.classList.add("flex"); }
  else { m.classList.add("hidden"); m.classList.remove("flex"); }
}



// Dynamic brand color from config
(function(){
  try{
    const hex = (window.APP_CONFIG && (window.APP_CONFIG.BRAND_HEX || window.APP_CONFIG.BRAND_COLOR)) || null;
    if (hex){
      const root = document.documentElement.style;
      root.setProperty("--brand", hex);
      // compute a darker hover color (simple 10% darker)
      function darken(h){
        let c = h.replace("#","");
        if (c.length===3){ c = c.split("").map(x=>x+x).join(""); }
        let r=parseInt(c.slice(0,2),16), g=parseInt(c.slice(2,4),16), b=parseInt(c.slice(4,6),16);
        r = Math.max(0, Math.floor(r*0.85));
        g = Math.max(0, Math.floor(g*0.85));
        b = Math.max(0, Math.floor(b*0.85));
        const toHex = (n)=>n.toString(16).padStart(2,"0");
        return "#" + toHex(r)+toHex(g)+toHex(b);
      }
      const hover = darken(hex);
      root.setProperty("--brand-hover", hover);
      // derive soft and text if needed leave as default theme purple
    }
  }catch(e){}
})();


window.addEventListener("DOMContentLoaded", async () => {
  initTicker();
  setMode("IN");
  initButtons();
  await syncServerTime();
  renderClock();
  setInterval(renderClock, 1000);
  startScanner();
});
