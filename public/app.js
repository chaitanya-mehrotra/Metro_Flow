/* ═══════════════════════════════════════════════════════════
   Namma Boarding Assistant – Frontend Logic
   ═══════════════════════════════════════════════════════════ */

// Use current host if running on web server, or localhost fallback
const API_BASE = (window.location.protocol.startsWith("http")) ? "" : "http://127.0.0.1:5000";

// ── DOM References ────────────────────────────────────────
const originInput  = document.getElementById("origin-select");
const destInput    = document.getElementById("dest-select");
const daySel       = document.getElementById("day-select");
const timeInput    = document.getElementById("time-input");
const form         = document.getElementById("predict-form");
const formError    = document.getElementById("form-error");
const analyzeBtn   = document.getElementById("analyze-btn");
const btnText      = analyzeBtn.querySelector(".btn-text");
const btnLoader    = analyzeBtn.querySelector(".btn-loader");
const resultsArea  = document.getElementById("results-area");

// Results
const metricValue     = document.getElementById("metric-value");
const metricSub       = document.getElementById("metric-sub");
const statusBanner    = document.getElementById("status-banner");
const statusIcon      = document.getElementById("status-icon");
const statusTitle     = document.getElementById("status-title");
const statusDesc      = document.getElementById("status-desc");
const recBody         = document.getElementById("recommendation-body");
const chartContainer  = document.getElementById("chart-container");

// ── Station data store ────────────────────────────────────
let stationList = []; // [{ code, name }, ...]

// ══════════════════════════════════════════════════════════
// Custom Searchable Dropdown Component
// ══════════════════════════════════════════════════════════

class SearchableDropdown {
  constructor(containerId, hiddenInputId, triggerId, panelId, searchId, optionsId) {
    this.container   = document.getElementById(containerId);
    this.hiddenInput = document.getElementById(hiddenInputId);
    this.trigger     = document.getElementById(triggerId);
    this.panel       = document.getElementById(panelId);
    this.searchInput = document.getElementById(searchId);
    this.optionsList = document.getElementById(optionsId);

    this.items = [];       // [{ code, name }]
    this.selectedCode = "";
    this.isOpen = false;

    this._bindEvents();
  }

  populate(items) {
    this.items = items;
    this._renderOptions("");
  }

  _bindEvents() {
    // Toggle open/close
    this.trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.isOpen) this.close(); else this.open();
    });

    // Search filtering
    this.searchInput.addEventListener("input", () => {
      this._renderOptions(this.searchInput.value.trim().toLowerCase());
    });

    // Prevent panel click from closing
    this.panel.addEventListener("click", (e) => e.stopPropagation());

    // Close on outside click
    document.addEventListener("click", () => this.close());

    // Keyboard navigation
    this.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.close();
      if (e.key === "Enter") {
        e.preventDefault();
        const first = this.optionsList.querySelector(".option-item");
        if (first) first.click();
      }
    });
  }

  open() {
    this.isOpen = true;
    this.container.classList.add("open");
    this.searchInput.value = "";
    this._renderOptions("");
    setTimeout(() => this.searchInput.focus(), 50);
  }

  close() {
    this.isOpen = false;
    this.container.classList.remove("open");
  }

  select(code, name) {
    this.selectedCode = code;
    this.hiddenInput.value = code;
    this.trigger.querySelector(".trigger-text").textContent = name;
    this.trigger.classList.add("has-value");
    this.close();
    // Re-render to show selected state if opened again
  }

  _renderOptions(query) {
    const filtered = query
      ? this.items.filter(s =>
          s.name.toLowerCase().includes(query) ||
          s.code.toLowerCase().includes(query)
        )
      : this.items;

    if (filtered.length === 0) {
      this.optionsList.innerHTML = `<li class="no-results">No stations found</li>`;
      return;
    }

    this.optionsList.innerHTML = filtered.map(s => {
      const isSelected = s.code === this.selectedCode;
      return `<li class="option-item${isSelected ? " selected" : ""}" data-code="${s.code}" data-name="${s.name}">
        <span class="station-code">${s.code}</span>
        <span>${s.name}</span>
      </li>`;
    }).join("");

    // Attach click handlers
    this.optionsList.querySelectorAll(".option-item").forEach(li => {
      li.addEventListener("click", () => {
        this.select(li.dataset.code, li.dataset.name);
      });
    });
  }
}

