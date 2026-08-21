/* ============================================================
   KISAN MITRA — app.js
   UI wiring + the crop-recommendation scoring engine.
   No framework, no build step — plain JS so it's easy to read,
   fork and extend for the hackathon demo/judging.
   ============================================================ */

const STATE = {
  soil: null,
  acres: 2,
  weather: null,      // { tempAvg, rainTotal, humidityAvg }
  locationLabel: null,
  marketDistrict: null,
  marketLocationName: null,
  results: [],
  sellerState: "Maharashtra",
};

const INDIAN_STATES = ["Andhra Pradesh","Bihar","Chhattisgarh","Gujarat","Haryana","Karnataka","Madhya Pradesh","Maharashtra","Punjab","Rajasthan","Tamil Nadu","Telangana","Uttar Pradesh","West Bengal"];

/* ---------------- boot ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  renderSoilChips();
  renderStateOptions();
  wireNav();
  wireRecommendScreen();
  wireMarketScreen();
  wireSellersScreen();
  wireScanScreen();
  applyLanguage();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
});

/* ---------------- language ---------------- */
function applyLanguage() {
  document.querySelectorAll("[data-t]").forEach(el => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll("[data-t-ph]").forEach(el => { el.placeholder = t(el.dataset.tPh); });
  document.getElementById("langBtn").textContent = t("langToggle");
  document.documentElement.lang = currentLang;
  renderSoilChips();
}
document.addEventListener("click", (e) => {
  if (e.target.id === "langBtn") {
    currentLang = currentLang === "en" ? "hi" : "en";
    localStorage.setItem("km_lang", currentLang);
    applyLanguage();
    if (STATE.results.length) renderResults();
  }
});

/* ---------------- nav ---------------- */
function wireNav() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchScreen(btn.dataset.screen));
  });
}
function switchScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === "screen-" + name));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.screen === name));
}

/* ---------------- toast ---------------- */
let toastTimer;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

/* ================= SCREEN 1: RECOMMEND ================= */

function renderSoilChips() {
  const wrap = document.getElementById("soilChips");
  wrap.innerHTML = "";
  SOILS.forEach(s => {
    const chip = document.createElement("div");
    chip.className = "chip" + (STATE.soil === s.id ? " selected" : "");
    chip.textContent = currentLang === "hi" ? s.hi : s.en;
    chip.addEventListener("click", () => { STATE.soil = s.id; renderSoilChips(); });
    wrap.appendChild(chip);
  });
}

