// ---------- KONSTANTER OG LAGRINGSNØKLER ----------

const DEFAULT_RADIUS_METERS = 100;

const STORAGE_KEY = "lastteller_state_v1";
const GEOFENCE_CENTER_STORAGE_KEY = "lastteller_geofence_center";
const RADIUS_STORAGE_KEY = "lastteller_radius";

// ---------- GEOFENCE-STATE ----------

let geofenceCenter = null; 
let geofenceRadius = DEFAULT_RADIUS_METERS;
let isInsideGeofence = false;

let gpsWatchId = null;

// ---------- LASTTELLER-STATE ----------

let state = {
  vehicles: {},
  loads: [] 
};

// ---------- LAGRING ----------

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) {
    console.error("Kunne ikke laste state:", e);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Kunne ikke lagre state:", e);
  }
}

function loadGeofenceCenterFromStorage() {
  try {
    const raw = localStorage.getItem(GEOFENCE_CENTER_STORAGE_KEY);
    if (raw) geofenceCenter = JSON.parse(raw);
  } catch (e) {
    console.error("Kunne ikke laste geofence-senter:", e);
  }
}

function saveGeofenceCenterToStorage() {
  try {
    if (geofenceCenter) {
      localStorage.setItem(
        GEOFENCE_CENTER_STORAGE_KEY,
        JSON.stringify(geofenceCenter)
      );
    }
  } catch (e) {
    console.error("Kunne ikke lagre geofence-senter:", e);
  }
}

function resetGeofenceCenter() {
  geofenceCenter = null;
  isInsideGeofence = false;
  localStorage.removeItem(GEOFENCE_CENTER_STORAGE_KEY);
  setGeofenceStatus("Senter nullstilt – gå til ønsket punkt og bruk GPS-knappene.");
  setDistanceText(null);
  updateGeofenceCenterDisplay();
}

// ---------- RADIUS ----------

function loadRadiusFromStorage() {
  try {
    const raw = localStorage.getItem(RADIUS_STORAGE_KEY);
    if (raw) geofenceRadius = parseFloat(raw);
  } catch (e) {
    console.error("Kunne ikke laste radius:", e);
  }
}

function saveRadius() {
  localStorage.setItem(RADIUS_STORAGE_KEY, String(geofenceRadius));
}

// ---------- UI-HJELP ----------

function setGeofenceStatus(text) {
  const el = document.getElementById("geofence-status");
  if (el) el.textContent = text;
}

function setOnlineStatus() {
  const el = document.getElementById("online-status");
  if (!el) return;
  el.textContent = navigator.onLine ? "Online" : "Offline (appen fungerer fortsatt)";
}

function updateRadiusDisplay() {
  const el = document.getElementById("radius-display");
  if (el) el.textContent = geofenceRadius;
}

function setDistanceText(distMeters) {
  const el = document.getElementById("distance-text");
  if (!el) return;
  if (distMeters == null) el.textContent = "";
  else el.textContent = `Avstand til senter: ${distMeters.toFixed(1)} m`;
}

function updateGeofenceCenterDisplay() {
  const el = document.getElementById("geofence-center-display");
  if (!el) return;
  if (!geofenceCenter) el.textContent = "Ikke satt";
  else el.textContent = `${geofenceCenter.lat.toFixed(5)}, ${geofenceCenter.lng.toFixed(5)}`;
}

// ---------- AVSTAND ----------

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------- INN/UT-LOGIKK ----------

function ensureVehicle(vehicleId) {
  if (!state.vehicles[vehicleId]) {
    state.vehicles[vehicleId] = {
      id: vehicleId,
      isInside: false,
      wasOutsideSinceLastCount: true
    };
  }
  return state.vehicles[vehicleId];
}

function onEnterZone(vehicleId) {
  const v = ensureVehicle(vehicleId);

  if (!v.isInside && v.wasOutsideSinceLastCount) {
    registerLoad(vehicleId);
    v.wasOutsideSinceLastCount = false;
  }

  v.isInside = true;
  saveState();
  render();
}

function onExitZone(vehicleId) {
  const v = ensureVehicle(vehicleId);
  v.isInside = false;
  v.wasOutsideSinceLastCount = true;
  saveState();
  render();
}

function registerLoad(vehicleId) {
  state.loads.push({
    vehicleId,
    timestamp: new Date().toISOString()
  });

  if (state.loads.length > 5000) state.loads.shift();

  saveState();
}

// ---------- SLETT KJØRETØY + IKON ----------

function deleteVehicle(vehicleId) {
  delete state.vehicles[vehicleId];

  // Slett alle lass for dette kjøretøyet
  state.loads = state.loads.filter((load) => load.vehicleId !== vehicleId);

  saveState();
  render();
}

// ---------- GEOFENCE-SJEKK ----------

function checkGeofence(lat, lng) {
  if (!geofenceCenter) {
    setGeofenceStatus("Senter ikke satt – bruk GPS-knappene.");
    setDistanceText(null);
    return;
  }

  const dist = distanceMeters(lat, lng, geofenceCenter.lat, geofenceCenter.lng);

  setDistanceText(dist);

  const nowInside = dist <= geofenceRadius;
  const vehicleId = "MOBIL_1";

  if (nowInside && !isInsideGeofence) {
    onEnterZone(vehicleId);
    setGeofenceStatus("INNE i sonen");
  }

  if (!nowInside && isInsideGeofence) {
    onExitZone(vehicleId);
    setGeofenceStatus("UTE av sonen");
  }

  isInsideGeofence = nowInside;
}

