/**
 * EL QUILOMBO • CONTROL DE ACCESO & ESCÁNER QR
 * Rock & Riff (Valencia) - Viernes 09 de Octubre
 */

// ==========================================
// CONFIGURATION & CREDENTIALS
// ==========================================
const CONFIG = {
  ORGANIZER_PIN: "5401385",
  SUPABASE_URL: "https://nyfjehadnrpszidlebeg.supabase.co/rest/v1",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZmplaGFkbnJwc3ppZGxlYmVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2ODUyODMsImV4cCI6MjEwNTI2MTI4M30.oNeC_hXzo6cAA4GjEIeZ6L5YyfVB8kQMH_wRtYcjk28",
  AUTO_SYNC_INTERVAL_MS: 12000,
  TICKET_PRICE_USD: 15,
  BCV_RATE: 974.42
};

// ==========================================
// APPLICATION STATE
// ==========================================
const state = {
  isAuthenticated: false,
  enteredPin: "",
  reservations: [],
  recentCheckins: [],
  soundEnabled: true,
  currentModalTicket: null,
  activeFilter: "all",
  html5QrCode: null,
  isCameraScanning: false,
  availableCameras: [],
  currentCameraIndex: 0,
  torchEnabled: false,
  syncInProgress: false
};

// ==========================================
// AUDIO SYNTHESIZER & HAPTICS (Web Audio API)
// ==========================================
class SoundController {
  constructor() {
    this.ctx = null;
    this.audioFah = null;
    try {
      this.audioFah = new Audio('./fah.mp3');
      this.audioFah.preload = 'auto';
    } catch (e) {
      console.warn("Audio fah preload error:", e);
    }
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playSuccess() {
    if (!state.soundEnabled) return;
    this.initContext();
    this.vibrate([40, 50, 40]);
    
    // Play upbeat 3-tone chime (C5 -> E5 -> G5)
    if (this.ctx) {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.3, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.26);
      });
    }
  }

  playCash() {
    if (!state.soundEnabled) return;
    this.initContext();
    this.vibrate([60, 40, 80]);

    if (this.ctx) {
      const now = this.ctx.currentTime;
      // High coin ping
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.06); // E6

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    }
  }

  playWarning() {
    if (!state.soundEnabled) return;
    this.initContext();
    this.vibrate([120, 80, 120]);

    if (this.ctx) {
      const now = this.ctx.currentTime;
      // Double warning buzz
      [0, 0.15].forEach(start => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(370, now + start);

        gain.gain.setValueAtTime(0.2, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + 0.13);
      });
    }
  }

  playError() {
    if (!state.soundEnabled) return;
    this.initContext();
    this.vibrate([200]);

    if (this.ctx) {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(120, now + 0.3);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    }
  }

  vibrate(pattern) {
    if ("vibrate" in navigator) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }
}

const sounds = new SoundController();

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "⚡";
  if (type === "success") icon = "✅";
  if (type === "warning") icon = "⚠️";
  if (type === "error") icon = "❌";

  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    toast.style.transition = "all 0.25s ease";
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// ==========================================
// PIN AUTHENTICATION
// ==========================================
function initAuth() {
  // Check if session was already authenticated
  const savedAuth = sessionStorage.getItem("quilombo_admin_auth") || localStorage.getItem("quilombo_admin_auth");
  if (savedAuth === "true") {
    state.isAuthenticated = true;
    document.getElementById("authOverlay").classList.add("hidden");
    bootstrapApp();
    return;
  }

  const pinDisplay = document.getElementById("pinDisplay");
  const pinDots = pinDisplay ? pinDisplay.querySelectorAll(".pin-dot") : [];
  const pinError = document.getElementById("pinError");

  function updatePinView() {
    pinDots.forEach((dot, idx) => {
      if (idx < state.enteredPin.length) {
        dot.classList.add("filled");
      } else {
        dot.classList.remove("filled");
      }
    });
  }

  function handlePinInput(char) {
    if (state.enteredPin.length >= 7) return;
    sounds.vibrate([25]);
    state.enteredPin += char;
    updatePinView();
    if (pinError) pinError.textContent = "";

    if (state.enteredPin.length === 7) {
      validatePin();
    }
  }

  function validatePin() {
    if (state.enteredPin === CONFIG.ORGANIZER_PIN) {
      sounds.playSuccess();
      state.isAuthenticated = true;
      sessionStorage.setItem("quilombo_admin_auth", "true");
      localStorage.setItem("quilombo_admin_auth", "true");
      
      const overlay = document.getElementById("authOverlay");
      overlay.style.opacity = "0";
      setTimeout(() => {
        overlay.classList.add("hidden");
        overlay.style.opacity = "";
        bootstrapApp();
      }, 300);
      showToast("¡Acceso concedido! Bienvenido al Staff de Rock & Riff", "success");
    } else {
      sounds.playError();
      if (pinError) pinError.textContent = "Contraseña incorrecta. Intentá nuevamente.";
      const card = document.querySelector(".auth-card");
      if (card) {
        card.style.animation = "none";
        setTimeout(() => card.style.animation = "shake 0.35s ease", 10);
      }
      setTimeout(() => {
        state.enteredPin = "";
        updatePinView();
      }, 600);
    }
  }

  document.querySelectorAll(".pin-btn[data-key]").forEach(btn => {
    btn.addEventListener("click", () => handlePinInput(btn.dataset.key));
  });

  document.getElementById("btnPinBackspace")?.addEventListener("click", () => {
    sounds.vibrate([15]);
    state.enteredPin = state.enteredPin.slice(0, -1);
    updatePinView();
  });

  document.getElementById("btnPinClear")?.addEventListener("click", () => {
    sounds.vibrate([20, 20]);
    state.enteredPin = "";
    updatePinView();
  });

  document.getElementById("btnQuickLogin")?.addEventListener("click", () => {
    state.enteredPin = CONFIG.ORGANIZER_PIN;
    updatePinView();
    setTimeout(validatePin, 150);
  });

  // Physical keyboard support
  window.addEventListener("keydown", (e) => {
    if (state.isAuthenticated) return;
    if (e.key >= "0" && e.key <= "9") {
      handlePinInput(e.key);
    } else if (e.key === "Backspace") {
      state.enteredPin = state.enteredPin.slice(0, -1);
      updatePinView();
    } else if (e.key === "Enter" && state.enteredPin.length === 7) {
      validatePin();
    }
  });
}

function logout() {
  sessionStorage.removeItem("quilombo_admin_auth");
  localStorage.removeItem("quilombo_admin_auth");
  state.isAuthenticated = false;
  state.enteredPin = "";
  if (state.html5QrCode && state.isCameraScanning) {
    state.html5QrCode.stop().catch(() => {});
    state.isCameraScanning = false;
  }
  const overlay = document.getElementById("authOverlay");
  overlay.classList.remove("hidden");
  document.querySelectorAll(".pin-dot").forEach(d => d.classList.remove("filled"));
}