function wireRecommendScreen() {
  document.getElementById("acreInput").addEventListener("input", (e) => {
    STATE.acres = Math.max(0.1, parseFloat(e.target.value) || 0);
  });

  document.getElementById("locateBtn").addEventListener("click", async () => {
    const statusEl = document.getElementById("locateStatus");
    statusEl.innerHTML = `<span class="dot"></span> ${t("locating")}`;
    try {
      const { lat, lon } = await getLocation();
      const w = await fetchWeather(lat, lon);
      STATE.weather = w;
      STATE.locationLabel = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
      let soilNote = "";
      const localMatch = guessSoilFromCoordinates(lat, lon);
      try {
        const address = await reverseGeocode(lat, lon);
        // Town/taluka lookup takes priority over the intentionally broad
        // district fallback. It only matches inside an explicit radius.
        setMarketDistrictFromAddress(address);
        const guessedSoil = localMatch ? localMatch.soil : guessSoilFromAddress(address);
        if (guessedSoil) {
          STATE.soil = guessedSoil;
          renderSoilChips();
          const soilLabel = SOILS.find(s => s.id === guessedSoil);
          const soilName = currentLang === "hi" ? soilLabel.hi : soilLabel.en;
          const sourceLabel = localMatch ? `${localMatch.name} (${localMatch.taluka})` : null;
          soilNote = currentLang === "hi"
            ? ` · मिट्टी अनुमानित: ${soilName}${sourceLabel ? ` — ${sourceLabel}` : ""} (बदल सकते हैं)`
            : ` · Soil guess: ${soilName}${sourceLabel ? ` — ${sourceLabel}` : ""} (you can change it)`;
          if (localMatch) {
            statusEl.title = `${localMatch.name}: ${localMatch.detail}`;
          }
        }
      } catch (geoErr) {
        // Reverse geocoding is best-effort. The coordinate lookup remains useful.
        if (localMatch) {
          STATE.soil = localMatch.soil;
          renderSoilChips();
          const soilLabel = SOILS.find(s => s.id === localMatch.soil);
          const soilName = currentLang === "hi" ? soilLabel.hi : soilLabel.en;
          soilNote = currentLang === "hi"
            ? ` · मिट्टी अनुमानित: ${soilName} — ${localMatch.name} (${localMatch.taluka}) (बदल सकते हैं)`
            : ` · Soil guess: ${soilName} — ${localMatch.name} (${localMatch.taluka}) (you can change it)`;
          statusEl.title = `${localMatch.name}: ${localMatch.detail}`;
        }
      }
      statusEl.innerHTML = `<span class="dot live"></span> ${t("weatherFetched")} · ${Math.round(w.tempAvg)}°C, ${Math.round(w.rainTotal)}mm/yr${soilNote}`;
    } catch (err) {
      const msg = currentLang === "hi"
        ? "लोकेशन नहीं मिली — आप मिट्टी चुनकर सामान्य मौसम औसत के साथ आगे बढ़ सकते हैं।"
        : "Couldn't get location — you can still pick a soil type and continue with typical seasonal averages.";
      statusEl.innerHTML = `<span class="dot"></span> ${msg}`;
      STATE.weather = { tempAvg: 27, rainTotal: 900, humidityAvg: 60 }; // sensible India-wide fallback
    }
  });

  document.getElementById("getRecsBtn").addEventListener("click", () => {
    if (!STATE.soil) { showToast(currentLang === "hi" ? "कृपया मिट्टी का प्रकार चुनें" : "Please choose a soil type"); return; }
    if (!STATE.weather) STATE.weather = { tempAvg: 27, rainTotal: 900, humidityAvg: 60 };
    computeRecommendations();
    renderResults();
    document.getElementById("resultsWrap").scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") closeModal();
  });
}

function rangeScore(value, lo, hi) {
  if (value >= lo && value <= hi) return 1;
  const width = Math.max(hi - lo, 1);
  const dist = value < lo ? lo - value : value - hi;
  return Math.max(0, 1 - dist / width);
}

function computeRecommendations() {
  const month = new Date().getMonth() + 1;
  const { tempAvg, rainTotal } = STATE.weather;
  const regionalRule = getDistrictCropRule(STATE.marketDistrict);
  STATE.results = CROPS.filter(crop => !regionalRule || !regionalRule.exclude.includes(crop.id)).map(crop => {
    const soilScore = crop.soils.includes(STATE.soil) ? 1 : 0.15;
    const tempScore = rangeScore(tempAvg, crop.temp[0], crop.temp[1]);
    const rainScore = rangeScore(rainTotal, crop.rain[0], crop.rain[1]);
    const inSeason = SEASON_MONTHS[crop.season].includes(month);
    const seasonScore = inSeason ? 1 : 0.4;
    const regionalBoost = regionalRule && regionalRule.prefer.includes(crop.id) ? 0.12 : 0;
    const match = Math.min(1, soilScore * 0.35 + tempScore * 0.30 + rainScore * 0.20 + seasonScore * 0.15 + regionalBoost);
    return { crop, match, inSeason };
  }).sort((a, b) => b.match - a.match).slice(0, 6);
}

function renderResults() {
  const wrap = document.getElementById("resultsWrap");
  const regionalRule = getDistrictCropRule(STATE.marketDistrict);
  const regionNote = regionalRule
    ? `<p class="section-sub" style="margin:-6px 0 14px;">${escapeHtml(regionalRule.label)} suitability filter applied; unsuitable crops are excluded.</p>`
    : "";
  wrap.innerHTML = `<h3 class="section-title" style="font-size:1.15rem">${t("topPicks")}</h3>${regionNote}`;
  STATE.results.forEach((r, i) => wrap.appendChild(buildCropCard(r, i)));
}

