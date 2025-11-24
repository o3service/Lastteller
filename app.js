// Enkel state lagret i localStorage så data ikke forsvinner ved reload
const STORAGE_KEY = "lastteller_state_v1";

let state = {
  vehicles: {
    // vehicleId: { id, isInside, wasOutsideSinceLastCount }
  },
  loads: [] // { vehicleId, timestamp }
};

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

// --- INN/UT-logikk ---
// REGEL:
//  - Når bil går UTE -> INNE og wasOutsideSinceLastCount = true => 1 lass
//  - Når bil går INNE -> UTE => markér wasOutsideSinceLastCount = true

function ensureVehicle(vehicleId) {
  if (!state.vehicles[vehicleId]) {
    state.vehicles[vehicleId] = {
      id: vehicleId,
      isInside: false,
      wasOutsideSinceLastCount: true // antar den starter som "ute"
    };
  }
  return state.vehicles[vehicleId];
}

// Kalles når geofence sier "vehicle entered"
function onEnterZone(vehicleId) {
  const v = ensureVehicle(vehicleId);

  // Bare hvis den faktisk var utenfor før
  if (!v.isInside && v.wasOutsideSinceLastCount) {
    // Registrer ett lass
    registerLoad(vehicleId);
    v.wasOutsideSinceLastCount = false;
  }

  v.isInside = true;
  saveState();
  render();
}

// Kalles når geofence sier "vehicle exited"
function onExitZone(vehicleId) {
  const v = ensureVehicle(vehicleId);
  v.isInside = false;
  // Nå vet vi at den har vært utenfor, klar for neste INN
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
  // begrens historikk hvis du vil
  if (state.loads.length > 5000) {
    state.loads.shift();
  }
}

// --- UI-kode ---

function render() {
  const totalElement = document.getElementById("total-loads");
  const vehicleList = document.getElementById("vehicle-list");
  const loadsTableBody = document.getElementById("loads-table-body");

  // Totalt antall lass
  totalElement.textContent = state.loads.length.toString();

  // Kjøretøy-liste
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

    // Simuler geofence: Enter/Exit
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

  // Lass-liste (siste 20)
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

function setupForm() {
  const form = document.getElementById("add-vehicle-form");
  const input = document.getElementById("vehicle-id");

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

// Init
loadState();
window.addEventListener("DOMContentLoaded", () => {
  setupForm();
  render();
});