// ==========================================
// SUPABASE DATA MANAGEMENT & PERSISTENCE
// ==========================================
async function fetchReservationsFromSupabase() {
  const syncPill = document.getElementById("syncStatus");
  const syncText = document.getElementById("syncStatusText");
  
  if (syncPill) syncPill.className = "status-pill syncing";
  if (syncText) syncText.textContent = "Sincronizando...";

  try {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/reservations?select=*&order=created_at.desc`, {
      headers: {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      }
    });

    if (!res.ok) throw new Error(`HTTP error ${res.status}`);

    const data = await res.json();
    state.reservations = [...getSimulatedTickets(), ...data];

    // Cache locally for offline reliability
    localStorage.setItem("quilombo_cached_reservations", JSON.stringify(data));
    localStorage.setItem("quilombo_cache_time", Date.now().toString());

    if (syncPill) syncPill.className = "status-pill";
    if (syncText) syncText.textContent = "En línea";

    updateMetricsAndUI();
  } catch (err) {
    console.warn("[Sync] Error fetching from Supabase, loading offline cache:", err);
    loadOfflineCache();
    if (syncPill) syncPill.className = "status-pill offline";
    if (syncText) syncText.textContent = "Modo Offline";
    showToast("Sin conexión a Supabase. Usando datos guardados en caché.", "warning");
  }
}

function loadOfflineCache() {
  try {
    const cached = localStorage.getItem("quilombo_cached_reservations");
    if (cached) {
      state.reservations = [...getSimulatedTickets(), ...JSON.parse(cached)];
      updateMetricsAndUI();
    }
  } catch (e) {
    console.error("Error reading cache:", e);
  }
}

/**
 * Parses check-in details from reservation record.
 * A check-in is encoded in `meme_sticker_used` as `${originalMeme}|CHECKED_IN:${ISO_TIMESTAMP}:${CASHIER}`
 * or tracked in localStorage `quilombo_local_checkins`.
 */
function getCheckinData(record) {
  if (!record) return { isCheckedIn: false, time: null, cashier: null };

  const rawMeme = record.meme_sticker_used || "";
  if (rawMeme.includes("|CHECKED_IN:")) {
    const parts = rawMeme.split("|CHECKED_IN:");
    const subParts = (parts[1] || "").split(":");
    // reconstructed date
    let timestamp = parts[1];
    let cashier = "Staff Puerta";
    if (subParts.length >= 3) {
      timestamp = subParts.slice(0, 3).join(":");
      cashier = subParts[3] || cashier;
    }
    return {
      isCheckedIn: true,
      time: new Date(timestamp),
      cashier: cashier
    };
  }

  // Check local offline overrides
  const localCheckins = getLocalCheckins();
  if (localCheckins[record.id]) {
    return {
      isCheckedIn: true,
      time: new Date(localCheckins[record.id].time),
      cashier: localCheckins[record.id].cashier || "Staff Puerta"
    };
  }

  return { isCheckedIn: false, time: null, cashier: null };
}

function getLocalCheckins() {
  try {
    return JSON.parse(localStorage.getItem("quilombo_local_checkins") || "{}");
  } catch {
    return {};
  }
}

function saveLocalCheckin(id, time, cashier = "Staff") {
  const local = getLocalCheckins();
  local[id] = { time: time.toISOString(), cashier };
  localStorage.setItem("quilombo_local_checkins", JSON.stringify(local));
}

function removeLocalCheckin(id) {
  const local = getLocalCheckins();
  delete local[id];
  localStorage.setItem("quilombo_local_checkins", JSON.stringify(local));
}

/**
 * Saves check-in directly to Supabase and local cache
 */
async function markCheckin(ticket, markAsPaid = false) {
  const now = new Date();
  const timeISO = now.toISOString();

  // Prepare updated meme_sticker_used
  const baseMeme = (ticket.meme_sticker_used || "meme-quilombo").split("|")[0];
  const newMemeField = `${baseMeme}|CHECKED_IN:${timeISO}:Staff`;

  // Update in memory
  ticket.meme_sticker_used = newMemeField;
  if (markAsPaid) {
    ticket.is_paid = true;
  }

  // Save to local checkin cache immediately
  saveLocalCheckin(ticket.id, now, "Staff");

  // Add to recent list
  state.recentCheckins.unshift({
    ticketId: ticket.id,
    ticketCode: ticket.ticket_code,
    buyerName: ticket.buyer_name,
    quantity: ticket.quantity || 1,
    time: now,
    paidAtDoor: markAsPaid
  });
  if (state.recentCheckins.length > 10) state.recentCheckins.pop();

  updateMetricsAndUI();

  // If simulated ticket, update simulation state and skip remote DB patch
  if (ticket.id?.startsWith("sim-")) {
    updateSimulatedTicket(ticket);
    return;
  }

  // Send PATCH to Supabase in background
  const patchPayload = { meme_sticker_used: newMemeField };
  if (markAsPaid) patchPayload.is_paid = true;

  try {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/reservations?id=eq.${ticket.id}`, {
      method: "PATCH",
      headers: {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(patchPayload)
    });
    if (!res.ok) console.warn("Supabase check-in patch returned status:", res.status);
  } catch (err) {
    console.warn("Background check-in patch failed (will sync when online):", err);
  }
}

/**
 * Reverts / undoes a checkin if marked accidentally
 */
async function undoCheckin(ticket) {
  const baseMeme = (ticket.meme_sticker_used || "meme-quilombo").split("|")[0];
  ticket.meme_sticker_used = baseMeme;

  removeLocalCheckin(ticket.id);

  // Remove from recent checkins
  state.recentCheckins = state.recentCheckins.filter(c => c.ticketId !== ticket.id);

  updateMetricsAndUI();

  if (ticket.id?.startsWith("sim-")) {
    updateSimulatedTicket(ticket);
    showToast(`Se deshizo el ingreso de prueba #${ticket.ticket_code}`, "info");
    return;
  }

  try {
    await fetch(`${CONFIG.SUPABASE_URL}/reservations?id=eq.${ticket.id}`, {
      method: "PATCH",
      headers: {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ meme_sticker_used: baseMeme })
    });
    showToast(`Se deshizo el ingreso de #${ticket.ticket_code}`, "info");
  } catch (err) {
    console.warn("Error reverting check-in:", err);
  }
}