function buildCropCard(r, index) {
  const { crop, match, inSeason } = r;
  const acres = STATE.acres || 1;
  const yieldQ = crop.yieldPerAcre * acres;
  const cost = crop.costPerAcre * acres;
  const revenue = yieldQ * crop.basePrice;
  const profit = revenue - cost;

  const card = document.createElement("div");
  card.className = "card crop-card";
  card.innerHTML = `
    <div class="crop-card-top">
      <div class="rank-badge">${index + 1}</div>
      <div>
        <div class="crop-name">${currentLang === "hi" ? crop.hi : crop.en}</div>
        <div class="crop-meta">${crop.duration} ${currentLang === "hi" ? "दिन" : "days"} · ${waterLabel(crop.water)}</div>
      </div>
      ${inSeason ? `<span class="badge">${t("seasonNow")}</span>` : ""}
    </div>
    <div class="match-bar-track"><div class="match-bar-fill" style="width:${Math.round(match * 100)}%"></div></div>
    <div class="stat-row">
      <div class="stat"><div class="stat-value">${fmtQ(yieldQ)}</div><div class="stat-label">${t("estYield")}</div></div>
      <div class="stat"><div class="stat-value">${fmtRs(cost)}</div><div class="stat-label">${t("estCost")}</div></div>
      <div class="stat"><div class="stat-value" style="color:${profit >= 0 ? 'var(--green-700)' : 'var(--danger)'}">${fmtRs(profit)}</div><div class="stat-label">${t("estProfit")}</div></div>
    </div>
    <div class="detail-link">${t("viewDetail")} →</div>
  `;
  card.querySelector(".detail-link").addEventListener("click", () => openDetailModal(crop, acres));
  return card;
}

function waterLabel(w) {
  const map = { en: { low: "Low water", medium: "Medium water", high: "High water" }, hi: { low: "कम पानी", medium: "मध्यम पानी", high: "अधिक पानी" } };
  return map[currentLang][w];
}
function fmtQ(n) { return n.toLocaleString("en-IN", { maximumFractionDigits: 0 }) + " q"; }
function fmtRs(n) { return "₹" + Math.round(n).toLocaleString("en-IN"); }

/* ---- detail modal with a lightweight custom SVG bar chart ---- */
function openDetailModal(crop, acres) {
  const backdrop = document.getElementById("modalBackdrop");
  const sheet = document.getElementById("modalSheet");
  const yieldQ = crop.yieldPerAcre * acres;
  const cost = crop.costPerAcre * acres;
  const revenue = yieldQ * crop.basePrice;
  const profit = revenue - cost;
  const maxVal = Math.max(revenue, cost, 1);
  const bar = (val, color) => `${Math.max(4, (val / maxVal) * 100)}%;background:${color}`;

  sheet.innerHTML = `
    <div class="modal-close"></div>
    <h3 class="section-title">${currentLang === "hi" ? crop.hi : crop.en}</h3>
    <p class="section-sub">${acres} ${currentLang === "hi" ? "एकड़ के लिए अनुमान" : "acre estimate"} · ${crop.duration} ${currentLang === "hi" ? "दिन की फसल" : "day crop"}</p>
    <div class="card">
      <div class="row" style="justify-content:space-between; font-size:0.82rem; font-weight:700; color:var(--ink-soft); margin-bottom:6px;"><span>${currentLang === "hi" ? "आय" : "Revenue"}</span><span>${fmtRs(revenue)}</span></div>
      <div class="match-bar-track" style="height:16px; border-radius:6px;"><div style="height:100%;border-radius:6px;width:${bar(revenue, 'var(--green-700)').split(';')[0]}" ></div></div>
      <div class="row" style="justify-content:space-between; font-size:0.82rem; font-weight:700; color:var(--ink-soft); margin:14px 0 6px;"><span>${currentLang === "hi" ? "लागत" : "Cost"}</span><span>${fmtRs(cost)}</span></div>
      <div class="match-bar-track" style="height:16px; border-radius:6px;"><div style="height:100%;border-radius:6px;width:${bar(cost, 'var(--rust-700)').split(';')[0]}"></div></div>
      <div class="row" style="justify-content:space-between; font-size:0.9rem; font-weight:800; color:var(--green-900); margin-top:16px; padding-top:14px; border-top:1px solid var(--line);"><span>${t("estProfit")}</span><span style="color:${profit>=0?'var(--green-700)':'var(--danger)'}">${fmtRs(profit)}</span></div>
    </div>
    <div class="card">
      <div class="stat-row" style="grid-template-columns:1fr 1fr;">
        <div class="stat"><div class="stat-value">${fmtQ(yieldQ)}</div><div class="stat-label">${t("estYield")}</div></div>
        <div class="stat"><div class="stat-value">₹${crop.basePrice}/q</div><div class="stat-label">${currentLang === "hi" ? "अनुमानित भाव" : "Ref. price"}</div></div>
      </div>
      <p class="section-sub" style="margin:12px 0 0;">${currentLang === "hi" ? "सटीक भाव के लिए बाज़ार टैब देखें। ये आंकड़े सामान्य संदर्भ हैं — स्थानीय कृषि विज्ञान केंद्र से पुष्टि करें।" : "Check the Market tab for live prices. These figures are general reference estimates — confirm with your local Krishi Vigyan Kendra before planting."}</p>
    </div>
    <button class="btn secondary" id="closeModalBtn">${currentLang === "hi" ? "बंद करें" : "Close"}</button>
  `;
  document.getElementById("closeModalBtn").addEventListener("click", closeModal);

  // draw the actual fill widths now that elements exist (percentage of maxVal)
  const fills = sheet.querySelectorAll(".match-bar-track > div");
  fills[0].style.width = Math.max(4, (revenue / maxVal) * 100) + "%";
  fills[0].style.background = "var(--green-700)";
  fills[1].style.width = Math.max(4, (cost / maxVal) * 100) + "%";
  fills[1].style.background = "var(--rust-700)";

  backdrop.classList.add("show");
}
function closeModal() { document.getElementById("modalBackdrop").classList.remove("show"); }

