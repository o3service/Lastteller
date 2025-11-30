// ---------- KONSTANTER OG LAGRINGSNØKLER ----------

// Standard-radius hvis ingen er satt
const DEFAULT_RADIUS_METERS = 100;

// localStorage-nøkler
const STORAGE_KEY = "lastteller_state_v1";
const GEOFENCE_CENTER_STORAGE_KEY = "lastteller_geofence_center";
const RADIUS_STORAGE_KEY = "lastteller_radius";

// ---------- GEOFENCE-STATE ----------

let geofenceCenter = null; // { lat, lng } – settes første gang du trykker Start GPS
let geofenceRadius = DEFAULT_RADIUS_METERS;
let isInsideGeofence = false;

// ---------- LASTTELLER-STATE ----------

let state = {
  vehicles: {},
  loads: [] // { vehicleId, timestamp }
};

// ---------- LAGRING ----------

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
    }
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
    if (raw) {
      geofenceCenter = JSON.parse(raw);
      console.log("Geofence-senter lastet:", geofenceCenter);
    }
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
      console.log("Geofence-senter lagret:", geofenceCenter);
    }
  } catch (e) {
    console.error("Kunne ikke lagre geofence-senter:", e);
  }
}

function loadRadiusFromStorage() {
  try {
    const raw = localStorage.getItem(RADIUS_STORAGE_KEY);
    if (raw) {
      const val = parseFloat(raw);
      if (!Number.isNaN(val) && val > 0) {
        geofenceRadius = val;
      }
    }
  } catch (e) {
    console.error("Kunne ikke laste radius:", e);
  }
}

function saveRadius() {
  try {
    localStorage.setItem(RADIUS_STORAGE_KEY, String(geofenceRadius));
  } catch (e) {
    console.error("Kunne ikke lagre radius:", e);
  }
}

// ---------- UI-HJELP ----------

function setGeofenceStatus(text) {
  const el = document.getElementById("geofence-status");
  if (el) el.textContent = text;
}

function updateRadiusDisplay() {
  const el = document.getElementById("radius-display");
  if (el) el.textContent = geofenceRadius;
}

function setDistanceText(distMeters) {
  const el = document.getElementById("distance-text");
  if (!el) return;
  if (distMeters == null) {
    el.textContent = "";
  } else {
    el.textContent = `Avstand til senter: ${distMeters.toFixed(1)} m`;
  }
}

// ---------- AVSTAND ----------

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------- INN/UT-LOGIKK & LASTTELLING ----------

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
  const load = {
    vehicleId,
    timestamp: new Date().toISOString()
  };
  state.loads.push(load);
  if (state.loads.length > 5000) {
    state.loads.shift();
  }
}

// ---------- GEOFENCE-SJEKK ----------

function checkGeofence(lat, lng) {
  if (!geofenceCenter) {
    setGeofenceStatus("Senter ikke satt – gå til ønsket punkt og trykk Start GPS.");
    setDistanceText(null);
    return;
  }

  const dist = distanceMeters(
    lat,
    lng,
    geofenceCenter.lat,
    geofenceCenter.lng
  );

  setDistanceText(dist);

  const nowInside = dist <= geofenceRadius;
  const vehicleId = "MOBIL_1";

  if (nowInside && !isInsideGeofence) {
    console.log("UTE -> INNE, registrerer lass for", vehicleId);
    onEnterZone(vehicleId);
    setGeofenceStatus("INNE i sonen");
  }

  if (!nowInside && isInsideGeofence) {
    console.log("INNE -> UTE for", vehicleId);
    onExitZone(vehicleId);
    setGeofenceStatus("UTE av sonen");
  }

  if (!isInsideGeofence && !nowInside) {
    setGeofenceStatus("UTE av sonen");
  }
  if (isInsideGeofence && nowInside) {
    setGeofenceStatus("INNE i sonen");
  }

  isInsideGeofence = nowInside;
}

// ---------- UI-RENDERING ----------

function render() {
  const totalElement = document.getElementById("total-loads");
  const vehicleList = document.getElementById("vehicle-list");
  const loadsTableBody = document.getElementById("loads-table-body");

  if (!totalElement || !vehicleList || !loadsTableBody) {
    console.warn("Mangler noen UI-elementer, sjekk index.html");
    return;
  }

  totalElement.textContent = state.loads.length.toString();
  vehicleList.innerHTML = "";

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

    const enterBtn = document.createElement("button");
    enterBtn.textContent = "Simuler INN";
    enterBtn.addEventListener("click", () => onEnterZone(v.id));

    const exitBtn = document.createElement("button");
    exitBtn.textContent = "Simuler UTE";
    exitBtn.addEventListener("click", () => onExitZone(v.id));

    btnWrapper.appendChild(enterBtn);
    btnWrapper.appendChild(exitBtn);

    li.appendChild(label);
    li.appendChild(btnWrapper);

    vehicleList.appendChild(li);
  });

  loadsTableBody.innerHTML = "";
  const lastLoads = [...state.loads].slice(-20).reverse();
  lastLoads.forEach((load) => {
    const tr = document.createElement("tr");

    const tdTime = document.createElement("td");
    const date = new Date(load.timestamp);
    tdTime.textContent = date.toLocaleString();

    const tdVeh = document.createElement("td");
    tdVeh.textContent = load.vehicleId;

    tr.appendChild(tdTime);
    tr.appendChild(tdVeh);
    loadsTableBody.appendChild(tr);
  });
}

// ---------- SKJEMAER ----------

function setupForm() {
  const form = document.getElementById("add-vehicle-form");
  const input = document.getElementById("vehicle-id");

  if (!form || !input) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = input.value.trim();
    if (!id) return;

    ensureVehicle(id);
    saveState();
    render();
    input.value = "";
  });
}

function setupRadiusForm() {
  const input = document.getElementById("radius-input");
  const btn = document.getElementById("radius-button");

  if (!input || !btn) return;

  input.value = geofenceRadius;

  btn.addEventListener("click", () => {
    const val = parseFloat(input.value);

    if (!val || val < 5) {
      alert("Radius må være et tall over 5 meter.");
      return;
    }

    geofenceRadius = val;
    saveRadius();
    updateRadiusDisplay();

    alert("Radius oppdatert!");
  });
}

// ---------- GPS ----------

function setupGps() {
  const btn = document.getElementById("gps-button");
  const text = document.getElementById("gps-text");

  if (!btn || !text) {
    console.warn("Fant ikke gps-button eller gps-text i HTML");
    return;
  }

  btn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      text.textContent = "Nettleseren støtter ikke GPS.";
      return;
    }

    text.textContent = "Henter posisjon ...";

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        text.textContent =
          "Posisjon funnet: breddegrad " +
          lat.toFixed(5) +
          ", lengdegrad " +
          lng.toFixed(5);

        // Første gang: sett geofence-senter automatisk
        if (!geofenceCenter) {
          geofenceCenter = { lat, lng };
          saveGeofenceCenterToStorage();
          setGeofenceStatus(
            "Senter satt her. INNE/UTE følger denne sonen."
          );
        }

        checkGeofence(lat, lng);
      },
      (err) => {
        text.textContent = "Feil ved henting av posisjon: " + err.message;
      }
    );
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
  updateRadiusDisplay();

  if (!geofenceCenter) {
    setGeofenceStatus(
      "Senter ikke satt – gå til ønsket punkt og trykk Start GPS."
    );
  } else {
    setGeofenceStatus("Senter er lastet – INNE/UTE følger lagret sone.");
  }
});