// ==========================================
// UI METRICS & LISTS RENDERING
// ==========================================
function updateMetricsAndUI() {
  const activeTickets = state.reservations.filter(r => r.tier_id !== "deleted");

  let totalTickets = activeTickets.length;
  let totalHeadcount = 0;
  let insideHeadcount = 0;
  let cashCollected = 0;

  activeTickets.forEach(r => {
    const qty = Number(r.quantity) || 1;
    totalHeadcount += qty;

    const checkin = getCheckinData(r);
    if (checkin.isCheckedIn) {
      insideHeadcount += qty;
    }

    // Door cash collection metric
    const isCashOrDoor = r.payment_method?.toLowerCase().includes("efectivo") || 
                         r.tier_id === "cash" || 
                         r.tier_id === "efectivo";
    if (isCashOrDoor && r.is_paid) {
      cashCollected += Number(r.total_usd) || 0;
    }
  });

  const remainingHeadcount = Math.max(0, totalHeadcount - insideHeadcount);

  // Update counter cards
  const elInside = document.getElementById("metricInsideCount");
  const elTotal = document.getElementById("metricTotalCount");
  const elRem = document.getElementById("metricRemainingCount");
  const elCash = document.getElementById("metricCashCount");

  if (elInside) elInside.textContent = `${insideHeadcount} pers.`;
  if (elTotal) elTotal.textContent = `${totalTickets} (${totalHeadcount}p)`;
  if (elRem) elRem.textContent = `${remainingHeadcount} pers.`;
  if (elCash) elCash.textContent = `$${cashCollected} USD`;

  // Render recent check-ins strip
  renderRecentCheckins();

  // Render attendees list
  renderAttendeesList();
}

function renderRecentCheckins() {
  const container = document.getElementById("recentEntriesList");
  const countEl = document.getElementById("recentEntriesCount");
  if (!container) return;

  if (state.recentCheckins.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 1.5rem; color: var(--text-subtle); font-size: 0.8rem;">
        Aún no se han registrado ingresos en esta sesión.
      </div>
    `;
    if (countEl) countEl.textContent = "0 registros";
    return;
  }

  if (countEl) countEl.textContent = `${state.recentCheckins.length} recientes`;

  container.innerHTML = state.recentCheckins.map(entry => {
    const timeFormatted = entry.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `
      <div class="recent-entry-card" onclick="openTicketByCode('${entry.ticketCode}')">
        <div class="recent-entry-info">
          <div class="recent-entry-icon">✓</div>
          <div>
            <div style="font-weight: 800; color: #fff; font-size: 0.88rem;">
              ${escapeHtml(entry.buyerName)}
            </div>
            <div style="font-size: 0.72rem; color: var(--neon-cyan); font-family: monospace;">
              #${entry.ticketCode} • ${entry.quantity} ${entry.quantity > 1 ? 'Personas' : 'Persona'}
              ${entry.paidAtDoor ? '<span style="color: var(--neon-yellow); margin-left: 0.35rem;">[Cobrado $]</span>' : ''}
            </div>
          </div>
        </div>
        <div class="recent-entry-time">
          🕒 ${timeFormatted}
        </div>
      </div>
    `;
  }).join('');
}

function renderAttendeesList() {
  const container = document.getElementById("attendeesListContainer");
  if (!container) return;

  const searchQuery = (document.getElementById("attendeesListSearch")?.value || "").toLowerCase().trim();
  const filter = state.activeFilter;

  const filtered = state.reservations.filter(r => {
    if (r.tier_id === "deleted") return false;

    const checkin = getCheckinData(r);
    const isPaid = !!r.is_paid;
    const isDoorPay = (r.payment_method?.toLowerCase().includes("efectivo") || r.tier_id === "cash") && !isPaid;

    if (filter === "inside" && !checkin.isCheckedIn) return false;
    if (filter === "pending" && checkin.isCheckedIn) return false;
    if (filter === "door_pay" && !isDoorPay) return false;
    if (filter === "paid" && !isPaid) return false;

    if (searchQuery) {
      const matchName = (r.buyer_name || "").toLowerCase().includes(searchQuery);
      const matchDni = (r.buyer_dni || "").toLowerCase().includes(searchQuery);
      const matchCode = (r.ticket_code || "").toLowerCase().includes(searchQuery);
      const matchPhone = (r.buyer_phone || "").includes(searchQuery);
      if (!matchName && !matchDni && !matchCode && !matchPhone) return false;
    }

    return true;
  });

  // Update counts in filter chips
  const total = state.reservations.filter(r => r.tier_id !== "deleted").length;
  const inside = state.reservations.filter(r => r.tier_id !== "deleted" && getCheckinData(r).isCheckedIn).length;
  const pending = total - inside;
  const doorPay = state.reservations.filter(r => r.tier_id !== "deleted" && !r.is_paid && (r.payment_method?.toLowerCase().includes("efectivo") || r.tier_id === "cash")).length;
  const paid = state.reservations.filter(r => r.tier_id !== "deleted" && r.is_paid).length;

  document.getElementById("countFilterAll").textContent = total;
  document.getElementById("countFilterInside").textContent = inside;
  document.getElementById("countFilterPending").textContent = pending;
  document.getElementById("countFilterDoorPay").textContent = doorPay;
  document.getElementById("countFilterPaid").textContent = paid;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem; color: var(--text-subtle);">
        No se encontraron asistentes con el filtro actual.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(r => {
    const checkin = getCheckinData(r);
    const qty = r.quantity || 1;
    const isPaid = !!r.is_paid;
    const isDoor = r.payment_method?.toLowerCase().includes("efectivo") || r.tier_id === "cash";

    let badgeHtml = '';
    if (checkin.isCheckedIn) {
      badgeHtml = `<span class="badge badge-in">🟢 EN SALA</span>`;
    } else if (isDoor && !isPaid) {
      badgeHtml = `<span class="badge badge-pending">💵 COBRAR $${r.total_usd}</span>`;
    } else if (isPaid) {
      badgeHtml = `<span class="badge badge-paid">✓ PAGADO</span>`;
    } else {
      badgeHtml = `<span class="badge badge-pending">⏳ PENDIENTE</span>`;
    }

    return `
      <div class="attendee-row ${checkin.isCheckedIn ? 'checked-in' : ''}" onclick="openTicketById('${r.id}')">
        <div>
          <div style="font-weight: 800; color: #fff; font-size: 0.92rem; display: flex; align-items: center; gap: 0.4rem;">
            <span>${escapeHtml(r.buyer_name || 'Sin nombre')}</span>
            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">(${qty} ${qty > 1 ? 'entradas' : 'entrada'})</span>
          </div>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.15rem; display: flex; gap: 0.6rem; align-items: center;">
            <span style="font-family: monospace; color: var(--neon-cyan); font-weight: 700;">#${r.ticket_code}</span>
            <span>🪪 ${escapeHtml(r.buyer_dni || '')}</span>
            <span>📱 ${escapeHtml(r.buyer_phone || '')}</span>
          </div>
        </div>
        <div>
          ${badgeHtml}
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// SEARCH & AUTOCOMPLETE LOGIC
// ==========================================
function initSearch() {
  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("searchClearBtn");
  const dropdown = document.getElementById("searchResultsDropdown");

  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    if (query.length > 0) {
      clearBtn?.classList.add("visible");
      performSearch(query);
    } else {
      clearBtn?.classList.remove("visible");
      dropdown?.classList.remove("visible");
    }
  });

  clearBtn?.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.classList.remove("visible");
    dropdown?.classList.remove("visible");
    searchInput.focus();
  });

  // Enter triggers exact first match
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const firstItem = dropdown?.querySelector(".search-result-item");
      if (firstItem) {
        firstItem.click();
      }
    }
  });

  function performSearch(query) {
    const cleanQuery = query.replace("#", "").replace(/-/g, "").toLowerCase();
    
    const matches = state.reservations.filter(r => {
      if (r.tier_id === "deleted") return false;

      const code = (r.ticket_code || "").toLowerCase().replace(/-/g, "");
      const name = (r.buyer_name || "").toLowerCase();
      const dni = (r.buyer_dni || "").toLowerCase().replace(/\./g, "").replace(/-/g, "");
      const phone = (r.buyer_phone || "").replace(/[^0-9]/g, "");

      return code.includes(cleanQuery) || 
             name.includes(query) || 
             dni.includes(cleanQuery) || 
             phone.includes(cleanQuery);
    }).slice(0, 8);

    if (matches.length === 0) {
      dropdown.innerHTML = `
        <div style="padding: 1rem; text-align: center; color: var(--text-subtle); font-size: 0.82rem;">
          No se encontró ningún boleto para "<strong>${escapeHtml(query)}</strong>"
        </div>
      `;
      dropdown.classList.add("visible");
      return;
    }

    dropdown.innerHTML = matches.map(r => {
      const checkin = getCheckinData(r);
      const isPaid = !!r.is_paid;
      const isDoor = r.payment_method?.toLowerCase().includes("efectivo") || r.tier_id === "cash";

      let statusBadge = '';
      if (checkin.isCheckedIn) {
        statusBadge = `<span class="res-item-badge badge-in">🟢 YA EN SALA</span>`;
      } else if (isDoor && !isPaid) {
        statusBadge = `<span class="res-item-badge badge-pending">💵 COBRAR $${r.total_usd}</span>`;
      } else if (isPaid) {
        statusBadge = `<span class="res-item-badge badge-paid">✓ PAGADO</span>`;
      } else {
        statusBadge = `<span class="res-item-badge badge-pending">⏳ PENDIENTE</span>`;
      }

      return `
        <div class="search-result-item" onclick="openTicketById('${r.id}'); document.getElementById('searchResultsDropdown').classList.remove('visible');">
          <div class="res-item-main">
            <span class="res-item-name">${escapeHtml(r.buyer_name)}</span>
            <div class="res-item-meta">
              <span class="res-item-code">#${r.ticket_code}</span>
              <span>• DNI: ${escapeHtml(r.buyer_dni || '')}</span>
              <span>• ${r.quantity || 1} pers.</span>
            </div>
          </div>
          <div>${statusBadge}</div>
        </div>
      `;
    }).join('');

    dropdown.classList.add("visible");
  }

  // Close dropdown on click outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-section")) {
      dropdown?.classList.remove("visible");
    }
  });

  // Attendees list search input
  const attendeesSearch = document.getElementById("attendeesListSearch");
  attendeesSearch?.addEventListener("input", () => {
    renderAttendeesList();
  });
}