/* ================= SCREEN 2: MARKET ================= */

function renderStateOptions() {
  const sel = document.getElementById("stateSelect");
  sel.innerHTML = INDIAN_STATES.map(s => `<option value="${s}">${s}</option>`).join("");
  sel.value = STATE.sellerState;
}

function wireMarketScreen() {
  document.getElementById("cropSearch").addEventListener("input", renderMarketList);
  document.getElementById("stateSelect").addEventListener("change", (e) => { STATE.sellerState = e.target.value; });
  document.getElementById("marketLocationBtn").addEventListener("click", setMarketLocation);
  renderMarketList();
}

function districtFromAddress(address) {
  const value = address && (address.state_district || address.county || address.city_district);
  return value ? value.replace(/\s+(district|zilla)$/i, "").trim() : null;
}

function setMarketDistrictFromAddress(address) {
  const district = districtFromAddress(address);
  if (!district) return false;
  STATE.marketDistrict = district;
  STATE.marketLocationName = address.city || address.town || address.village || district;
  const state = address.state;
  const stateSelect = document.getElementById("stateSelect");
  if (state && INDIAN_STATES.includes(state)) {
    STATE.sellerState = state;
    stateSelect.value = state;
  }
  const status = document.getElementById("marketLocationStatus");
  status.innerHTML = `<span class="dot live"></span> Live mandi prices filtered to ${escapeHtml(district)} district`;
  return true;
}

async function setMarketLocation() {
  const status = document.getElementById("marketLocationStatus");
  status.innerHTML = '<span class="dot"></span> Finding your district…';
  try {
    const { lat, lon } = await getLocation();
    const address = await reverseGeocode(lat, lon);
    if (!setMarketDistrictFromAddress(address)) throw new Error("DISTRICT_NOT_FOUND");
    renderMarketList();
  } catch (error) {
    status.innerHTML = '<span class="dot"></span> Location is needed to show mandi prices from your district.';
  }
}