// Initialize the two custom station dropdowns
const originDropdown = new SearchableDropdown(
  "origin-dropdown", "origin-select", "origin-trigger",
  "origin-panel", "origin-search", "origin-options"
);
const destDropdown = new SearchableDropdown(
  "dest-dropdown", "dest-select", "dest-trigger",
  "dest-panel", "dest-search", "dest-options"
);

// ══════════════════════════════════════════════════════════
// Day Chip Selector (simple inline buttons – no dropdown)
// ══════════════════════════════════════════════════════════

(function initDayChips() {
  const dayInput = document.getElementById("day-select");
  const chips = document.querySelectorAll("#day-grid .day-chip");

  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      chips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      dayInput.value = chip.dataset.value;
    });
  });
})();

// ── Helpers ───────────────────────────────────────────────

/** Convert fractional hours to HH:MM string */
function fracToHHMM(frac) {
  frac = ((frac % 24) + 24) % 24; // wrap around
  const h = Math.floor(frac);
  let m = Math.round((frac - h) * 60);
  if (m === 60) { return `${String((h + 1) % 24).padStart(2, "0")}:00`; }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Classify crowd ratio into category */
function classify(ratio) {
  if (ratio <= 0.85) return "low";
  if (ratio <= 1.20) return "moderate";
  return "heavy";
}

const STATUS_MAP = {
  low:      { icon: "🟢", title: "Low Crowding",            desc: "The metro is expected to be comfortable with ample seating available." },
  moderate: { icon: "🟡", title: "Moderate Rush",           desc: "Standard peak commute — expect standing passengers in some coaches." },
  heavy:    { icon: "🔴", title: "Heavy Peak Congestion",   desc: "High crowd density — consider alternate timing for a safer, comfortable ride." },
};

/** Show an error below the form */
function showError(msg) {
  formError.textContent = msg;
  formError.hidden = false;
  setTimeout(() => { formError.hidden = true; }, 5000);
}

/** Set loading state on button */
function setLoading(on) {
  analyzeBtn.disabled = on;
  btnText.style.display = on ? "none" : "inline";
  btnLoader.style.display = on ? "inline-flex" : "none";
}

// ── Populate Station Dropdowns ────────────────────────────
async function loadStations() {
  try {
    const res = await fetch(`${API_BASE}/api/stations`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    stationList = await res.json(); // [{ code, name }, ...]

    originDropdown.populate(stationList);
    destDropdown.populate(stationList);
  } catch (err) {
    console.error("Failed to load stations:", err);
    showError("Could not connect to the backend API. Make sure server.py is running.");
  }
}

// ── Single Prediction Request ─────────────────────────────
async function fetchPrediction(origin, destination, day, fracTime) {
  const res = await fetch(`${API_BASE}/api/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin, destination, day, time: fracTime }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.ratio;
}

// ── Render Results ────────────────────────────────────────

function renderMetric(ratio) {
  const cat = classify(ratio);
  metricValue.textContent = `${ratio.toFixed(3)}x`;
  metricSub.textContent =
    cat === "low"      ? "Below average crowding" :
    cat === "moderate" ? "Approaching peak density" :
                         "Exceeds comfortable capacity";

  // Colour the metric
  const colorMap = { low: "#22c55e", moderate: "#f59e0b", heavy: "#ef4444" };
  metricValue.style.background = `linear-gradient(135deg, ${colorMap[cat]}, ${colorMap[cat]}cc)`;
  metricValue.style.webkitBackgroundClip = "text";
  metricValue.style.webkitTextFillColor = "transparent";
}

function renderStatus(ratio) {
  const cat = classify(ratio);
  const info = STATUS_MAP[cat];

  statusBanner.className = `glass-card status-banner status-${cat}`;
  statusIcon.textContent = info.icon;
  statusTitle.textContent = info.title;
  statusDesc.textContent = info.desc;
}

function renderRecommendation(targetRatio, earlierRatio, laterRatio, targetTime, earlierTime, laterTime) {
  const minVal = Math.min(earlierRatio, targetRatio, laterRatio);

  let html = "";

  if (targetRatio <= minVal) {
    // Target is the best
    html = `<div class="rec-success">
      ✅ <strong>Your intended time (${fracToHHMM(targetTime)}) is the best choice!</strong><br/>
      Adjacent slots show a higher crowd density projection.
    </div>`;
  } else {
    // Find which alt is better
    const bestIsEarlier = earlierRatio < laterRatio;
    const bestRatio = bestIsEarlier ? earlierRatio : laterRatio;
    const bestTimeVal = bestIsEarlier ? earlierTime : laterTime;
    const shiftLabel = bestIsEarlier ? "earlier" : "later";
    const savings = targetRatio - bestRatio;

    if (savings >= 0.01) {
      html = `<div class="rec-warn">
        ⚠️ <strong>Alternate Slot Advised:</strong> Traveling at <strong>${fracToHHMM(bestTimeVal)}</strong>
        (15 minutes ${shiftLabel}) is better.<br/>
        It cuts down crowding density by an additional <strong>${savings.toFixed(3)}x</strong>.
      </div>`;
    } else {
      html = `<div class="rec-neutral">
        ✅ <strong>Your intended time (${fracToHHMM(targetTime)}) is perfectly fine.</strong><br/>
        Any adjacent shifts offer no noticeable difference in comfort.
      </div>`;
    }
  }

  recBody.innerHTML = html;
}

function renderChart(earlierRatio, targetRatio, laterRatio, earlierTime, targetTime, laterTime) {
  const maxRatio = Math.max(earlierRatio, targetRatio, laterRatio, 0.01);
  const minRatio = Math.min(earlierRatio, targetRatio, laterRatio);
  // Scale bar width: map ratio to 10%-100% visual range
  const barPct = (r) => Math.max(10, (r / (maxRatio * 1.15)) * 100);

  const rows = [
    { label: fracToHHMM(earlierTime), tag: "−15 min",    ratio: earlierRatio, time: earlierTime },
    { label: fracToHHMM(targetTime),  tag: "Your Time",  ratio: targetRatio,  time: targetTime },
    { label: fracToHHMM(laterTime),   tag: "+15 min",    ratio: laterRatio,   time: laterTime },
  ];

  let html = "";
  rows.forEach((r) => {
    const cat = classify(r.ratio);
    const isBest = r.ratio <= minRatio;
    const bestBadge = isBest ? `<span class="best-badge">Best</span>` : "";

    html += `
      <div class="slot-row${isBest ? " best-slot" : ""}">
        <div class="slot-label">
          ${r.label}${bestBadge}
          <span class="slot-tag">${r.tag}</span>
        </div>
        <div class="slot-bar-bg">
          <div class="slot-bar-fill bar-${cat}" style="width: 0%;" data-target-width="${barPct(r.ratio)}%"></div>
        </div>
        <div class="slot-value" style="color: var(--${{ low: "green", moderate: "amber", heavy: "red" }[cat]})">${r.ratio.toFixed(3)}x</div>
      </div>`;
  });

  chartContainer.innerHTML = html;

  // Animate bars after render
  requestAnimationFrame(() => {
    chartContainer.querySelectorAll(".slot-bar-fill").forEach((bar) => {
      bar.style.width = bar.dataset.targetWidth;
    });
  });
}

// ── Form Submission ───────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.hidden = true;

  const origin      = originInput.value;
  const destination  = destInput.value;
  const day          = daySel.value;
  const timeVal      = timeInput.value; // "HH:MM"

  // Validation
  if (!origin || !destination || !day || !timeVal) {
    return showError("Please fill in all fields.");
  }
  if (origin === destination) {
    return showError("Origin and Destination cannot be the same station.");
  }

  // Parse time → fractional hour
  const [hh, mm] = timeVal.split(":").map(Number);
  const targetTime  = hh + mm / 60;
  const earlierTime = targetTime - 0.25;
  const laterTime   = targetTime + 0.25;

  setLoading(true);

  try {
    // 3-point sliding window – parallel fetch
    const [earlierRatio, targetRatio, laterRatio] = await Promise.all([
      fetchPrediction(origin, destination, day, earlierTime),
      fetchPrediction(origin, destination, day, targetTime),
      fetchPrediction(origin, destination, day, laterTime),
    ]);

    // Render all result sections
    renderMetric(targetRatio);
    renderStatus(targetRatio);
    renderRecommendation(targetRatio, earlierRatio, laterRatio, targetTime, earlierTime, laterTime);
    renderChart(earlierRatio, targetRatio, laterRatio, earlierTime, targetTime, laterTime);

    // Reveal results area
    resultsArea.style.display = "flex";
    resultsArea.style.animation = "none";
    // Force reflow
    void resultsArea.offsetHeight;
    resultsArea.style.animation = "fadeUp .5s ease-out both";

    // Smooth scroll to results
    resultsArea.scrollIntoView({ behavior: "smooth", block: "start" });

  } catch (err) {
    console.error("Prediction error:", err);
    showError(`Prediction failed: ${err.message}`);
  } finally {
    setLoading(false);
  }
});

// ── Init ──────────────────────────────────────────────────
loadStations();