// ==========================================
// CAMERA QR SCANNER (html5-qrcode)
// ==========================================
async function initQrScanner() {
  const qrElement = document.getElementById("qr-reader");
  if (!qrElement || typeof Html5Qrcode === "undefined") {
    console.error("Html5Qrcode library not loaded");
    return;
  }

  try {
    state.html5QrCode = new Html5Qrcode("qr-reader");

    // Enumerate cameras
    const cameras = await Html5Qrcode.getCameras();
    if (cameras && cameras.length > 0) {
      state.availableCameras = cameras;
      // Prefer rear/environment camera
      const backCamIndex = cameras.findIndex(c => 
        c.label.toLowerCase().includes("back") || 
        c.label.toLowerCase().includes("rear") || 
        c.label.toLowerCase().includes("environment") ||
        c.label.toLowerCase().includes("trasera")
      );
      state.currentCameraIndex = backCamIndex !== -1 ? backCamIndex : 0;
      startCameraScanning();
    } else {
      showToast("No se detectaron cámaras en este dispositivo.", "warning");
    }
  } catch (err) {
    console.warn("Camera init warning:", err);
    showToast("Permiso de cámara requerido para escanear QR.", "warning");
  }

  // Camera control buttons
  const btnToggle = document.getElementById("btnToggleCamera");
  btnToggle?.addEventListener("click", () => {
    if (state.isCameraScanning) {
      pauseOrStopCamera();
      btnToggle.textContent = "▶️ Reanudar Cámara";
      btnToggle.classList.remove("active");
    } else {
      startCameraScanning();
      btnToggle.textContent = "⏸️ Pausar Cámara";
      btnToggle.classList.add("active");
    }
  });

  const btnSwitch = document.getElementById("btnSwitchCamera");
  btnSwitch?.addEventListener("click", async () => {
    if (state.availableCameras.length <= 1) {
      showToast("Solo hay una cámara disponible.", "info");
      return;
    }
    state.currentCameraIndex = (state.currentCameraIndex + 1) % state.availableCameras.length;
    if (state.isCameraScanning) {
      await state.html5QrCode.stop();
      startCameraScanning();
    }
    showToast(`Cámara cambiada: ${state.availableCameras[state.currentCameraIndex].label}`, "info");
  });

  // Torch / Flashlight button
  const btnTorch = document.getElementById("btnToggleTorch");
  btnTorch?.addEventListener("click", () => toggleTorch());

  // File gallery scanner
  const fileInput = document.getElementById("fileScanInput");
  fileInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      showToast("Analizando imagen...", "info");
      const decodedResult = await state.html5QrCode.scanFile(file, true);
      handleDecodedQr(decodedResult);
    } catch (err) {
      sounds.playError();
      showToast("No se pudo detectar ningún código QR en la imagen.", "error");
    } finally {
      fileInput.value = "";
    }
  });
}