async function renderMarketList() {
  const query = (document.getElementById("cropSearch").value || "").toLowerCase();
  const list = document.getElementById("marketList");
  const matches = CROPS.filter(c => c.en.toLowerCase().includes(query) || c.hi.includes(query)).slice(0, 12);
  list.innerHTML = matches.map(c => `
    <div class="price-row" id="price-${c.id}">
      <div>
        <div class="price-crop">${currentLang === "hi" ? c.hi : c.en}</div>
      </div>
      <div class="price-value">
        <span class="price-tag ref">${currentLang === "hi" ? "अनुमान" : "reference"}</span>
        <div class="price-num">₹${c.basePrice.toLocaleString("en-IN")}</div>
        <div class="price-unit">/ ${currentLang === "hi" ? "क्विंटल" : "quintal"}</div>
      </div>
    </div>
  `).join("");

  // Never substitute state-wide prices for a local mandi result. A district
  // must come from GPS + reverse geocoding before a live price is requested.
  if (!STATE.marketDistrict) return;

  // try district-filtered live prices for the visible matches, non-blocking
  matches.forEach(async (c) => {
    const live = await fetchMandiPrice(c.en, document.getElementById("stateSelect").value, STATE.marketDistrict).catch(() => null);
    if (!live) return;
    const row = document.getElementById(`price-${c.id}`);
    if (!row) return;
    row.querySelector(".price-value").innerHTML = `
      <span class="price-tag live">${escapeHtml(live.sampleMarket || STATE.marketDistrict)}</span>
      <div class="price-num">₹${live.pricePerQuintal.toLocaleString("en-IN")}</div>
      <div class="price-unit">/ ${currentLang === "hi" ? "क्विंटल" : "quintal"}</div>
    `;
  });
}

/* ================= SCREEN 3: SELLERS ================= */

function wireSellersScreen() {
  document.getElementById("findSellersBtn").addEventListener("click", async () => {
    const list = document.getElementById("sellersList");
    list.innerHTML = `<div class="skeleton" style="height:64px;margin-bottom:10px;"></div><div class="skeleton" style="height:64px;margin-bottom:10px;"></div><div class="skeleton" style="height:64px;"></div>`;
    try {
      const { lat, lon } = await getLocation();
      const [osmResult, ownerResult] = await Promise.allSettled([
        fetchNearbySellers(lat, lon),
        fetchOwnerListedSellers(lat, lon),
      ]);
      const sellers = [
        ...(ownerResult.status === "fulfilled" ? ownerResult.value : []),
        ...(osmResult.status === "fulfilled" ? osmResult.value.map(s => ({ ...s, source: "osm" })) : []),
      ].sort((a, b) => a.distanceKm - b.distanceKm);
      if (ownerResult.status === "rejected") console.warn("Owner listings unavailable", ownerResult.reason);
      if (osmResult.status === "rejected") console.warn("OSM listings unavailable", osmResult.reason);
      renderSellers(sellers);
    } catch (err) {
      list.innerHTML = `<div class="empty-state">${currentLang === "hi" ? "लोकेशन की अनुमति ज़रूरी है।" : "Location permission is needed to find sellers near you."}</div>`;
    }
  });
}

function renderSellers(sellers) {
  const list = document.getElementById("sellersList");
  if (!sellers.length) {
    list.innerHTML = `<div class="empty-state">${t("noSellers")}</div>`;
    return;
  }
  list.innerHTML = sellers.slice(0, 20).map(s => `
    <div class="card seller-card">
      <div class="seller-icon">${SHOP_ICON}</div>
      <div style="flex:1;">
        <div class="seller-name">${escapeHtml(s.name)}${s.source === "owner" ? `<span class="seller-source">${s.verified ? "Verified owner" : "Owner listed"}</span>` : ""}</div>
        <div class="seller-sub">${s.address ? escapeHtml(s.address) : (currentLang === "hi" ? "पता उपलब्ध नहीं" : "Address not listed")}${s.phone ? " · " + escapeHtml(s.phone) : ""}</div>
        <a class="detail-link" style="display:inline-block;margin-top:6px;" href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=17/${s.lat}/${s.lon}" target="_blank" rel="noopener">${currentLang === "hi" ? "मानचित्र पर देखें" : "Open in maps"} →</a>
      </div>
      <div class="seller-dist">${s.distanceKm.toFixed(1)} km</div>
    </div>
  `).join("");
}
function escapeHtml(str) { const d = document.createElement("div"); d.textContent = str; return d.innerHTML; }

/* ================= SCREEN 4: DISEASE SCANNER ================= */

function wireScanScreen() {
  const fileInput = document.getElementById("fileInput");
  document.getElementById("uploadZone").addEventListener("click", (event) => {
    // Prevent the programmatic input click from bubbling back to the zone
    // and recursively opening the picker in some browsers.
    if (event.target !== fileInput) fileInput.click();
  });
  fileInput.addEventListener("click", (event) => event.stopPropagation());
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleScan(file);
  });
}

