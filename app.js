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
  BCV_RATE: 980.615
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

/**
 * Strict production check: filters out any simulation, test or fake tickets
 */
function isValidProductionTicket(r) {
  if (!r) return false;
  if (r.tier_id === "deleted") return false;
  const id = String(r.id || "");
  const code = String(r.ticket_code || "");
  const name = String(r.buyer_name || "").toLowerCase();
  if (
    id.startsWith("sim-") ||
    code.includes("SIM") ||
    code.includes("FAKE") ||
    code === "QLB-26-VIP" ||
    name.includes("bizarrap") ||
    name.includes("gonzalo conde")
  ) {
    return false;
  }
  return true;
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
    state.reservations = data.filter(isValidProductionTicket);

    // Cache locally for offline reliability
    localStorage.setItem("quilombo_cached_reservations", JSON.stringify(state.reservations));
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
      state.reservations = JSON.parse(cached).filter(isValidProductionTicket);
      updateMetricsAndUI();
    }
  } catch (e) {
    console.error("Error reading cache:", e);
  }
}

/**
 * Calculates current BCV official rate dynamically from Supabase records or fallback
 */
function getBcvRate() {
  if (state.reservations && state.reservations.length > 0) {
    for (const r of state.reservations) {
      if (!r.id?.startsWith("sim-") && Number(r.total_usd) > 0 && Number(r.total_ref_bs) > 0) {
        const calculatedRate = Number(r.total_ref_bs) / Number(r.total_usd);
        if (calculatedRate > 100) {
          return Number(calculatedRate.toFixed(4));
        }
      }
    }
  }
  return CONFIG.BCV_RATE;
}

/**
 * Formats Venezuelan Bolivares (Bs.) with dot thousands and comma decimals (es-VE)
 */