async function startCameraScanning() {
  if (!state.html5QrCode || state.availableCameras.length === 0) return;

  const cameraId = state.availableCameras[state.currentCameraIndex]?.id || { facingMode: "environment" };

  try {
    await state.html5QrCode.start(
      cameraId,
      {
        fps: 20,
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.floor(minEdge * 0.72);
          return {
            width: Math.max(200, Math.min(boxSize, 280)),
            height: Math.max(200, Math.min(boxSize, 280))
          };
        },
        aspectRatio: 1.0
      },
      (decodedText, decodedResult) => {
        handleDecodedQr(decodedText);
      },
      (errorMessage) => {
        // Continuous parse errors are normal while seeking a QR code
      }
    );
    state.isCameraScanning = true;
  } catch (err) {
    console.warn("Failed to start camera:", err);
    state.isCameraScanning = false;
  }
}

async function toggleTorch(forceState = null) {
  const torchBtn = document.getElementById("btnToggleTorch");

  if (!state.isCameraScanning && forceState === null) {
    showToast("Iniciá la cámara primero para encender la linterna", "info");
    return;
  }

  try {
    const video = document.querySelector("#qr-reader video");
    const stream = video ? video.srcObject : null;
    const track = stream ? stream.getVideoTracks()[0] : null;

    if (!track) {
      if (forceState === null) showToast("No se encontró el sensor de video de la cámara", "warning");
      return;
    }

    const nextState = forceState !== null ? forceState : !state.torchEnabled;

    await track.applyConstraints({
      advanced: [{ torch: nextState }]
    });

    state.torchEnabled = nextState;

    if (torchBtn) {
      torchBtn.classList.toggle("active", state.torchEnabled);
      torchBtn.innerHTML = state.torchEnabled 
        ? `<span>⚡</span> <span>Flash ON</span>` 
        : `<span>🔦</span> <span>Flash</span>`;
    }

    if (forceState === null) {
      sounds.vibrate([40]);
      showToast(`Linterna ${state.torchEnabled ? 'ENCENDIDA ⚡' : 'apagada'}`, "info");
    }
  } catch (err) {
    console.warn("Torch constraint error:", err);
    if (forceState === null) {
      showToast("Tu navegador o cámara no admite control de linterna", "warning");
    }
  }
}

async function pauseOrStopCamera() {
  if (state.html5QrCode && state.isCameraScanning) {
    try {
      if (state.torchEnabled) {
        await toggleTorch(false);
      }
      await state.html5QrCode.stop();
      state.isCameraScanning = false;
    } catch (e) {}
  }
}

// ==========================================
// QR CODE RESOLVER & TICKET FINDER
// ==========================================
function handleDecodedQr(decodedText) {
  // Prevent duplicate rapid scans when modal is already visible
  const modal = document.getElementById("ticketModalOverlay");
  if (!modal.classList.contains("hidden")) return;

  sounds.playSuccess();
  console.log("[QR Decoded Raw]:", decodedText);

  // Extract Ticket Code or DNI from decoded text
  // Formats can be:
  // 1) QLB-26-6260 or #QLB-26-6260
  // 2) DEL_xyz_QLB-26-XXXX
  // 3) https://elquilomboo.netlify.app/?ticket=QLB-26-XXXX or similar
  // 4) JSON object
  // 5) DNI number (e.g. 32027336)
  
  let targetCode = null;
  let targetDni = null;

  // Check regex for QLB code
  const qlbMatch = decodedText.match(/(?:DEL_[a-z0-9]+_)?QLB-\d{2}-\d{4}/i);
  if (qlbMatch) {
    targetCode = qlbMatch[0].toUpperCase();
  } else {
    // Check if JSON
    try {
      const json = JSON.parse(decodedText);
      if (json.ticketCode || json.ticket_code) {
        targetCode = (json.ticketCode || json.ticket_code).toUpperCase();
      }
      if (json.buyerDni || json.dni) {
        targetDni = (json.buyerDni || json.dni).toString().trim();
      }
    } catch {
      // Direct raw text
      targetCode = decodedText.trim().toUpperCase();
    }
  }

  // Lookup in database
  let found = null;
  if (targetCode) {
    found = state.reservations.find(r => 
      (r.ticket_code || "").toUpperCase() === targetCode ||
      (r.ticket_code || "").toUpperCase() === `#${targetCode}`
    );
  }

  if (!found && targetDni) {
    found = state.reservations.find(r => 
      (r.buyer_dni || "").replace(/[^0-9]/g, "") === targetDni.replace(/[^0-9]/g, "")
    );
  }

  // If still not found, check partial code or DNI digits
  if (!found && targetCode) {
    const cleanDigits = targetCode.replace(/[^0-9]/g, "");
    if (cleanDigits.length >= 4) {
      found = state.reservations.find(r => 
        (r.ticket_code || "").replace(/[^0-9]/g, "").endsWith(cleanDigits) ||
        (r.buyer_dni || "").replace(/[^0-9]/g, "").includes(cleanDigits)
      );
    }
  }

  if (found) {
    openTicketVerificationModal(found);
  } else {
    sounds.playError();
    showToast(`Código escaneado no encontrado: "${decodedText.substring(0, 24)}"`, "error");
  }
}

function openTicketById(id) {
  const found = state.reservations.find(r => r.id === id);
  if (found) openTicketVerificationModal(found);
}

function openTicketByCode(code) {
  const found = state.reservations.find(r => r.ticket_code === code);
  if (found) openTicketVerificationModal(found);
}

