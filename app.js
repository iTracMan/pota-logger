
"use strict";

const BANDS = ["160M","80M","60M","40M","30M","20M","17M","15M","12M","10M","6M","4M","2M","1.25M","70CM","33CM","23CM"];
const MODES = ["SSB","CW","FM","AM","FT8","FT4","RTTY","PSK31","MFSK","JS8"];
const ADIF_MODE = {
  SSB:{mode:"SSB"}, CW:{mode:"CW"}, FM:{mode:"FM"}, AM:{mode:"AM"}, RTTY:{mode:"RTTY"}, MFSK:{mode:"MFSK"},
  FT8:{mode:"MFSK",submode:"FT8"}, FT4:{mode:"MFSK",submode:"FT4"},
  PSK31:{mode:"PSK",submode:"PSK31"}, JS8:{mode:"MFSK",submode:"JS8"}
};
const KEY = "potaFieldLogger.v1";
const MINIMUM = 10;

let state = loadState();
let capturedLocation = null;
let currentActivationId = state.activeId || null;

const $ = id => document.getElementById(id);

function loadState(){
  try{
    const parsed = JSON.parse(localStorage.getItem(KEY));
    if(parsed && Array.isArray(parsed.activations)) return parsed;
  }catch(e){}
  return {version:1, settings:{stationCall:"", lastBand:"20M", lastMode:"SSB", target:15, parkRef:"GB-3479", parkName:""}, activations:[], activeId:null};
}
function saveState(){
  localStorage.setItem(KEY, JSON.stringify(state));
}
function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}
function upper(v){ return (v || "").trim().toUpperCase(); }
function pad(n){ return String(n).padStart(2,"0"); }
function utcParts(date=new Date()){
  return {
    display:`${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`,
    date:`${date.getUTCFullYear()}${pad(date.getUTCMonth()+1)}${pad(date.getUTCDate())}`,
    time:`${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`,
    iso:date.toISOString()
  };
}
function prettyDate(yyyymmdd){
  if(!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd || "";
  return `${yyyymmdd.slice(6,8)}/${yyyymmdd.slice(4,6)}/${yyyymmdd.slice(0,4)}`;
}
function csvDate(yyyymmdd){
  if(!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd || "";
  return `${yyyymmdd.slice(6,8)}-${yyyymmdd.slice(4,6)}-${yyyymmdd.slice(0,4)}`;
}
function csvTime(hhmmss){
  if(!hhmmss) return "";
  const t = String(hhmmss).padEnd(6,"0");
  return `${t.slice(0,2)}:${t.slice(2,4)}:${t.slice(4,6)}`;
}
function maidenhead(lat, lon, precision=6){
  if(!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  let adjLon = lon + 180, adjLat = lat + 90;
  let A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let grid = A[Math.floor(adjLon/20)] + A[Math.floor(adjLat/10)];
  adjLon %= 20; adjLat %= 10;
  grid += Math.floor(adjLon/2).toString() + Math.floor(adjLat).toString();
  if(precision >= 6){
    adjLon %= 2; adjLat %= 1;
    grid += A[Math.floor(adjLon*12)].toLowerCase() + A[Math.floor(adjLat*24)].toLowerCase();
  }
  return grid;
}
function populateSelect(id, items, value){
  const el = $(id);
  el.innerHTML = items.map(x=>`<option value="${x}">${x}</option>`).join("");
  if(value && items.includes(value)) el.value = value;
}
function activationById(id){ return state.activations.find(a=>a.id===id); }
function currentActivation(){ return activationById(currentActivationId); }

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function setDefaults(){
  const s = state.settings || {};
  $("stationCall").value = s.stationCall || "";
  $("parkRef").value = s.parkRef || "GB-3479";
  $("parkName").value = s.parkName || "";
  $("targetQsos").value = s.target || 15;
  populateSelect("startBand", BANDS, s.lastBand || "20M");
  populateSelect("startMode", MODES, s.lastMode || "SSB");
  populateSelect("qsoBand", BANDS, s.lastBand || "20M");
  populateSelect("qsoMode", MODES, s.lastMode || "SSB");
  populateSelect("editBand", BANDS, s.lastBand || "20M");
  populateSelect("editMode", MODES, s.lastMode || "SSB");
}

function tickClock(){
  const u = utcParts();
  $("utcClock").textContent = `UTC ${u.display}`;
}
setInterval(tickClock,1000);
tickClock();

function renderHome(){
  $("homeView").hidden = false;
  $("activationView").hidden = true;
  $("homeBtn").hidden = true;
  currentActivationId = state.activeId || null;

  const active = state.activeId ? activationById(state.activeId) : null;
  if(active){
    $("activeCard").innerHTML = `
      <article class="card">
        <h2>Active activation</h2>
        <div class="history-item">
          <div class="history-main">
            <strong>${escapeHtml(active.parkRef)}${active.parkName ? " — "+escapeHtml(active.parkName) : ""}</strong>
            <span>${escapeHtml(active.stationCall)} · ${active.qsos.length} QSOs · started ${prettyDate(active.startDate)} UTC</span>
          </div>
          <button class="primary small" data-open="${active.id}">Resume</button>
        </div>
      </article>`;
  }else{
    $("activeCard").innerHTML = "";
  }

  const history = [...state.activations].sort((a,b)=> (b.startedAt||"").localeCompare(a.startedAt||""));
  $("historyList").innerHTML = history.length ? history.map(a=>`
    <div class="history-item">
      <div class="history-main">
        <strong>${escapeHtml(a.parkRef)}${a.parkName ? " — "+escapeHtml(a.parkName) : ""}</strong>
        <span>${prettyDate(a.startDate)} UTC · ${a.qsos.length} QSO${a.qsos.length===1?"":"s"}${a.endedAt ? " · ended" : " · active"}</span>
      </div>
      <button class="secondary small" data-open="${a.id}">Open</button>
    </div>`).join("") : `<div class="empty">No saved activations yet.</div>`;

  document.querySelectorAll("[data-open]").forEach(btn=>{
    btn.addEventListener("click",()=>openActivation(btn.dataset.open));
  });
}

function locationDescription(loc){
  if(!loc) return "Not captured";
  const grid = maidenhead(loc.lat, loc.lon);
  return `${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)}${grid ? ` · ${grid}` : ""}${loc.accuracy ? ` · ±${Math.round(loc.accuracy)} m` : ""}`;
}

function requestGps(){
  if(!navigator.geolocation){
    $("locationText").textContent = "GPS is not available in this browser.";
    return;
  }
  $("locationText").textContent = "Getting GPS position…";
  navigator.geolocation.getCurrentPosition(pos=>{
    capturedLocation = {
      lat:pos.coords.latitude,
      lon:pos.coords.longitude,
      accuracy:pos.coords.accuracy,
      capturedAt:new Date().toISOString()
    };
    $("locationText").textContent = locationDescription(capturedLocation);
  }, err=>{
    $("locationText").textContent = `GPS unavailable: ${err.message}`;
  }, {enableHighAccuracy:true, timeout:12000, maximumAge:30000});
}

function validCallsign(call){
  return /^[A-Z0-9/]{3,}$/.test(call) && /[A-Z]/.test(call) && /\d/.test(call);
}
function validParkRef(ref){
  return /^[A-Z0-9]+-\d+$/.test(ref);
}

function createActivation(){
  const stationCall = upper($("stationCall").value);
  const parkRef = upper($("parkRef").value);
  const parkName = $("parkName").value.trim();
  const target = Math.max(MINIMUM, parseInt($("targetQsos").value || "15",10));
  const band = $("startBand").value;
  const mode = $("startMode").value;
  const now = utcParts();
  const a = {
    id:uid(), stationCall, parkRef, parkName, target, defaultBand:band, defaultMode:mode,
    location:capturedLocation, startedAt:now.iso, startDate:now.date, endedAt:null, qsos:[]
  };
  state.activations.push(a);
  state.activeId = a.id;
  state.settings = {stationCall, parkRef, parkName, target, lastBand:band, lastMode:mode};
  saveState();
  openActivation(a.id);
}

function startActivation(){
  const stationCall = upper($("stationCall").value);
  const parkRef = upper($("parkRef").value);
  if(!validCallsign(stationCall)){
    alert("Please enter your station callsign.");
    $("stationCall").focus();
    return;
  }
  if(!validParkRef(parkRef)){
    alert("Please enter a POTA park reference such as GB-3479.");
    $("parkRef").focus();
    return;
  }

  // If location was not already captured, try automatically when Start is tapped.
  if(!capturedLocation && navigator.geolocation){
    $("startBtn").disabled = true;
    $("startBtn").textContent = "Getting GPS…";
    navigator.geolocation.getCurrentPosition(pos=>{
      capturedLocation = {
        lat:pos.coords.latitude, lon:pos.coords.longitude, accuracy:pos.coords.accuracy,
        capturedAt:new Date().toISOString()
      };
      $("locationText").textContent = locationDescription(capturedLocation);
      $("startBtn").disabled = false;
      $("startBtn").textContent = "Start activation";
      createActivation();
    }, ()=>{
      $("startBtn").disabled = false;
      $("startBtn").textContent = "Start activation";
      createActivation(); // GPS is helpful, but a denied/unavailable fix must not prevent logging.
    }, {enableHighAccuracy:true, timeout:8000, maximumAge:30000});
    return;
  }
  createActivation();
}

function openActivation(id){
  const a = activationById(id);
  if(!a) return;
  currentActivationId = id;
  $("homeView").hidden = true;
  $("activationView").hidden = false;
  $("homeBtn").hidden = false;
  $("qsoBand").value = a.defaultBand || state.settings.lastBand || "20M";
  $("qsoMode").value = a.defaultMode || state.settings.lastMode || "SSB";
  $("hunterCall").value = "";
  $("hunterName").value = "";
  $("p2pPark").value = "";
  renderActivation();
  setTimeout(()=>$("hunterCall").focus(),100);
}

function dailyStats(a){
  const byDate = {};
  for(const q of a.qsos){
    if(!byDate[q.date]) byDate[q.date] = {logged:0, keys:new Set()};
    byDate[q.date].logged++;
    byDate[q.date].keys.add(`${q.call}|${q.band}|${q.mode}`);
  }
  return Object.entries(byDate).sort((x,y)=>x[0].localeCompare(y[0])).map(([date,v])=>({
    date, logged:v.logged, unique:v.keys.size
  }));
}
function uniqueCountForDate(a, date){
  const keys = new Set(a.qsos.filter(q=>q.date===date).map(q=>`${q.call}|${q.band}|${q.mode}`));
  return keys.size;
}
function renderActivation(){
  const a = currentActivation();
  if(!a) return renderHome();
  const loc = locationDescription(a.location);
  const stats = dailyStats(a);
  const focusDate = a.endedAt
    ? (stats.length ? stats[stats.length-1].date : a.startDate)
    : utcParts().date;
  const uniqueToday = uniqueCountForDate(a, focusDate);
  const loggedToday = a.qsos.filter(q=>q.date===focusDate).length;
  const daySummary = stats.length
    ? stats.map(s=>`${prettyDate(s.date)}: ${s.unique} unique / ${s.logged} logged${s.unique>=MINIMUM ? " ✓" : ""}`).join(" · ")
    : `No QSOs yet for ${prettyDate(focusDate)}`;

  $("activationSummary").innerHTML = `
    <h2>${escapeHtml(a.parkRef)}${a.parkName ? " — "+escapeHtml(a.parkName) : ""}</h2>
    <div class="meta">
      <span class="pill">${escapeHtml(a.stationCall)}</span>
      <span class="pill">Started ${prettyDate(a.startDate)} UTC</span>
      <span class="pill">${escapeHtml(loc)}</span>
      ${a.endedAt ? `<span class="pill">Ended</span>` : `<span class="pill">Active</span>`}
    </div>
    <div class="hint">${escapeHtml(daySummary)}</div>`;

  $("qsoCountLabel").textContent = `Unique QSOs · ${prettyDate(focusDate)} UTC`;
  $("qsoCount").textContent = uniqueToday;
  const badge = $("minimumBadge");
  if(uniqueToday >= MINIMUM){
    badge.textContent = `✓ POTA minimum reached (${MINIMUM} unique)`;
    badge.classList.add("good");
  }else{
    badge.textContent = `${MINIMUM-uniqueToday} unique QSO${MINIMUM-uniqueToday===1?"":"s"} to minimum`;
    badge.classList.remove("good");
  }
  const target = Math.max(MINIMUM, a.target || 15);
  $("progressBar").style.width = `${Math.min(100,(uniqueToday/target)*100)}%`;
  $("targetText").textContent = uniqueToday >= target
    ? `Personal target of ${target} unique QSOs reached for this UTC day · ${a.qsos.length} logged total.`
    : `Personal target: ${target} unique · ${target-uniqueToday} to go · ${loggedToday} logged this UTC day · ${a.qsos.length} logged total.`;
  renderContacts();
}
function duplicateMatch(a, call, band, mode){
  const today = utcParts().date;
  return a.qsos.find(q=>q.date===today && q.call===call && q.band===band && q.mode===mode);
}
function refreshDuplicateWarning(){
  const a = currentActivation();
  if(!a) return;
  const call = upper($("hunterCall").value);
  const match = duplicateMatch(a, call, $("qsoBand").value, $("qsoMode").value);
  const box = $("duplicateWarning");
  if(match && call){
    box.hidden = false;
    box.textContent = `Possible duplicate: ${call} was already logged on ${match.band} ${match.mode} at ${match.time.slice(0,2)}:${match.time.slice(2,4)} UTC. You can still log it if intentional.`;
  }else{
    box.hidden = true;
    box.textContent = "";
  }
}

function logQso(){
  const a = currentActivation();
  if(!a) return;
  if(a.endedAt && !confirm("This activation is marked as ended. Log another QSO anyway?")) return;
  const call = upper($("hunterCall").value);
  const name = $("hunterName").value.trim();
  const p2pPark = upper($("p2pPark").value);
  const band = $("qsoBand").value;
  const mode = $("qsoMode").value;
  if(!validCallsign(call)){
    alert("Please check the worked station callsign.");
    $("hunterCall").focus();
    return;
  }
  if(p2pPark && !validParkRef(p2pPark)){
    alert("Please check the P2P park reference, or leave it blank.");
    $("p2pPark").focus();
    return;
  }
  const now = utcParts();
  a.qsos.push({id:uid(), call, name, p2pPark, band, mode, date:now.date, time:now.time, loggedAt:now.iso});
  a.defaultBand = band;
  a.defaultMode = mode;
  state.settings.lastBand = band;
  state.settings.lastMode = mode;
  saveState();

  $("hunterCall").value = "";
  $("hunterName").value = "";
  $("p2pPark").value = "";
  $("duplicateWarning").hidden = true;
  renderActivation();
  $("hunterCall").focus();
}

function renderContacts(){
  const a = currentActivation();
  const box = $("contactsList");
  if(!a || !a.qsos.length){
    box.innerHTML = `<div class="empty">No contacts logged yet.</div>`;
    return;
  }
  box.innerHTML = [...a.qsos].reverse().map((q,idx)=>`
    <div class="contact-row">
      <div>
        <div class="contact-call">${escapeHtml(q.call)}</div>
        <div class="contact-meta">${prettyDate(q.date)} · ${q.time.slice(0,2)}:${q.time.slice(2,4)}:${q.time.slice(4,6)} UTC · ${escapeHtml(q.band)} ${escapeHtml(q.mode)}${q.name ? ` · ${escapeHtml(q.name)}` : ""}${q.p2pPark ? ` · P2P ${escapeHtml(q.p2pPark)}` : ""}</div>
      </div>
      <div class="contact-actions">
        <button class="secondary small" data-edit="${q.id}">Edit</button>
        <button class="danger small" data-delq="${q.id}">Delete</button>
      </div>
    </div>`).join("");
  document.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>openEdit(b.dataset.edit)));
  document.querySelectorAll("[data-delq]").forEach(b=>b.addEventListener("click",()=>deleteQso(b.dataset.delq)));
}

function openEdit(id){
  const a = currentActivation(), q = a && a.qsos.find(x=>x.id===id);
  if(!q) return;
  $("editId").value = q.id;
  $("editCall").value = q.call;
  $("editName").value = q.name || "";
  $("editBand").value = q.band;
  $("editMode").value = q.mode;
  $("editP2p").value = q.p2pPark || "";
  $("editDate").value = q.date;
  $("editTime").value = q.time;
  $("editDialog").showModal();
}
function saveEdit(evt){
  evt.preventDefault();
  const a = currentActivation(), q = a && a.qsos.find(x=>x.id===$("editId").value);
  if(!q) return;
  const call = upper($("editCall").value);
  const p2p = upper($("editP2p").value);
  const date = $("editDate").value.trim();
  let time = $("editTime").value.trim();
  if(time.length===4) time += "00";
  if(!validCallsign(call)) return alert("Please check the callsign.");
  if(p2p && !validParkRef(p2p)) return alert("Please check the P2P park reference.");
  if(!/^\d{8}$/.test(date)) return alert("UTC date must be YYYYMMDD.");
  if(!/^\d{6}$/.test(time)) return alert("UTC time must be HHMMSS.");
  Object.assign(q,{call,name:$("editName").value.trim(),band:$("editBand").value,mode:$("editMode").value,p2pPark:p2p,date,time});
  saveState();
  $("editDialog").close();
  renderActivation();
}
function deleteQso(id){
  const a = currentActivation();
  const q = a && a.qsos.find(x=>x.id===id);
  if(!q) return;
  if(!confirm(`Delete QSO with ${q.call}?`)) return;
  a.qsos = a.qsos.filter(x=>x.id!==id);
  saveState(); renderActivation();
}

function adifTag(name, value){
  const v = String(value ?? "");
  return `<${name}:${v.length}>${v}`;
}
function buildAdif(a){
  const lines = [];
  lines.push("POTA Field Logger");
  lines.push(`${adifTag("PROGRAMID","POTA Field Logger")} ${adifTag("PROGRAMVERSION","1.2")} ${adifTag("CREATED_TIMESTAMP", utcParts().date+" "+utcParts().time)} <EOH>`);
  for(const q of a.qsos){
    const modeInfo = ADIF_MODE[q.mode] || {mode:q.mode};
    const fields = [
      adifTag("STATION_CALLSIGN",a.stationCall),
      adifTag("CALL",q.call),
      adifTag("QSO_DATE",q.date),
      adifTag("TIME_ON",q.time),
      adifTag("BAND",q.band),
      adifTag("MODE",modeInfo.mode)
    ];
    if(modeInfo.submode) fields.push(adifTag("SUBMODE",modeInfo.submode));
    fields.push(adifTag("MY_SIG","POTA"));
    fields.push(adifTag("MY_SIG_INFO",a.parkRef));
    if(q.name) fields.push(adifTag("NAME",q.name));
    if(a.location){
      fields.push(adifTag("MY_GRIDSQUARE", maidenhead(a.location.lat,a.location.lon).toUpperCase()));
    }
    if(q.p2pPark){
      fields.push(adifTag("SIG","POTA"));
      fields.push(adifTag("SIG_INFO",q.p2pPark));
    }
    lines.push(fields.join(" ")+" <EOR>");
  }
  return lines.join("\r\n")+"\r\n";
}
function csvEscape(v){
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}
function buildCsv(a){
  const rows = [["Station","Park","QSO Date UTC","Time UTC","Call","Name","Band","Mode","P2P Park","Latitude","Longitude","Grid"]];
  for(const q of a.qsos){
    rows.push([a.stationCall,a.parkRef,csvDate(q.date),csvTime(q.time),q.call,q.name,q.band,q.mode,q.p2pPark,
      a.location?.lat ?? "",a.location?.lon ?? "",a.location ? maidenhead(a.location.lat,a.location.lon).toUpperCase() : ""]);
  }
  return rows.map(r=>r.map(csvEscape).join(",")).join("\r\n")+"\r\n";
}
function downloadText(filename, text, mime){
  const blob = new Blob([text],{type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function safeName(s){ return String(s).replace(/[^A-Z0-9-]+/gi,"_"); }
function exportAdif(){
  const a = currentActivation(); if(!a) return;
  const filename = `${safeName(a.stationCall)}@${safeName(a.parkRef)}-${a.startDate}.adi`;
  downloadText(filename, buildAdif(a), "application/octet-stream");
}
function exportCsv(){
  const a = currentActivation(); if(!a) return;
  const filename = `${safeName(a.stationCall)}_${safeName(a.parkRef)}_${a.startDate}.csv`;
  downloadText(filename, buildCsv(a), "text/csv;charset=utf-8");
}
function endActivation(){
  const a = currentActivation(); if(!a) return;
  if(!a.endedAt){
    a.endedAt = new Date().toISOString();
    if(state.activeId===a.id) state.activeId=null;
    saveState();
  }
  renderActivation();
}
function deleteActivation(){
  const a = currentActivation(); if(!a) return;
  if(!confirm(`Delete this activation and all ${a.qsos.length} logged QSOs? This cannot be undone.`)) return;
  state.activations = state.activations.filter(x=>x.id!==a.id);
  if(state.activeId===a.id) state.activeId=null;
  saveState();
  renderHome();
}

$("gpsBtn").addEventListener("click",requestGps);
$("startBtn").addEventListener("click",startActivation);
$("homeBtn").addEventListener("click",renderHome);
$("logBtn").addEventListener("click",logQso);
$("hunterCall").addEventListener("input",e=>{ e.target.value = e.target.value.toUpperCase(); refreshDuplicateWarning(); });
$("qsoBand").addEventListener("change",refreshDuplicateWarning);
$("qsoMode").addEventListener("change",refreshDuplicateWarning);
$("p2pPark").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase());
$("stationCall").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase());
$("parkRef").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase());
$("editCall").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase());
$("editP2p").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase());
$("saveEditBtn").addEventListener("click",saveEdit);
$("exportAdiBtn").addEventListener("click",exportAdif);
$("exportCsvBtn").addEventListener("click",exportCsv);
$("endBtn").addEventListener("click",endActivation);
$("deleteBtn").addEventListener("click",deleteActivation);

document.addEventListener("keydown",e=>{
  if(e.key==="Enter" && !e.metaKey && !e.ctrlKey && !e.altKey && $("activationView").hidden===false && document.activeElement===$("hunterCall")){
    e.preventDefault(); logQso();
  }
});

setDefaults();
renderHome();

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