async function handleScan(file) {
  const resultWrap = document.getElementById("scanResult");
  const previewUrl = URL.createObjectURL(file);
  resultWrap.innerHTML = `
    <img class="preview-img" src="${previewUrl}" alt="Uploaded plant photo" />
    <div class="card" style="text-align:center;">
      <div class="spinner"></div>
      <p class="section-sub" style="margin:12px 0 0;">${t("analyzing")}</p>
    </div>
  `;
  try {
    const predictions = await classifyPlantDisease(file);
    renderScanResult(predictions, previewUrl);
  } catch (err) {
    if (err.message === "NO_TOKEN") {
      resultWrap.innerHTML += `
        <div class="card">
          <div class="section-title" style="font-size:1.05rem;">${currentLang === "hi" ? "सेटअप ज़रूरी" : "One-time setup needed"}</div>
          <p class="section-sub">${currentLang === "hi"
            ? "इस स्कैनर के लिए एक मुफ़्त Hugging Face टोकन चाहिए। js/config.js खोलें और अपनी फ़्री key डालें — README.md में पूरे कदम दिए हैं।"
            : "This scanner needs a free Hugging Face token. Open js/config.js and paste in your free key — full steps are in README.md."}</p>
        </div>`;
    } else if (/HF_ERROR_(401|403)/.test(err.message)) {
      resultWrap.innerHTML += `
        <div class="card">
          <p class="section-sub">${currentLang === "hi"
            ? "Hugging Face token में ‘Make calls to Inference Providers’ अनुमति चाहिए। नया token बनाकर js/config.js में डालें।"
            : "Your Hugging Face token needs the ‘Make calls to Inference Providers’ permission. Create one with that permission and add it to js/config.js."}</p>
        </div>`;
    } else if (/HF_ERROR_410/.test(err.message)) {
      resultWrap.innerHTML += `
        <div class="card">
          <p class="section-sub">${currentLang === "hi"
            ? "चुना हुआ scan model अब उपलब्ध नहीं है। js/config.js में Inference Providers समर्थित plant-disease model चुनें।"
            : "The configured scan model is no longer served. Choose an Inference Providers-supported plant-disease model in js/config.js."}</p>
        </div>`;
    } else {
      resultWrap.innerHTML += `
        <div class="card">
          <p class="section-sub">${currentLang === "hi" ? "अभी जांच नहीं हो पाई। दोबारा कोशिश करें या साफ़ फ़ोटो लें।" : "Couldn't analyse that photo right now. Try again, or use a clearer, well-lit close-up."}</p>
        </div>`;
    }
  }
}

function renderScanResult(predictions, previewUrl) {
  const resultWrap = document.getElementById("scanResult");
  const top = predictions[0];
  const info = lookupDiseaseInfo(top.label);
  const prettyLabel = top.label.replace(/_+/g, " ").replace(/\s*\d+\s*/g, "");
  resultWrap.innerHTML = `
    <img class="preview-img" src="${previewUrl}" alt="Uploaded plant photo" />
    <div class="card">
      <div class="section-title" style="font-size:1.15rem;">${info.title}</div>
      <p class="section-sub" style="margin-bottom:2px;">${prettyLabel}</p>
      <div class="row" style="justify-content:space-between; font-size:0.76rem; color:var(--ink-soft); margin-top:10px;"><span>${t("confidence")}</span><span>${Math.round(top.score * 100)}%</span></div>
      <div class="confidence-track"><div class="confidence-fill" style="width:${Math.round(top.score * 100)}%"></div></div>
    </div>
    <div class="card">
      <div class="section-title" style="font-size:1rem;">${t("whatToDo")}</div>
      <p class="section-sub" style="margin-bottom:0;">${info.advice}</p>
    </div>
    <button class="btn secondary" id="scanAgainBtn">${currentLang === "hi" ? "दोबारा जांचें" : "Scan another photo"}</button>
  `;
  document.getElementById("scanAgainBtn").addEventListener("click", () => {
    document.getElementById("fileInput").value = "";
    resultWrap.innerHTML = "";
  });
}

const SHOP_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M3 9l1-5h16l1 5"/><path d="M4 9v10h16V9"/><path d="M9 19v-6h6v6"/></svg>`;