// ==========================================
// TICKET VERIFICATION MODAL LOGIC
// ==========================================
function openTicketVerificationModal(ticket) {
  state.currentModalTicket = ticket;

  const modalOverlay = document.getElementById("ticketModalOverlay");
  const banner = document.getElementById("modalStatusBanner");
  const bannerIcon = document.getElementById("modalStatusIcon");
  const bannerTitle = document.getElementById("modalStatusTitle");

  const elQty = document.getElementById("modalQuantity");
  const elTier = document.getElementById("modalTierName");
  const elCode = document.getElementById("modalTicketCode");
  const elName = document.getElementById("modalBuyerName");
  const elDni = document.getElementById("modalBuyerDni");
  const elPhone = document.getElementById("modalBuyerPhone");
  const elPayStatus = document.getElementById("modalPaymentStatus");
  const elAmount = document.getElementById("modalTotalAmount");
  const elTimeRow = document.getElementById("modalCheckinTimeRow");
  const elTime = document.getElementById("modalCheckinTime");
  const elArtist = document.getElementById("modalFavoriteArtist");
  const actionsContainer = document.getElementById("modalActionsContainer");

  const checkin = getCheckinData(ticket);
  const qty = Number(ticket.quantity) || 1;
  const isPaid = !!ticket.is_paid;
  const isDeleted = ticket.tier_id === "deleted";
  const isDoorCash = ticket.payment_method?.toLowerCase().includes("efectivo") || ticket.tier_id === "cash";

  // Fill Ticket Metadata
  if (elQty) elQty.textContent = `${qty} ${qty > 1 ? 'PERSONAS' : 'PERSONA'}`;
  if (elTier) elTier.textContent = (ticket.tier_name || 'PASE OFICIAL').toUpperCase();
  if (elCode) elCode.textContent = `#${ticket.ticket_code}`;
  if (elName) elName.textContent = ticket.buyer_name || 'Sin Nombre';
  if (elDni) elDni.textContent = ticket.buyer_dni || 'Sin Cédula';
  if (elPhone) elPhone.innerHTML = ticket.buyer_phone ? 
    `<a href="https://wa.me/${ticket.buyer_phone.replace(/[^0-9]/g, '')}" target="_blank" style="color: var(--neon-cyan); text-decoration: none;">💬 ${escapeHtml(ticket.buyer_phone)}</a>` : 
    'No indicado';

  if (elAmount) elAmount.textContent = `$${ticket.total_usd || 0} USD (Ref: Bs. ${ticket.total_ref_bs || '0'})`;
  if (elArtist) elArtist.textContent = ticket.favorite_artist || 'Sin tema especificado';

  // State Evaluation & Banner Design
  banner.className = "modal-status-banner";

  if (isDeleted) {
    // TICKET CANCELLED
    banner.classList.add("status-invalid");
    bannerIcon.textContent = "🚫";
    bannerTitle.textContent = "ENTRADA CANCELADA / ELIMINADA";
    elPayStatus.textContent = "Eliminada del sistema";
    elTimeRow.style.display = "none";
    sounds.playError();

    actionsContainer.innerHTML = `
      <button type="button" class="btn-action-secondary" onclick="closeTicketModal()">
        ✕ Cerrar y Volver a Escanear
      </button>
    `;
  } else if (checkin.isCheckedIn) {
    // ALREADY ENTERED
    banner.classList.add("status-alert");
    bannerIcon.textContent = "⚠️";
    bannerTitle.textContent = "¡ALERTA! TICKET YA INGRESÓ";
    elPayStatus.textContent = isPaid ? "Pagado ✓" : "Cobrado en Puerta 💵";

    elTimeRow.style.display = "flex";
    const timeFormatted = checkin.time ? checkin.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Hoy";
    elTime.textContent = `${timeFormatted} (${checkin.cashier || 'Puerta'})`;

    sounds.playWarning();

    actionsContainer.innerHTML = `
      <button type="button" class="btn-action-primary" style="background: linear-gradient(135deg, #f59e0b, #d97706); border-color: #fbbf24; color: #000;" onclick="confirmCheckinAction(false)">
        <span>⚠️ RE-CONFIRMAR ACCESO (${qty} PERSONAS)</span>
      </button>
      <button type="button" class="btn-action-secondary" style="color: #f87171; border-color: rgba(239, 68, 68, 0.4);" onclick="handleUndoFromModal()">
        ↩️ Deshacer Ingreso (Marcar como No Ingresado)
      </button>
      <button type="button" class="btn-action-secondary" onclick="closeTicketModal()">
        ✕ Escanear Siguiente
      </button>
    `;
  } else if (isDoorCash && !isPaid) {
    // PENDING DOOR PAYMENT
    banner.classList.add("status-warn");
    bannerIcon.textContent = "💵";
    bannerTitle.textContent = `PAGO EN PUERTA: COBRAR $${ticket.total_usd} USD`;
    elPayStatus.innerHTML = `<span style="color: var(--neon-yellow); font-weight: 800;">PENDIENTE DE COBRO EN PUERTA</span>`;
    elTimeRow.style.display = "none";

    sounds.playCash();

    actionsContainer.innerHTML = `
      <button type="button" class="btn-action-cash" onclick="confirmCheckinAction(true)">
        <span>💵 REGISTRAR PAGO ($${ticket.total_usd} USD) Y DAR ACCESO</span>
      </button>
      <button type="button" class="btn-action-primary" onclick="confirmCheckinAction(false)">
        <span>✓ DAR ACCESO SIN COBRAR (Cortesía / Ya pagó)</span>
      </button>
      <button type="button" class="btn-action-secondary" onclick="closeTicketModal()">
        ✕ Cancelar / Siguiente
      </button>
    `;
  } else if (!isPaid) {
    // UNCONFIRMED WIRE TRANSFER
    banner.classList.add("status-warn");
    bannerIcon.textContent = "⏳";
    bannerTitle.textContent = "TRANSFERENCIA PENDIENTE POR VALIDAR";
    elPayStatus.innerHTML = `<span style="color: var(--neon-yellow); font-weight: 800;">Comprobante no confirmado ($${ticket.total_usd} USD)</span>`;
    elTimeRow.style.display = "none";

    sounds.playWarning();

    actionsContainer.innerHTML = `
      <button type="button" class="btn-action-primary" onclick="confirmCheckinAction(true)">
        <span>✅ VALIDAR PAGO Y DAR ACCESO (${qty}p)</span>
      </button>
      <button type="button" class="btn-action-secondary" onclick="closeTicketModal()">
        ✕ Cancelar / Siguiente
      </button>
    `;
  } else {
    // VALID & READY TO ENTER
    banner.classList.add("status-ok");
    bannerIcon.textContent = "✅";
    bannerTitle.textContent = `ACCESO PERMITIDO (${qty} ${qty > 1 ? 'PERSONAS' : 'PERSONA'})`;
    elPayStatus.innerHTML = `<span style="color: var(--neon-green); font-weight: 800;">Pagado Oficial ✓</span>`;
    elTimeRow.style.display = "none";

    sounds.playSuccess();

    actionsContainer.innerHTML = `
      <button type="button" class="btn-action-primary" onclick="confirmCheckinAction(false)">
        <span>🚀 DAR ACCESO (${qty} ${qty > 1 ? 'PERSONAS' : 'PERSONA'})</span>
      </button>
      <button type="button" class="btn-action-secondary" onclick="closeTicketModal()">
        ✕ Siguiente Entrada
      </button>
    `;
  }

  modalOverlay.classList.remove("hidden");
}

function closeTicketModal() {
  const modalOverlay = document.getElementById("ticketModalOverlay");
  modalOverlay.classList.add("hidden");
  state.currentModalTicket = null;
}

async function confirmCheckinAction(markAsPaid = false) {
  if (!state.currentModalTicket) return;
  const ticket = state.currentModalTicket;

  sounds.playSuccess();
  await markCheckin(ticket, markAsPaid);

  showToast(`¡Acceso concedido a ${ticket.buyer_name} (#${ticket.ticket_code})!`, "success");
  closeTicketModal();
}