// ---------- RENDER UI ----------

function render() {
  const totalElement = document.getElementById("total-loads");
  const vehicleList = document.getElementById("vehicle-list");
  const loadsTableBody = document.getElementById("loads-table-body");

  totalElement.textContent = state.loads.length;
  vehicleList.innerHTML = "";
  loadsTableBody.innerHTML = "";

  // --- KJØRETØYLISTE ---
  Object.values(state.vehicles).forEach((v) => {
    const li = document.createElement("li");
    li.className = "vehicle-item";

    const label = document.createElement("span");
    label.className = "vehicle-label";
    label.textContent = v.id;

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = v.isInside ? "INNE" : "UTE";
    label.appendChild(badge);

    const btnWrapper = document.createElement("div");
    btnWrapper.className = "vehicle-buttons";

    // INN
    const enterBtn = document.createElement("button");
    enterBtn.textContent = "INN";
    enterBtn.addEventListener("click", () => onEnterZone(v.id));

    // UTE
    const exitBtn = document.createElement("button");
    exitBtn.textContent = "UTE";
    exitBtn.addEventListener("click", () => onExitZone(v.id));

    // 🗑️ SLETT
    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.style.background = "#990000";
    deleteBtn.style.color = "white";
    deleteBtn.style.fontSize = "1.1rem";
    deleteBtn.style.borderRadius = "8px";
    deleteBtn.style.padding = "4px 8px";

    deleteBtn.addEventListener("click", () => {
      if (confirm(`Slette kjøretøy ${v.id}?`)) {
        deleteVehicle(v.id);
      }
    });

    btnWrapper.appendChild(enterBtn);
    btnWrapper.appendChild(exitBtn);
    btnWrapper.appendChild(deleteBtn);

    li.appendChild(label);
    li.appendChild(btnWrapper);

    vehicleList.appendChild(li);
  });

  // --- LASSLISTE (siste 20) ---
  [...state.loads]
    .slice(-20)
    .reverse()
    .forEach((load) => {
      const tr = document.createElement("tr");

      const tdTime = document.createElement("td");
      tdTime.textContent = new Date(load.timestamp).toLocaleString();

      const tdVeh = document.createElement("td");
      tdVeh.textContent = load.vehicleId;

      tr.appendChild(tdTime);
      tr.appendChild(tdVeh);
      loadsTableBody.appendChild(tr);
    });
}

// ---------- SKJEMA FOR KJØRETØY ----------

function setupForm() {
  const form = document.getElementById("add-vehicle-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("vehicle-id").value.trim();
    if (!id) return;
    ensureVehicle(id);
    saveState();
    render();
    form.reset();
  });
}

// ---------- RADIUSFORM ----------

function setupRadiusForm() {
  const input = document.getElementById("radius-input");
  const btn = document.getElementById("radius-button");

  input.value = geofenceRadius;

  btn.addEventListener("click", () => {
    const val = parseFloat(input.value);
    if (!val || val < 5) return alert("Radius må være et tall over 5 meter.");
    geofenceRadius = val;
    saveRadius();
    updateRadiusDisplay();
  });
}

// ---------- GPS ----------

function handlePositionUpdate(pos) {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  document.getElementById("gps-text").textContent =
    `Posisjon funnet: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  if (!geofenceCenter) {
    geofenceCenter = { lat, lng };
    saveGeofenceCenterToStorage();
    setGeofenceStatus("Senter satt her.");
    updateGeofenceCenterDisplay();
  }

  checkGeofence(lat, lng);
}

function setupGps() {
  // Én gang
  document.getElementById("gps-once-button").addEventListener("click", () => {
    navigator.geolocation.getCurrentPosition(
      handlePositionUpdate,
      (err) => alert("GPS-feil: " + err.message),
      { enableHighAccuracy: true }
    );
  });

  // Auto
  document.getElementById("gps-auto-start").addEventListener("click", () => {
    if (gpsWatchId !== null) return;
    gpsWatchId = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      (err) => alert("GPS-feil: " + err.message),
      { enableHighAccuracy: true }
    );
  });

  document.getElementById("gps-auto-stop").addEventListener("click", () => {
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
      document.getElementById("gps-text").textContent = "Automatisk GPS stoppet.";
    }
  });
}

// ---------- EKSPORT LASS ----------

function setupExportButton() {
  const btn = document.getElementById("export-button");

  btn.addEventListener("click", () => {
    if (!state.loads.length) return alert("Ingen lass registrert.");

    const lines = ["timestamp_iso;timestamp_local;vehicle_id"];

    state.loads.forEach((load) => {
      const dt = new Date(load.timestamp);
      lines.push(
        `${load.timestamp};${dt.toLocaleString()};${load.vehicleId}`
      );
    });

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "lastteller_export.csv";
    a.click();

    URL.revokeObjectURL(url);
  });
}

// ---------- INIT ----------

loadState();
loadRadiusFromStorage();
loadGeofenceCenterFromStorage();

window.addEventListener("DOMContentLoaded", () => {
  setupForm();
  render();
  setupGps();
  setupRadiusForm();
  setupExportButton();
  updateRadiusDisplay();
  updateGeofenceCenterDisplay();
  setOnlineStatus();

  window.addEventListener("online", setOnlineStatus);
  window.addEventListener("offline", setOnlineStatus);
});