function formatBs(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return "0,00";
  return Number(amount).toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Normalizes text for accent-insensitive and lowercase search comparisons
 */
function normalizeSearch(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Extracts only digit characters from a string
 */
function cleanDigits(str) {
  return (str || "").replace(/[^0-9]/g, "");
}

/**
 * Normalizes a Venezuelan phone number to compare local format and international format:
 * e.g. "+58 424-3358302" -> "4243358302"
 * "04243358302" -> "4243358302"
 */
function normalizePhone(str) {
  let d = cleanDigits(str);
  if (d.startsWith("58")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

/**
 * Creates an accent-insensitive regex pattern from a search token
 */
function makeAccentRegex(token) {
  return (token || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/a/gi, "[aáàäâAÁÀÄÂ]")
    .replace(/e/gi, "[eéèëêEÉÈËÊ]")
    .replace(/i/gi, "[iíìïîIÍÌÏÎ]")
    .replace(/o/gi, "[oóòöôOÓÒÖÔ]")
    .replace(/u/gi, "[uúùüûUÚÙÜÛ]")
    .replace(/n/gi, "[nñNÑ]");
}

/**
 * Highlights matched query tokens inside a string with <mark class="search-highlight">
 */
function highlightTokens(text, rawQuery) {
  if (!text) return "";
  const escaped = escapeHtml(text);
  if (!rawQuery) return escaped;

  const rawTokens = (rawQuery || "").trim().split(/\s+/).filter(Boolean);
  const stopWords = new Set(["de", "el", "la", "en", "al", "los", "las", "un", "una", "y"]);
  const tokens = (rawTokens.length > 1 && rawTokens.some(t => !stopWords.has(t.toLowerCase())))
    ? rawTokens.filter(t => !stopWords.has(t.toLowerCase()))
    : rawTokens;

  if (tokens.length === 0) return escaped;

  const patterns = tokens
    .map(t => t.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(t => t.length > 0)
    .map(t => makeAccentRegex(t));

  if (patterns.length === 0) return escaped;

  try {
    const regex = new RegExp("(" + patterns.join("|") + ")", "gi");
    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
  } catch (e) {
    return escaped;
  }
}

/**
 * Multi-token smart matching across buyer name, ticket code, DNI, phone, notes/artist, and tier
 */
function matchesTicket(r, query) {
  const raw = (query || "").trim();
  if (!raw) return true;

  const normQuery = normalizeSearch(raw);
  const rawTokens = normQuery.split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return true;

  const stopWords = new Set(["de", "el", "la", "en", "al", "los", "las", "un", "una", "y"]);
  const tokens = (rawTokens.length > 1 && rawTokens.some(t => !stopWords.has(t)))
    ? rawTokens.filter(t => !stopWords.has(t))
    : rawTokens;

  // Normalized ticket fields
  const normName = normalizeSearch(r.buyer_name);
  const rawCode = normalizeSearch(r.ticket_code);
  const cleanCode = rawCode.replace(/[^a-z0-9]/g, "");
  const cleanCodeNoMiddle = cleanCode.replace(/^qlb26/, "qlb");
  const codeDigits = cleanDigits(r.ticket_code);
  const normDni = normalizeSearch(r.buyer_dni);
  const dniDigits = cleanDigits(r.buyer_dni);
  const normPhone = normalizePhone(r.buyer_phone);
  const normArtist = normalizeSearch(r.favorite_artist);
  const normTier = normalizeSearch(r.tier_name);
  const normPayMethod = normalizeSearch(r.payment_method);
  const virtualWords = "boleto boletos entrada entradas ticket tickets pase pases acceso cortesia vip general puerta";

  return tokens.every(token => {
    const cleanToken = token.replace(/[^a-z0-9]/g, "");
    const tokenDigits = cleanDigits(token);
    const tokenPhone = normalizePhone(token);

    if (normName.includes(token)) return true;
    if (rawCode.includes(token) || (cleanToken && (cleanCode.includes(cleanToken) || cleanCodeNoMiddle.includes(cleanToken)))) return true;
    if (tokenDigits && tokenDigits.length >= 2 && codeDigits.includes(tokenDigits)) return true;
    if (normDni.includes(token)) return true;
    if (tokenDigits && tokenDigits.length >= 3 && dniDigits.includes(tokenDigits)) return true;
    if (tokenPhone && tokenPhone.length >= 4 && normPhone.includes(tokenPhone)) return true;
    if (normArtist.includes(token)) return true;
    if (normTier.includes(token)) return true;
    if (normPayMethod.includes(token)) return true;
    if (virtualWords.includes(token)) return true;

    return false;
  });
}

/**
 * Calculates a search relevance score to place the most exact matches at the top
 */
function scoreTicketRelevance(r, rawQuery) {
  const normQuery = normalizeSearch(rawQuery);
  const cleanQ = normQuery.replace(/[^a-z0-9]/g, "");
  const normName = normalizeSearch(r.buyer_name);
  const rawCode = normalizeSearch(r.ticket_code);
  const cleanCode = rawCode.replace(/[^a-z0-9]/g, "");
  const cleanDni = cleanDigits(r.buyer_dni);
  const queryDigits = cleanDigits(rawQuery);

  let score = 0;

  // Exact code match or suffix (e.g. typing 1002 or 6260)
  if (rawCode === normQuery || cleanCode === cleanQ) score += 2000;
  else if (queryDigits && cleanCode.endsWith(queryDigits)) score += 1500;
  else if (cleanCode.includes(cleanQ)) score += 800;

  // Name starts with query
  if (normName.startsWith(normQuery)) score += 1200;
  else if (normName.includes(normQuery)) score += 600;

  // Exact DNI
  if (cleanDni && queryDigits && cleanDni === queryDigits) score += 1000;
  else if (cleanDni && queryDigits && cleanDni.includes(queryDigits)) score += 400;

  return score;
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
  const activeTickets = state.reservations.filter(isValidProductionTicket);

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
  if (elCash) {
    elCash.textContent = `$${cashCollected} USD`;
    elCash.title = `Cobrado: $${cashCollected} USD • Bs. ${formatBs(cashCollected * getBcvRate())}`;
  }

  // Render recent check-ins strip
  renderRecentCheckins();

  // Render attendees list
  renderAttendeesList();

  // Refresh Taquilla prices if active
  if (typeof window.refreshExpressFormUI === "function") {
    window.refreshExpressFormUI();
  }
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

function isTicketCourtesy(r) {
  if (!r) return false;
  const pm = (r.payment_method || "").toLowerCase();
  const tn = (r.tier_name || "").toLowerCase();
  const ti = (r.tier_id || "").toLowerCase();
  return (
    ti === "courtesy" ||
    ti === "cortesia" ||
    ti === "invitado" ||
    ti === "vip" ||
    pm.includes("cortesía") ||
    pm.includes("cortesia") ||
    pm.includes("invitado") ||
    pm.includes("free") ||
    tn.includes("cortesía") ||
    tn.includes("cortesia") ||
    tn.includes("invitado") ||
    tn.includes("vip") ||
    (Number(r.total_usd) === 0 && ti !== "fake" && ti !== "deleted")
  );
}

function renderAttendeesList() {
  const container = document.getElementById("attendeesListContainer");
  if (!container) return;

  const rawSearch = (document.getElementById("attendeesListSearch")?.value || "").trim();
  const filter = state.activeFilter;
  const isSearching = rawSearch.length > 0;

  // Toggle clear button for Tab 2 search
  const attendeesClearBtn = document.getElementById("attendeesSearchClearBtn");
  if (attendeesClearBtn) {
    if (isSearching) attendeesClearBtn.classList.add("visible");
    else attendeesClearBtn.classList.remove("visible");
  }

  const filtered = state.reservations.filter(r => {
    if (!isValidProductionTicket(r)) return false;

    const checkin = getCheckinData(r);
    const isPaid = !!r.is_paid;
    const isCourtesy = isTicketCourtesy(r);
    const isDoorPay = (r.payment_method?.toLowerCase().includes("efectivo") || r.tier_id === "cash") && !isPaid;

    if (isSearching) {
      // Cuando hay búsqueda activa:
      // Si el filtro es 'all' (Todos): busca en TODO el evento (compradores + invitados VIP)
      // Si es un filtro específico, respeta ese filtro
      if (filter === "vip" && !isCourtesy) return false;
      if (filter === "inside" && !checkin.isCheckedIn) return false;
      if (filter === "pending" && checkin.isCheckedIn) return false;
      if (filter === "door_pay" && !isDoorPay) return false;
      if (filter === "paid" && !isPaid) return false;

      return matchesTicket(r, rawSearch);
    } else {
      // Sin búsqueda activa: Mantiene la lista limpia por pestañas
      if (filter === "vip") {
        if (!isCourtesy) return false;
      } else {
        if (isCourtesy) return false;
      }

      if (filter === "inside" && !checkin.isCheckedIn) return false;
      if (filter === "pending" && checkin.isCheckedIn) return false;
      if (filter === "door_pay" && !isDoorPay) return false;
      if (filter === "paid" && !isPaid) return false;

      return true;
    }
  });

  // Si hay búsqueda activa, ordenar por relevancia
  if (isSearching) {
    filtered.sort((a, b) => scoreTicketRelevance(b, rawSearch) - scoreTicketRelevance(a, rawSearch));
  }

  // Actualizar conteos numéricos de los botones de filtro (basado en lista general)
  const regularTickets = state.reservations.filter(r => isValidProductionTicket(r) && !isTicketCourtesy(r));
  const totalRegular = regularTickets.length;
  const insideRegular = regularTickets.filter(r => getCheckinData(r).isCheckedIn).length;
  const pendingRegular = totalRegular - insideRegular;
  const doorPayRegular = regularTickets.filter(r => !r.is_paid && (r.payment_method?.toLowerCase().includes("efectivo") || r.tier_id === "cash")).length;
  const paidRegular = regularTickets.filter(r => r.is_paid).length;

  const vipCount = state.reservations.filter(r => isValidProductionTicket(r) && isTicketCourtesy(r)).length;

  document.getElementById("countFilterAll").textContent = totalRegular;
  document.getElementById("countFilterInside").textContent = insideRegular;
  document.getElementById("countFilterPending").textContent = pendingRegular;
  document.getElementById("countFilterDoorPay").textContent = doorPayRegular;
  const countVipEl = document.getElementById("countFilterVip");
  if (countVipEl) countVipEl.textContent = vipCount;
  document.getElementById("countFilterPaid").textContent = paidRegular;

  if (filtered.length === 0) {
    let emptyHtml = '';
    if (isSearching) {
      const globalMatches = state.reservations.filter(r => isValidProductionTicket(r) && matchesTicket(r, rawSearch));
      if (globalMatches.length > 0) {
        emptyHtml = `
          <div class="search-empty-state">
            <div style="font-size: 2rem; margin-bottom: 0.4rem;">🔍</div>
            <p style="color: #fff; font-weight: 700; margin-bottom: 0.4rem;">
              No hay coincidencias en este filtro
            </p>
            <p style="color: var(--neon-cyan); font-size: 0.85rem; margin-bottom: 1rem;">
              ⭐ Se encontraron <strong>${globalMatches.length}</strong> boletos que coinciden en la lista completa.
            </p>
            <button type="button" class="btn-pill" onclick="switchToAllAndSearch('${escapeHtml(rawSearch)}')" style="background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff; padding: 0.6rem 1.25rem; border-radius: 9999px; font-weight: 700; cursor: pointer; border: none; box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4);">
              🌐 Ver todas las coincidencias (${globalMatches.length})
            </button>
          </div>
        `;
      } else {
        emptyHtml = `
          <div class="search-empty-state">
            <div style="font-size: 2rem; margin-bottom: 0.4rem;">🔎</div>
            <p style="color: #fff; font-weight: 700; margin-bottom: 0.3rem;">
              No se encontró ningún boleto
            </p>
            <p style="color: var(--text-subtle); font-size: 0.82rem; margin-bottom: 1rem;">
              No hay asistentes ni invitados para "<strong>${escapeHtml(rawSearch)}</strong>".
            </p>
            <button type="button" class="btn-clear-search-link" onclick="clearAttendeesSearch()">
              ✕ Limpiar búsqueda
            </button>
          </div>
        `;
      }
    } else {
      emptyHtml = `
        <div style="text-align: center; padding: 2.5rem; color: var(--text-subtle);">
          No se encontraron asistentes con el filtro actual.
        </div>
      `;
    }

    container.innerHTML = emptyHtml;
    return;
  }

  const summaryHtml = isSearching ? `
    <div class="attendees-search-summary">
      <span>🔎 Mostrando <strong>${filtered.length}</strong> coincidencia${filtered.length > 1 ? 's' : ''} para "<strong>${escapeHtml(rawSearch)}</strong>"</span>
      <button type="button" class="btn-clear-search-link" onclick="clearAttendeesSearch()">Limpiar ✕</button>
    </div>
  ` : '';

  const rowsHtml = filtered.map(r => {
    const checkin = getCheckinData(r);
    const qty = r.quantity || 1;
    const isPaid = !!r.is_paid;
    const isCourtesy = isTicketCourtesy(r);
    const isDoor = r.payment_method?.toLowerCase().includes("efectivo") || r.tier_id === "cash";

    let badgeHtml = '';
    if (checkin.isCheckedIn) {
      badgeHtml = `<span class="badge badge-in">🟢 EN SALA</span>`;
    } else if (isCourtesy) {
      badgeHtml = `<span class="badge badge-vip">⭐ INVITADO ($0)</span>`;
    } else if (isDoor && !isPaid) {
      const refBs = r.total_ref_bs ? formatBs(r.total_ref_bs) : formatBs(Number(r.total_usd) * getBcvRate());
      badgeHtml = `<span class="badge badge-pending">💵 COBRAR $${r.total_usd} (Bs. ${refBs})</span>`;
    } else if (isPaid) {
      badgeHtml = `<span class="badge badge-paid">✓ PAGADO</span>`;
    } else {
      badgeHtml = `<span class="badge badge-pending">⏳ PENDIENTE</span>`;
    }

    const displayName = isSearching ? highlightTokens(r.buyer_name, rawSearch) : escapeHtml(r.buyer_name || 'Sin nombre');
    const displayCode = isSearching ? highlightTokens(r.ticket_code, rawSearch) : escapeHtml(r.ticket_code);
    const displayDni = r.buyer_dni && r.buyer_dni !== 'N/A' ? `<span>🪪 ${isSearching ? highlightTokens(r.buyer_dni, rawSearch) : escapeHtml(r.buyer_dni)}</span>` : '';
    const displayPhone = r.buyer_phone ? `<span>📱 ${isSearching ? highlightTokens(r.buyer_phone, rawSearch) : escapeHtml(r.buyer_phone)}</span>` : '';

    return `
      <div class="attendee-row ${checkin.isCheckedIn ? 'checked-in' : ''}" onclick="openTicketById('${r.id}')">
        <div>
          <div style="font-weight: 800; color: #fff; font-size: 0.92rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <span>${displayName}</span>
            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">(${qty} ${qty > 1 ? 'entradas' : 'entrada'})</span>
          </div>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.15rem; display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
            <span style="font-family: monospace; color: var(--neon-cyan); font-weight: 700;">#${displayCode}</span>
            ${displayDni}
            ${displayPhone}
            ${isCourtesy && r.favorite_artist ? `<span style="color: #c084fc;">⭐ ${escapeHtml(r.favorite_artist)}</span>` : ''}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.45rem;">
          <button type="button" class="btn-row-qr" onclick="event.stopPropagation(); openTicketById('${r.id}');" title="Ver código QR de ${escapeHtml(r.buyer_name)}">
            <span>📱</span> <span>QR</span>
          </button>
          ${badgeHtml}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = summaryHtml + rowsHtml;
}

// ==========================================
// SEARCH & AUTOCOMPLETE LOGIC (TAB 1 & TAB 2)
// ==========================================
function initSearch() {
  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("searchClearBtn");
  const dropdown = document.getElementById("searchResultsDropdown");

  let selectedDropdownIndex = -1;

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.trim();
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

    // Keyboard navigation in search dropdown
    searchInput.addEventListener("keydown", (e) => {
      const items = dropdown?.querySelectorAll(".search-result-item");
      if (!items || items.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedDropdownIndex = Math.min(selectedDropdownIndex + 1, items.length - 1);
        updateSelectedDropdownItem(items);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedDropdownIndex = Math.max(selectedDropdownIndex - 1, 0);
        updateSelectedDropdownItem(items);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedDropdownIndex >= 0 && items[selectedDropdownIndex]) {
          items[selectedDropdownIndex].click();
        } else if (items[0]) {
          items[0].click();
        }
      } else if (e.key === "Escape") {
        dropdown?.classList.remove("visible");
      }
    });
  }

  function updateSelectedDropdownItem(items) {
    items.forEach((item, idx) => {
      if (idx === selectedDropdownIndex) {
        item.classList.add("selected");
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("selected");
      }
    });
  }

  function performSearch(query) {
    selectedDropdownIndex = -1;
    const matches = state.reservations
      .filter(r => isValidProductionTicket(r) && matchesTicket(r, query))
      .sort((a, b) => scoreTicketRelevance(b, query) - scoreTicketRelevance(a, query));

    const totalMatches = matches.length;
    const visibleMatches = matches.slice(0, 30);

    if (totalMatches === 0) {
      dropdown.innerHTML = `
        <div style="padding: 1.25rem 1rem; text-align: center; color: var(--text-subtle); font-size: 0.85rem;">
          <div style="font-size: 1.5rem; margin-bottom: 0.35rem;">🔍</div>
          No se encontró ningún boleto para "<strong>${escapeHtml(query)}</strong>"
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.35rem;">
            Verificá el número de código, nombre o cédula.
          </div>
        </div>
      `;
      dropdown.classList.add("visible");
      return;
    }

    const headerHtml = `
      <div class="search-results-header">
        <span>⚡ ${totalMatches} coincidencia${totalMatches > 1 ? 's' : ''}</span>
        <span style="font-size: 0.68rem; color: var(--text-muted); text-transform: none;">Presioná Enter para abrir</span>
      </div>
    `;

    const itemsHtml = visibleMatches.map((r, idx) => {
      const checkin = getCheckinData(r);
      const isPaid = !!r.is_paid;
      const isCourtesy = isTicketCourtesy(r);
      const isDoor = (r.payment_method?.toLowerCase().includes("efectivo") || r.tier_id === "cash") && !isPaid;
      const qty = r.quantity || 1;

      let statusBadge = '';
      if (checkin.isCheckedIn) {
        statusBadge = `<span class="res-item-badge badge-in">🟢 YA EN SALA</span>`;
      } else if (isCourtesy) {
        statusBadge = `<span class="res-item-badge badge-vip">⭐ INVITADO ($0)</span>`;
      } else if (isDoor) {
        const refBs = r.total_ref_bs ? formatBs(r.total_ref_bs) : formatBs(Number(r.total_usd) * getBcvRate());
        statusBadge = `<span class="res-item-badge badge-pending">💵 COBRAR $${r.total_usd} (Bs. ${refBs})</span>`;
      } else if (isPaid) {
        statusBadge = `<span class="res-item-badge badge-paid">✓ PAGADO</span>`;
      } else {
        statusBadge = `<span class="res-item-badge badge-pending">⏳ PENDIENTE</span>`;
      }

      const highlightedName = highlightTokens(r.buyer_name, query);
      const highlightedCode = highlightTokens(r.ticket_code, query);
      const dniText = r.buyer_dni && r.buyer_dni !== 'N/A' ? `<span>• 🪪 ${highlightTokens(r.buyer_dni, query)}</span>` : '';
      const phoneText = r.buyer_phone ? `<span>• 📱 ${highlightTokens(r.buyer_phone, query)}</span>` : '';
      const artistText = isCourtesy && r.favorite_artist ? `<span style="color: #c084fc;">• ⭐ ${escapeHtml(r.favorite_artist)}</span>` : '';

      return `
        <div class="search-result-item" data-index="${idx}" onclick="openTicketById('${r.id}'); document.getElementById('searchResultsDropdown').classList.remove('visible');">
          <div class="res-item-main">
            <div class="res-item-name-row">
              <span class="res-item-name">${highlightedName}</span>
              <span class="res-item-qty-tag">${qty} pers.</span>
            </div>
            <div class="res-item-meta">
              <span class="res-item-code">#${highlightedCode}</span>
              ${dniText}
              ${phoneText}
              ${artistText}
            </div>
          </div>
          <div>${statusBadge}</div>
        </div>
      `;
    }).join('');

    const viewAllBtnHtml = `
      <button type="button" class="search-view-all-btn" onclick="transferSearchToAttendees('${escapeHtml(query)}')">
        📋 Ver estos ${totalMatches} boletos en la Lista de Asistentes ➔
      </button>
    `;

    dropdown.innerHTML = headerHtml + itemsHtml + viewAllBtnHtml;
    dropdown.classList.add("visible");
  }

  // Close dropdown on click outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-section")) {
      dropdown?.classList.remove("visible");
    }
  });

  // Attendees list search input (Tab 2)
  const attendeesSearch = document.getElementById("attendeesListSearch");
  const attendeesClearBtn = document.getElementById("attendeesSearchClearBtn");

  attendeesSearch?.addEventListener("input", () => {
    renderAttendeesList();
  });

  attendeesClearBtn?.addEventListener("click", () => {
    if (attendeesSearch) attendeesSearch.value = "";
    attendeesClearBtn.classList.remove("visible");
    renderAttendeesList();
    attendeesSearch?.focus();
  });

  attendeesSearch?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (attendeesSearch) attendeesSearch.value = "";
      renderAttendeesList();
    }
  });
}

function transferSearchToAttendees(query) {
  const dropdown = document.getElementById("searchResultsDropdown");
  dropdown?.classList.remove("visible");

  const tabBtn = document.querySelector('[data-tab="tabAttendees"]');
  if (tabBtn) tabBtn.click();

  const attendeesSearch = document.getElementById("attendeesListSearch");
  if (attendeesSearch) {
    attendeesSearch.value = query;
    attendeesSearch.focus();
  }
  renderAttendeesList();
}

function clearAttendeesSearch() {
  const attendeesSearch = document.getElementById("attendeesListSearch");
  const attendeesClearBtn = document.getElementById("attendeesSearchClearBtn");
  if (attendeesSearch) {
    attendeesSearch.value = "";
    attendeesSearch.focus();
  }
  attendeesClearBtn?.classList.remove("visible");
  renderAttendeesList();
}

function switchToAllAndSearch(query) {
  state.activeFilter = "all";
  document.querySelectorAll(".list-filter-bar .filter-chip").forEach(c => {
    if (c.getAttribute("data-filter") === "all") c.classList.add("active");
    else c.classList.remove("active");
  });
  const attendeesSearch = document.getElementById("attendeesListSearch");
  if (attendeesSearch) {
    attendeesSearch.value = query;
  }
  renderAttendeesList();
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

  // Check regex for QLB code (e.g. QLB-26-XXXX or QLB-VIP-XXXX)
  const qlbMatch = decodedText.match(/(?:DEL_[a-z0-9]+_)?QLB-(?:\d{2}|VIP)-\d{4}/i);
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

  const ticketRefBs = ticket.total_ref_bs ? Number(ticket.total_ref_bs) : (Number(ticket.total_usd) * getBcvRate());
  if (elAmount) elAmount.textContent = `$${ticket.total_usd || 0} USD (Ref: Bs. ${formatBs(ticketRefBs)})`;
  if (elArtist) elArtist.textContent = ticket.favorite_artist || 'Sin tema especificado';

  // Render Official QR Code for this ticket
  renderTicketQrCode(ticket);

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
  } else if (isTicketCourtesy(ticket)) {
    // COURTESY / GUEST TICKET ($0 - VIP)
    banner.classList.add("status-vip");
    bannerIcon.textContent = "⭐";
    bannerTitle.textContent = `PASE INVITADO / CORTESÍA (${qty} ${qty > 1 ? 'PERSONAS' : 'PERSONA'})`;
    elPayStatus.innerHTML = `<span style="color: #d8b4fe; font-weight: 800;">⭐ Cortesía Oficial / Acceso Libre ($0 USD)</span>`;
    elTimeRow.style.display = "none";

    sounds.playSuccess();

    actionsContainer.innerHTML = `
      <button type="button" class="btn-action-vip" onclick="confirmCheckinAction(false)">
        <span>⭐ DAR ACCESO INVITADO (${qty} ${qty > 1 ? 'PERSONAS' : 'PERSONA'})</span>
      </button>
      <button type="button" class="btn-action-secondary" onclick="closeTicketModal()">
        ✕ Siguiente Entrada
      </button>
    `;
  } else if (isDoorCash && !isPaid) {
    // PENDING DOOR PAYMENT
    const refBs = ticket.total_ref_bs ? Number(ticket.total_ref_bs) : (Number(ticket.total_usd) * getBcvRate());
    banner.classList.add("status-warn");
    bannerIcon.textContent = "💵";
    bannerTitle.textContent = `PAGO EN PUERTA: COBRAR $${ticket.total_usd} USD (Bs. ${formatBs(refBs)})`;
    elPayStatus.innerHTML = `<span style="color: var(--neon-yellow); font-weight: 800;">PENDIENTE DE COBRO EN PUERTA ($${ticket.total_usd} USD • Bs. ${formatBs(refBs)})</span>`;
    elTimeRow.style.display = "none";

    sounds.playCash();

    actionsContainer.innerHTML = `
      <button type="button" class="btn-action-cash" onclick="confirmCheckinAction(true)">
        <span>💵 REGISTRAR PAGO $${ticket.total_usd} USD (Bs. ${formatBs(refBs)}) Y DAR ACCESO</span>
      </button>
      <button type="button" class="btn-action-vip" style="padding: 0.75rem; font-size: 0.88rem;" onclick="confirmCheckinAction(false)">
        <span>⭐ EXONERAR / INGRESAR COMO CORTESÍA ($0)</span>
      </button>
      <button type="button" class="btn-action-secondary" onclick="closeTicketModal()">
        ✕ Cancelar / Siguiente
      </button>
    `;
  } else if (!isPaid) {
    // UNCONFIRMED WIRE TRANSFER
    const refBs = ticket.total_ref_bs ? Number(ticket.total_ref_bs) : (Number(ticket.total_usd) * getBcvRate());
    banner.classList.add("status-warn");
    bannerIcon.textContent = "⏳";
    bannerTitle.textContent = "TRANSFERENCIA PENDIENTE POR VALIDAR";
    elPayStatus.innerHTML = `<span style="color: var(--neon-yellow); font-weight: 800;">Comprobante no confirmado ($${ticket.total_usd} USD • Bs. ${formatBs(refBs)})</span>`;
    elTimeRow.style.display = "none";

    sounds.playWarning();

    actionsContainer.innerHTML = `
      <button type="button" class="btn-action-primary" onclick="confirmCheckinAction(true)">
        <span>✅ VALIDAR PAGO $${ticket.total_usd} USD (Bs. ${formatBs(refBs)}) Y DAR ACCESO (${qty}p)</span>
      </button>
      <button type="button" class="btn-action-vip" style="padding: 0.75rem; font-size: 0.88rem;" onclick="confirmCheckinAction(false)">
        <span>⭐ EXONERAR / INGRESAR COMO CORTESÍA ($0)</span>
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

/**
 * Generates and displays the QR code for a ticket using QRious
 */
function renderTicketQrCode(ticket) {
  const canvas = document.getElementById("modalQrCanvas");
  const codeBadge = document.getElementById("modalQrBadgeTxt");
  if (!canvas || !ticket) return;

  const code = ticket.ticket_code || "";
  if (codeBadge) codeBadge.textContent = `#${code}`;

  try {
    if (typeof QRious !== "undefined") {
      new QRious({
        element: canvas,
        value: code,
        size: 180,
        level: "H",
        background: "#ffffff",
        foreground: "#000000"
      });
    }
  } catch (err) {
    console.warn("Error generando QR:", err);
  }
}

/**
 * Opens fullscreen high-contrast QR lightbox
 */
function openFullscreenQr(ticket) {
  const currentTicket = ticket || state.currentModalTicket;
  if (!currentTicket) return;

  const overlay = document.getElementById("qrFullscreenOverlay");
  const canvas = document.getElementById("qrFullscreenCanvas");
  const nameEl = document.getElementById("qrFullscreenName");
  const codeEl = document.getElementById("qrFullscreenCode");
  const qtyEl = document.getElementById("qrFullscreenQty");
  const badgeEl = document.getElementById("qrFullscreenBadge");

  if (nameEl) nameEl.textContent = currentTicket.buyer_name || "Sin Nombre";
  if (codeEl) codeEl.textContent = `#${currentTicket.ticket_code}`;
  const qty = Number(currentTicket.quantity) || 1;
  if (qtyEl) qtyEl.textContent = `${qty} ${qty > 1 ? 'PERSONAS' : 'PERSONA'}`;

  const isCourtesy = isTicketCourtesy(currentTicket);
  const isPaid = !!currentTicket.is_paid;
  if (badgeEl) {
    if (isCourtesy) {
      badgeEl.className = "badge badge-vip";
      badgeEl.textContent = "⭐ INVITADO ($0)";
    } else if (isPaid) {
      badgeEl.className = "badge badge-paid";
      badgeEl.textContent = "✓ PAGADO";
    } else {
      badgeEl.className = "badge badge-pending";
      badgeEl.textContent = "💵 COBRAR EN PUERTA";
    }
  }

  try {
    if (typeof QRious !== "undefined" && canvas) {
      new QRious({
        element: canvas,
        value: currentTicket.ticket_code,
        size: 260,
        level: "H",
        background: "#ffffff",
        foreground: "#000000"
      });
    }
  } catch (e) {
    console.warn("Fullscreen QRious error:", e);
  }

  overlay?.classList.remove("hidden");
}

function closeFullscreenQr() {
  document.getElementById("qrFullscreenOverlay")?.classList.add("hidden");
}

function copyTicketCodeToClipboard(code) {
  const targetCode = code || state.currentModalTicket?.ticket_code;
  if (!targetCode) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(targetCode).then(() => {
      showToast(`Código #${targetCode} copiado al portapapeles`, "success");
      const copyTxt = document.getElementById("btnCopyTicketCodeTxt");
      if (copyTxt) {
        copyTxt.textContent = "¡Copiado! ✓";
        setTimeout(() => { copyTxt.textContent = "Copiar Código"; }, 2000);
      }
    }).catch(() => {
      showToast(`Código: #${targetCode}`, "info");
    });
  } else {
    showToast(`Código: #${targetCode}`, "info");
  }
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

  const qtySelect = document.getElementById("expressQty");
  const paymentSelect = document.getElementById("expressPayment");
  const submitBtn = form.querySelector("button[type='submit']");

  function refreshFormUI() {
    const isVIP = paymentSelect?.value.includes("Cortesía") || paymentSelect?.value.includes("Invitado");
    const qty = parseInt(qtySelect?.value) || 1;
    const currentSelected = qtySelect?.value || "1";
    const rate = getBcvRate();

    if (qtySelect) {
      qtySelect.innerHTML = Array.from({ length: 10 }, (_, i) => {
        const n = i + 1;
        const pLabel = n === 1 ? "1 Persona" : `${n} Personas`;
        const usdVal = n * CONFIG.TICKET_PRICE_USD;
        const bsVal = usdVal * rate;
        const costLabel = isVIP ? "(Cortesía $0 • Bs. 0)" : `($${usdVal} USD • Bs. ${formatBs(bsVal)})`;
        return `<option value="${n}">${pLabel} ${costLabel}</option>`;
      }).join("");
      qtySelect.value = currentSelected;
    }

    const infoPriceEl = document.getElementById("infoTicketPriceBcv");
    if (infoPriceEl) {
      infoPriceEl.innerHTML = `💵 <strong>Precio en Puerta:</strong> $15 USD • Bs. ${formatBs(15 * rate)} (Tasa BCV oficial)`;
    }

    if (submitBtn) {
      if (isVIP) {
        submitBtn.className = "btn-action-vip";
        const personText = qty === 1 ? "INVITADO" : `${qty} INVITADOS`;
        submitBtn.innerHTML = `<span>⭐ REGISTRAR ${personText} Y DAR ACCESO ($0 / Bs. 0)</span>`;
      } else {
        submitBtn.className = "btn-action-primary";
        const total = qty * CONFIG.TICKET_PRICE_USD;
        const totalBs = total * rate;
        submitBtn.innerHTML = `<span>⚡ COBRAR $${total} USD (Bs. ${formatBs(totalBs)}) Y DAR ACCESO (${qty}p)</span>`;
      }
    }
  }

  window.refreshExpressFormUI = refreshFormUI;
  refreshFormUI();

  paymentSelect?.addEventListener("change", refreshFormUI);
  qtySelect?.addEventListener("change", refreshFormUI);

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

    const isVIP = payment.includes("Cortesía") || payment.includes("Invitado");
    const rate = getBcvRate();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const code = `QLB-26-${randomNum}`;
    const totalUSD = isVIP ? 0 : (qty * CONFIG.TICKET_PRICE_USD);
    const totalRefBs = isVIP ? 0 : Number((totalUSD * rate).toFixed(2));
    const nowISO = new Date().toISOString();

    const newTicket = {
      ticket_code: code,
      buyer_name: name,
      buyer_dni: dni,
      buyer_phone: phone || "No suministrado",
      buyer_email: "puerta@elquilombo.club",
      tier_id: isVIP ? "courtesy" : "general",
      tier_name: isVIP ? "Pase Invitado / Cortesía Oficial" : "Pase General Oficial (Puerta)",
      quantity: qty,
      total_usd: totalUSD,
      total_ref_bs: totalRefBs,
      payment_method: payment,
      favorite_artist: isVIP ? "Invitado VIP" : "Rock & Riff Live",
      meme_sticker_used: `meme-quilombo|CHECKED_IN:${nowISO}:Taquilla`,
      is_paid: true,
      referral_source: isVIP ? "Lista de Invitados Puerta" : "Taquilla Puerta",
      created_at: nowISO
    };

    if (isVIP) {
      sounds.playSuccess();
      showToast(`Registrando acceso de invitado #${code} ($0 USD)...`, "info");
    } else {
      sounds.playCash();
      showToast(`Registrando venta de #${code} ($${totalUSD} USD • Bs. ${formatBs(totalRefBs)})...`, "info");
    }

    // Add to in-memory immediately
    state.reservations.unshift(newTicket);
    markCheckin(newTicket, true);

    // Reset form and refresh UI
    form.reset();
    refreshFormUI();

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
        showToast(isVIP ? `¡Pase de invitado #${code} emitido con éxito!` : `¡Venta e ingreso de #${code} registrado exitosamente!`, "success");
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
    try {
      localStorage.removeItem("quilombo_cached_reservations");
      localStorage.removeItem("quilombo_simulated_tickets");
      state.reservations = state.reservations.filter(isValidProductionTicket);
      updateMetricsAndUI();
    } catch (e) {}
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
    if (e.key === "Escape") {
      const qrOverlay = document.getElementById("qrFullscreenOverlay");
      if (qrOverlay && !qrOverlay.classList.contains("hidden")) {
        closeFullscreenQr();
      } else {
        closeTicketModal();
      }
    }
  });

  // QR Visualizer & Fullscreen Lightbox interactions
  document.getElementById("modalQrCard")?.addEventListener("click", () => openFullscreenQr());
  document.getElementById("btnZoomQrModal")?.addEventListener("click", () => openFullscreenQr());
  document.getElementById("btnCopyTicketCode")?.addEventListener("click", () => copyTicketCodeToClipboard());
  document.getElementById("btnQrFullscreenClose")?.addEventListener("click", closeFullscreenQr);
  document.getElementById("btnQrFullscreenDismiss")?.addEventListener("click", closeFullscreenQr);

  const qrFullscreenOverlay = document.getElementById("qrFullscreenOverlay");
  qrFullscreenOverlay?.addEventListener("click", (e) => {
    if (e.target === qrFullscreenOverlay) closeFullscreenQr();
  });

  // Export / Print guests list
  document.getElementById("btnExportGuestsPdf")?.addEventListener("click", () => {
    sounds.playSuccess();
    exportGuestsPdf();
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

/**
 * Generates and triggers high-contrast printable sheet / PDF of all official guests
 * with individual physical checkboxes, guest count, and note lines.
 */
function exportGuestsPdf() {
  const guests = state.reservations
    .filter(r => isValidProductionTicket(r) && isTicketCourtesy(r))
    .sort((a, b) => (a.buyer_name || "").localeCompare(b.buyer_name || "", "es", { sensitivity: "base" }));

  if (guests.length === 0) {
    showToast("No se encontraron invitados registrados para exportar.", "warning");
    return;
  }

  const totalTickets = guests.length;
  const totalHeadcount = guests.reduce((sum, g) => sum + (Number(g.quantity) || 1), 0);
  const insideHeadcount = guests.filter(g => getCheckinData(g).isCheckedIn).reduce((sum, g) => sum + (Number(g.quantity) || 1), 0);
  const pendingHeadcount = totalHeadcount - insideHeadcount;

  const now = new Date();
  const dateStr = now.toLocaleDateString("es-VE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const timeStr = now.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const rowsHtml = guests.map((g, idx) => {
    const qty = Number(g.quantity) || 1;
    const checkin = getCheckinData(g);
    const phone = g.buyer_phone && g.buyer_phone !== "No suministrado" ? g.buyer_phone : "";
    const dni = g.buyer_dni && !g.buyer_dni.startsWith("VIP-") ? g.buyer_dni : "";
    const contactInfo = [dni, phone].filter(Boolean).join(" • ") || "-";
    
    const role = g.favorite_artist && g.favorite_artist !== "Invitado Especial" 
      ? g.favorite_artist 
      : (g.tier_name || "Invitado Oficial");

    const alreadyIn = checkin.isCheckedIn;

    // Split main name and companions if formatted with parentheses
    let mainName = g.buyer_name || "Sin nombre";
    let companionsNote = "";
    if (mainName.includes("(")) {
      const parts = mainName.split("(");
      mainName = parts[0].trim();
      companionsNote = parts.slice(1).join("(").replace(/\)$/, "").trim();
    }

    // Generate individual checkboxes for each invited person in this ticket
    let checkBoxesHtml = '<div class="checks-grid">';
    for (let c = 1; c <= qty; c++) {
      checkBoxesHtml += `
        <div class="chk-item" title="Invitado ${c} de ${qty}">
          <div class="chk-box" onclick="this.textContent = (this.textContent === '✓' ? '' : '✓')">${alreadyIn ? '✓' : ''}</div>
          ${qty > 1 ? `<span class="chk-num">${c}</span>` : ''}
        </div>
      `;
    }
    checkBoxesHtml += '</div>';

    return `
      <tr class="${alreadyIn ? 'row-in' : 'row-pending'}" data-status="${alreadyIn ? 'in' : 'pending'}">
        <td class="col-check">
          ${checkBoxesHtml}
        </td>
        <td class="col-num">${idx + 1}</td>
        <td class="col-name">
          <div class="guest-title">${escapeHtml(mainName)}</div>
          ${companionsNote ? `<div class="guest-companions">👥 ${escapeHtml(companionsNote)}</div>` : ''}
          ${g.referral_source && g.referral_source !== 'Lista Oficial Invitados' ? `<div class="guest-ref">${escapeHtml(g.referral_source)}</div>` : ''}
        </td>
        <td class="col-qty">
          <span class="qty-pill ${qty > 1 ? 'qty-group' : ''}">${qty} ${qty > 1 ? 'PERS.' : 'PASE'}</span>
        </td>
        <td class="col-code">
          <code>#${escapeHtml(g.ticket_code)}</code>
        </td>
        <td class="col-role">${escapeHtml(role)}</td>
        <td class="col-contact">${escapeHtml(contactInfo)}</td>
        <td class="col-sign">
          ${alreadyIn ? `<span class="time-stamp">En sala (${checkin.time ? checkin.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''})</span>` : '<span class="sign-blank"></span>'}
        </td>
      </tr>
    `;
  }).join('');

  const docHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Lista_Invitados_El_Quilombo_${now.toISOString().slice(0, 10)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 8mm 10mm 8mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      padding: 16px;
      font-size: 11px;
      line-height: 1.3;
    }

    /* Floating control bar (hidden when printing) */
    .no-print-toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: #09061a;
      color: #fff;
      padding: 12px 20px;
      border-radius: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .toolbar-title {
      font-size: 14px;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn-action-print {
      background: #22c55e;
      color: #052e16;
      font-weight: 800;
      border: none;
      padding: 9px 18px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
      transition: transform 0.1s ease;
    }
    .btn-action-print:hover {
      background: #16a34a;
      color: #fff;
      transform: translateY(-1px);
    }
    .btn-action-close {
      background: #334155;
      color: #f1f5f9;
      border: none;
      padding: 9px 15px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    }
    .filter-select {
      background: #1e1b4b;
      color: #fff;
      border: 1px solid #4338ca;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      cursor: pointer;
    }

    /* Main printable paper container */
    .paper-sheet {
      background: #fff;
      max-width: 1060px;
      margin: 0 auto;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }

    /* Sheet Header */
    .sheet-header {
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .event-title {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #0f172a;
      text-transform: uppercase;
    }
    .event-subtitle {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      margin-top: 2px;
    }
    .stats-ribbon {
      display: flex;
      gap: 8px;
    }
    .stat-pill {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      padding: 5px 12px;
      border-radius: 6px;
      text-align: center;
      min-width: 75px;
    }
    .stat-pill .num {
      font-size: 15px;
      font-weight: 900;
      color: #0f172a;
    }
    .stat-pill .tag {
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
    }

    .instructions-strip {
      background: #f8fafc;
      border-left: 3.5px solid #0ea5e9;
      padding: 6px 10px;
      font-size: 9.5px;
      color: #334155;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Table */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    thead {
      display: table-header-group;
    }
    th {
      background-color: #0f172a !important;
      color: #fff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      padding: 6px 5px;
      font-weight: 800;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border: 1px solid #0f172a;
      text-align: left;
    }
    td {
      border: 1px solid #cbd5e1;
      padding: 4.5px 5px;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    tr {
      page-break-inside: avoid;
    }

    .col-check { width: 34px; text-align: center; }
    .col-num { width: 28px; text-align: center; color: #64748b; font-weight: 600; font-size: 9.5px; }
    .col-name { font-size: 10.5px; }
    .guest-title { font-weight: 800; color: #0f172a; }
    .guest-companions { font-size: 9px; color: #475569; font-style: italic; margin-top: 1px; }
    .guest-ref { font-size: 8.5px; color: #94a3b8; }
    
    .col-qty { width: 62px; text-align: center; }
    .qty-pill {
      display: inline-block;
      padding: 2px 5px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 9.5px;
      background: #e2e8f0;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .qty-group {
      background: #fef08a;
      color: #854d0e;
      border: 1px solid #eab308;
    }

    .col-code { width: 88px; text-align: center; }
    .col-code code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-weight: 700;
      color: #0369a1;
      font-size: 9.5px;
    }

    .col-role { width: 130px; font-size: 9px; color: #334155; }
    .col-contact { width: 105px; font-size: 9px; color: #475569; }
    .col-sign { width: 95px; text-align: center; }

    .checks-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
      align-items: center;
      justify-content: center;
      max-width: 140px;
      margin: 0 auto;
    }
    .chk-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
    }
    .chk-box {
      width: 18px;
      height: 18px;
      border: 1.8px solid #0f172a;
      border-radius: 3px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 12px;
      color: #16a34a;
      background: #fff;
      cursor: pointer;
      user-select: none;
    }
    .chk-box:hover {
      border-color: #3b82f6;
    }
    .chk-num {
      font-size: 8px;
      font-weight: 700;
      color: #64748b;
      line-height: 1;
    }
    .col-check { 
      min-width: 60px; 
      max-width: 145px; 
      text-align: center; 
      padding: 4px 5px; 
    }
    .sign-blank {
      display: block;
      border-bottom: 1px dashed #94a3b8;
      width: 85%;
      height: 10px;
      margin: 0 auto;
    }
    .time-stamp {
      font-size: 8.5px;
      font-weight: 700;
      color: #16a34a;
    }

    .sheet-footer {
      margin-top: 14px;
      border-top: 1px solid #cbd5e1;
      padding-top: 6px;
      display: flex;
      justify-content: space-between;
      color: #94a3b8;
      font-size: 8.5px;
    }

    /* Print media styling */
    @media print {
      body {
        background: #fff !important;
        padding: 0 !important;
      }
      .no-print-toolbar {
        display: none !important;
      }
      .paper-sheet {
        box-shadow: none !important;
        padding: 0 !important;
        max-width: 100% !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-toolbar">
    <div class="toolbar-title">
      <span>🖨️</span>
      <span>Lista Oficial de Invitados • El Quilombo (Rock &amp; Riff)</span>
    </div>
    <div class="toolbar-actions">
      <select id="filterMode" class="filter-select" onchange="applyFilter(this.value)">
        <option value="all">Ver Todos (${totalTickets} pases • ${totalHeadcount} pers.)</option>
        <option value="pending">Solo Faltan por Ingresar (${pendingHeadcount} pers.)</option>
        <option value="in">Solo en Sala (${insideHeadcount} pers.)</option>
      </select>
      <button type="button" class="btn-action-print" onclick="window.print()">
        <span>🖨️</span>
        <span>IMPRIMIR / PDF</span>
      </button>
      <button type="button" class="btn-action-close" onclick="window.close()">✕ Cerrar</button>
    </div>
  </div>

  <div class="paper-sheet">
    <header class="sheet-header">
      <div>
        <div class="event-title">EL QUILOMBO • ROCK &amp; RIFF</div>
        <div class="event-subtitle">Lista Oficial de Invitados &amp; Pases de Cortesía • Viernes 09 de Octubre 2026 (Valencia)</div>
      </div>
      <div class="stats-ribbon">
        <div class="stat-pill">
          <div class="num" id="statPases">${totalTickets}</div>
          <div class="tag">Pases VIP</div>
        </div>
        <div class="stat-pill">
          <div class="num" id="statPersonas">${totalHeadcount}</div>
          <div class="tag">Personas Total</div>
        </div>
      </div>
    </header>

    <div class="instructions-strip">
      <span>📋 <strong>Control en Puerta:</strong> Cada invitado asignado tiene su casilla individual [ ✓ ] para marcar con bolígrafo al ingresar.</span>
      <span>Generado: ${dateStr} • ${timeStr}</span>
    </div>

    <table>
      <thead>
        <tr>
          <th class="col-check">CHECKS (${totalHeadcount} ENTRADAS)</th>
          <th class="col-num">#</th>
          <th>INVITADO / TITULAR</th>
          <th class="col-qty">ENTRADAS</th>
          <th class="col-code">CÓDIGO</th>
          <th>ROL / DETALLE</th>
          <th>DNI / CONTACTO</th>
          <th class="col-sign">FIRMA / HORA</th>
        </tr>
      </thead>
      <tbody id="guestsTableBody">
        ${rowsHtml}
      </tbody>
    </table>

    <footer class="sheet-footer">
      <span>El Quilombo • Control de Acceso &amp; Escáner QR • Rock &amp; Riff Live</span>
      <span>Documento Oficial de Staff • Organizado Alfabéticamente</span>
    </footer>
  </div>

  <script>
    function applyFilter(mode) {
      const rows = document.querySelectorAll('#guestsTableBody tr');
      let visibleTickets = 0;
      rows.forEach(r => {
        const status = r.dataset.status;
        if (mode === 'all') {
          r.style.display = '';
          visibleTickets++;
        } else if (mode === 'pending' && status === 'pending') {
          r.style.display = '';
          visibleTickets++;
        } else if (mode === 'in' && status === 'in') {
          r.style.display = '';
          visibleTickets++;
        } else {
          r.style.display = 'none';
        }
      });
      document.getElementById('statPases').textContent = visibleTickets;
    }

    // Auto-trigger print prompt shortly after loading
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 400);
    });
  </script>
</body>
</html>`;

  // Dual popup / iframe trigger
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(docHtml);
    printWindow.document.close();
  } else {
    // Fallback if popup blocked
    let printFrame = document.getElementById("printFrame");
    if (!printFrame) {
      printFrame = document.createElement("iframe");
      printFrame.id = "printFrame";
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "0";
      document.body.appendChild(printFrame);
    }
    printFrame.contentDocument.open();
    printFrame.contentDocument.write(docHtml);
    printFrame.contentDocument.close();
    showToast("Generando hoja de impresión en segundo plano...", "info");
    setTimeout(() => {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
    }, 600);
  }
}

window.exportGuestsPdf = exportGuestsPdf;


// ==========================================
// APP BOOTSTRAP
// ==========================================
function bootstrapApp() {
  // Purge any lingering simulated/test tickets from browser localStorage
  try {
    localStorage.removeItem("quilombo_simulated_tickets");
    const cached = localStorage.getItem("quilombo_cached_reservations");
    if (cached) {
      const cleaned = JSON.parse(cached).filter(isValidProductionTicket);
      localStorage.setItem("quilombo_cached_reservations", JSON.stringify(cleaned));
    }
    const localCheckins = JSON.parse(localStorage.getItem("quilombo_local_checkins") || "{}");
    let modified = false;
    for (const k of Object.keys(localCheckins)) {
      if (k.startsWith("sim-") || k.includes("FAKE") || k.includes("SIM") || k === "sim-6" || k.includes("QLB-26-VIP")) {
        delete localCheckins[k];
        modified = true;
      }
    }
    if (modified) {
      localStorage.setItem("quilombo_local_checkins", JSON.stringify(localCheckins));
    }
  } catch (e) {}

  initNavigation();
  initSearch();
  initQrScanner();
  initExpressCheckin();
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