async function handleUndoFromModal() {
  if (!state.currentModalTicket) return;
  const ticket = state.currentModalTicket;

  if (confirm(`¿Deshacer el ingreso de #${ticket.ticket_code} (${ticket.buyer_name})?`)) {
    await undoCheckin(ticket);
    closeTicketModal();
  }
}

// ==========================================
// EXPRESS WALK-UP SALE (TAQUILLA DIRECTA)
// ==========================================
function initExpressCheckin() {
  const form = document.getElementById("expressCheckinForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("expressName").value.trim();
    const dni = document.getElementById("expressDni").value.trim();
    const qty = parseInt(document.getElementById("expressQty").value) || 1;
    const payment = document.getElementById("expressPayment").value;
    const phone = document.getElementById("expressPhone").value.trim();

    if (!name || !dni) {
      alert("Por favor ingresá el nombre y la cédula del comprador.");
      return;
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const code = `QLB-26-${randomNum}`;
    const totalUSD = qty * CONFIG.TICKET_PRICE_USD;
    const totalRefBs = Number((totalUSD * CONFIG.BCV_RATE).toFixed(2));
    const nowISO = new Date().toISOString();

    const newTicket = {
      ticket_code: code,
      buyer_name: name,
      buyer_dni: dni,
      buyer_phone: phone || "No suministrado",
      buyer_email: "puerta@elquilombo.club",
      tier_id: "general",
      tier_name: "Pase General Oficial (Puerta)",
      quantity: qty,
      total_usd: totalUSD,
      total_ref_bs: totalRefBs,
      payment_method: payment,
      favorite_artist: "Rock & Riff Live",
      meme_sticker_used: `meme-quilombo|CHECKED_IN:${nowISO}:Taquilla`,
      is_paid: true,
      referral_source: "Taquilla Puerta",
      created_at: nowISO
    };

    sounds.playCash();
    showToast(`Registrando venta de #${code} ($${totalUSD} USD)...`, "info");

    // Add to in-memory immediately
    state.reservations.unshift(newTicket);
    markCheckin(newTicket, true);

    // Reset form
    form.reset();

    // Insert into Supabase
    try {
      const res = await fetch(`${CONFIG.SUPABASE_URL}/reservations`, {
        method: "POST",
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify([newTicket])
      });
      if (res.ok) {
        showToast(`¡Venta e ingreso de #${code} registrado exitosamente!`, "success");
      }
    } catch (err) {
      console.warn("Failed to push express ticket to Supabase (saved locally):", err);
    }
  });
}

// ==========================================
// TABS SWITCHER & APP INITIALIZATION
// ==========================================
function initNavigation() {
  const tabButtons = document.querySelectorAll(".nav-tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tab;

      tabButtons.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(targetTab)?.classList.add("active");

      // Pause camera if switching away from scanner tab
      if (targetTab === "tabScanner") {
        if (!state.isCameraScanning && state.html5QrCode) {
          startCameraScanning();
        }
      } else {
        pauseOrStopCamera();
      }
    });
  });

  // Filter chips in attendees list
  document.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.activeFilter = chip.dataset.filter;
      renderAttendeesList();
    });
  });

  // Header action buttons
  document.getElementById("btnRefreshData")?.addEventListener("click", () => {
    sounds.playSuccess();
    showToast("Actualizando datos desde Supabase...", "info");
    fetchReservationsFromSupabase();
  });

  document.getElementById("btnLogout")?.addEventListener("click", () => {
    if (confirm("¿Deseas cerrar la sesión de administrador?")) {
      logout();
    }
  });

  const soundToggleBtn = document.getElementById("btnToggleSound");
  soundToggleBtn?.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    soundToggleBtn.textContent = state.soundEnabled ? "🔊" : "🔇";
    showToast(`Sonido ${state.soundEnabled ? 'activado' : 'desactivado'}`, "info");
  });

  document.getElementById("modalCloseBtn")?.addEventListener("click", closeTicketModal);
  
  // Close modal when tapping outside the dialog (on the dark backdrop)
  const modalOverlay = document.getElementById("ticketModalOverlay");
  modalOverlay?.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeTicketModal();
    }
  });

  // Close modal with Escape key
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTicketModal();
  });
}

// ==========================================
// UTILITIES
// ==========================================
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================
// SIMULATOR & TEST SCENARIOS
// ==========================================
const SIMULATION_DEFAULTS = [
  {
    id: "sim-1",
    ticket_code: "QLB-26-SIM1",
    buyer_name: "Mateo Palacios (Trueno)",
    buyer_dni: "V-29.845.101",
    buyer_phone: "0412 1112233",
    buyer_email: "trueno@quilombo.test",
    tier_id: "general",
    tier_name: "Pase General Oficial",
    quantity: 1,
    total_usd: 15,
    total_ref_bs: 14616.30,
    payment_method: "Pago Móvil",
    favorite_artist: "Dance Crip / Trueno",
    meme_sticker_used: "meme-trueno",
    is_paid: true,
    scenarioType: "valid",
    badgeLabel: "🟢 1 Persona • Pagado",
    badgeClass: "scenario-valid",
    title: "1. Entrada Individual Pagada (Acceso Permitido)",
    desc: "Simula el caso más común: asistente con 1 entrada general ya pagada."
  },
  {
    id: "sim-2",
    ticket_code: "QLB-26-SIM2",
    buyer_name: "Julieta Cazzuchelli (Cazzu)",
    buyer_dni: "V-30.112.540",
    buyer_phone: "0424 9998877",
    buyer_email: "cazzu@quilombo.test",
    tier_id: "general",
    tier_name: "Pase Preventa Oficial",
    quantity: 3,
    total_usd: 45,
    total_ref_bs: 43848.90,
    payment_method: "Pago Móvil",
    favorite_artist: "Nada / Cazzu",
    meme_sticker_used: "meme-cazzu",
    is_paid: true,
    scenarioType: "group",
    badgeLabel: "🟢 3 Personas • Grupal",
    badgeClass: "scenario-group",
    title: "2. Entrada Grupal (3 Personas)",
    desc: "Comprueba que la pantalla resalte '3 PERSONAS' para el personal de seguridad."
  },
  {
    id: "sim-3",
    ticket_code: "QLB-26-SIM3",
    buyer_name: "Mauro Lombardo (Duki)",
    buyer_dni: "V-28.774.920",
    buyer_phone: "0414 5556677",
    buyer_email: "duki@quilombo.test",
    tier_id: "cash",
    tier_name: "Pase General Oficial (Efectivo Puerta)",
    quantity: 1,
    total_usd: 15,
    total_ref_bs: 14616.30,
    payment_method: "Efectivo en Rock & Riff",
    favorite_artist: "Goteo / Duki",
    meme_sticker_used: "meme-duki",
    is_paid: false,
    scenarioType: "doorpay",
    badgeLabel: "🟡 Cobrar $15 USD en Puerta",
    badgeClass: "scenario-doorpay",
    title: "3. Pago Pendiente en Puerta ($15 USD)",
    desc: "El usuario reservó para pagar en efectivo en taquilla. Permite probar el botón 'Registrar Pago y Dar Acceso'."
  },
  {
    id: "sim-4",
    ticket_code: "QLB-26-SIM4",
    buyer_name: "Joaquín Cordovero (Seven Kayne)",
    buyer_dni: "V-31.205.334",
    buyer_phone: "0426 3334455",
    buyer_email: "seven@quilombo.test",
    tier_id: "general",
    tier_name: "Pase General Oficial",
    quantity: 1,
    total_usd: 15,
    total_ref_bs: 14616.30,
    payment_method: "Pago Móvil",
    favorite_artist: "Si te lastimé",
    meme_sticker_used: `meme-seven|CHECKED_IN:${new Date(Date.now() - 25 * 60 * 1000).toISOString()}:Staff`,
    is_paid: true,
    scenarioType: "used",
    badgeLabel: "🔴 Ya Utilizado (Duplicado)",
    badgeClass: "scenario-used",
    title: "4. Intento de Reingreso / Entrada Ya Utilizada",
    desc: "Simula que alguien intenta reutilizar o compartir una captura de una entrada que ya ingresó hace 25 minutos."
  },
  {
    id: "sim-5",
    ticket_code: "FAKE-99-9999",
    buyer_name: "Código No Registrado",
    buyer_dni: "00000000",
    buyer_phone: "",
    buyer_email: "",
    tier_id: "fake",
    tier_name: "Código Desconocido",
    quantity: 1,
    total_usd: 0,
    total_ref_bs: 0,
    payment_method: "Desconocido",
    favorite_artist: "",
    meme_sticker_used: "",
    is_paid: false,
    scenarioType: "fake",
    badgeLabel: "🚫 Inválido / Falso",
    badgeClass: "scenario-fake",
    title: "5. Código QR Inválido o Desconocido",
    desc: "Simula el escaneo de un código que no pertenece al evento para probar el rechazo sonoro y visual."
  }
];

function getSimulatedTickets() {
  try {
    const saved = localStorage.getItem("quilombo_simulated_tickets");
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return JSON.parse(JSON.stringify(SIMULATION_DEFAULTS));
}

function updateSimulatedTicket(ticket) {
  const current = getSimulatedTickets();
  const idx = current.findIndex(s => s.id === ticket.id);
  if (idx !== -1) {
    current[idx] = { ...ticket };
    localStorage.setItem("quilombo_simulated_tickets", JSON.stringify(current));
    renderSimulationCards();
  }
}

function resetSimulations() {
  localStorage.setItem("quilombo_simulated_tickets", JSON.stringify(SIMULATION_DEFAULTS));
  // remove simulation checkins from recent list
  state.recentCheckins = state.recentCheckins.filter(c => !c.ticketId.startsWith("sim-"));
  
  // replace simulation tickets in memory
  state.reservations = [
    ...JSON.parse(JSON.stringify(SIMULATION_DEFAULTS)),
    ...state.reservations.filter(r => !r.id.startsWith("sim-"))
  ];

  updateMetricsAndUI();
  renderSimulationCards();
  sounds.playSuccess();
  showToast("Escenarios de prueba restaurados a su estado original.", "success");
}

function initSimulations() {
  renderSimulationCards();

  document.getElementById("btnResetSimulations")?.addEventListener("click", () => {
    resetSimulations();
  });
}

function renderSimulationCards() {
  const container = document.getElementById("simulationCardsContainer");
  if (!container) return;

  const scenarios = getSimulatedTickets();

  container.innerHTML = scenarios.map((s, idx) => {
    const checkin = getCheckinData(s);
    let currentStatusLabel = s.badgeLabel;
    if (checkin.isCheckedIn && s.scenarioType !== 'used') {
      currentStatusLabel = '🟢 YA INGRESÓ (Simulado)';
    }

    return `
      <div class="sim-card ${s.badgeClass}">
        <div class="sim-card-grid">
          <div class="sim-qr-box">
            <canvas id="qr-canvas-sim-${s.id}" class="sim-qr-canvas"></canvas>
          </div>
          <div class="sim-info-col">
            <div class="sim-scenario-title">
              <span>${escapeHtml(s.title)}</span>
              <span class="badge ${s.is_paid ? 'badge-paid' : 'badge-pending'}" style="font-size: 0.68rem;">
                ${currentStatusLabel}
              </span>
            </div>
            <p style="font-size: 0.76rem; color: var(--text-subtle); margin: 0.2rem 0;">
              ${escapeHtml(s.desc)}
            </p>
            <div class="sim-meta-list">
              <div class="sim-meta-item">
                <span>Código QR:</span>
                <strong style="color: var(--neon-cyan); font-family: monospace;">#${s.ticket_code}</strong>
              </div>
              <div class="sim-meta-item">
                <span>Titular:</span>
                <strong>${escapeHtml(s.buyer_name)} (${s.buyer_dni || 'N/A'})</strong>
              </div>
              <div class="sim-meta-item">
                <span>Entrada:</span>
                <strong>${s.quantity}x ${escapeHtml(s.tier_name)} • $${s.total_usd} USD</strong>
              </div>
            </div>
            <div class="sim-actions-row">
              <button 
                type="button" 
                class="btn-action-primary" 
                style="padding: 0.5rem 0.85rem; font-size: 0.8rem;" 
                onclick="handleDecodedQr('${s.ticket_code}')"
              >
                <span>⚡ Probar Escaneo Directo (1-Tap)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Draw QR codes on canvases using QRious
  setTimeout(() => {
    scenarios.forEach(s => {
      const canvas = document.getElementById(`qr-canvas-sim-${s.id}`);
      if (canvas && typeof QRious !== "undefined") {
        try {
          new QRious({
            element: canvas,
            value: s.ticket_code,
            size: 140,
            level: 'M'
          });
        } catch (e) {
          console.warn("QR generation error:", e);
        }
      }
    });
  }, 50);
}

// ==========================================
// APP BOOTSTRAP
// ==========================================
function bootstrapApp() {
  initNavigation();
  initSearch();
  initQrScanner();
  initExpressCheckin();
  initSimulations();
  fetchReservationsFromSupabase();

  // Periodic polling to keep multiple doors / phones in sync
  setInterval(() => {
    if (state.isAuthenticated && !document.hidden) {
      fetchReservationsFromSupabase();
    }
  }, CONFIG.AUTO_SYNC_INTERVAL_MS);
}

// Run on page load
document.addEventListener("DOMContentLoaded", () => {
  initAuth();
});
