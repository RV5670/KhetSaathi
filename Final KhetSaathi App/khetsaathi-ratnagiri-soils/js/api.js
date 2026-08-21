/* ============================================================
   KISAN MITRA — api.js
   Every network call the app makes, isolated in one file so
   you can swap providers without touching the UI code.
   All services used here have a free tier. See config.js and
   README.md for how to get your own free keys.
   ============================================================ */

/* ---------- 1. Location & Weather — Open-Meteo (free, no key) ---------- */

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });
}

async function searchCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json&countryCode=IN`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding failed");
  const data = await res.json();
  return data.results || [];
}

// Returns { tempAvg, rainTotal, humidityAvg } estimated from a 16-day
// forecast — a reasonable proxy for "current growing conditions" since
// Open-Meteo's free tier forecast window is limited without a key.
async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean` +
    `&forecast_days=16&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather fetch failed");
  const data = await res.json();
  const d = data.daily;
  const tempAvg = avg(d.temperature_2m_max.map((max, i) => (max + d.temperature_2m_min[i]) / 2));
  const rainTotal = sum(d.precipitation_sum) * (365 / 16); // rough annualised projection
  const humidityAvg = avg(d.relative_humidity_2m_mean || []);
  return { tempAvg, rainTotal, humidityAvg, raw: data };
}

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

/* ---------- 1b. Reverse geocode — OpenStreetMap Nominatim (free, no key) ----------
   Turns GPS coordinates into a district/state, so we can suggest a soil
   type for that region (see guessSoilFromAddress() in data.js). Same
   OpenStreetMap family of service already used for Sellers, so no new
   dependency. Best-effort only — if it fails, the caller just skips the
   soil suggestion and the user still picks soil manually. */
async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=8&addressdetails=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!res.ok) throw new Error("Reverse geocode failed");
  const data = await res.json();
  return data.address || null;
}

/* ---------- 2. Market prices — data.gov.in Agmarknet (free key) ---------- */
/* Get your free key: https://data.gov.in/user/register  (see README.md)   */

async function fetchMandiPrice(commodityName, stateName, districtName) {
  if (!CONFIG.DATA_GOV_IN_API_KEY || CONFIG.DATA_GOV_IN_API_KEY === "PASTE_YOUR_FREE_KEY_HERE") {
    return null; // caller falls back to reference price
  }
  const resourceId = "9ef84268-d588-465a-a308-a864a43d0070"; // Variety-wise Daily Market Prices
  const params = new URLSearchParams({
    "api-key": CONFIG.DATA_GOV_IN_API_KEY,
    format: "json",
    limit: "20",
    "filters[commodity]": commodityName,
  });
  if (stateName) params.set("filters[state]", stateName);
  if (districtName) params.set("filters[district]", districtName);
  const url = `https://api.data.gov.in/resource/${resourceId}?${params.toString()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const records = data.records || [];
    if (!records.length) return null;
    const modalPrices = records.map(r => parseFloat(r.modal_price)).filter(n => !isNaN(n) && n > 0);
    if (!modalPrices.length) return null;
    return { pricePerQuintal: Math.round(avg(modalPrices)), sampleMarket: records[0].market, samples: records.length };
  } catch (e) {
    console.warn("Mandi price fetch failed, using reference price", e);
    return null;
  }
}

/* ---------- 3. Nearby sellers — OpenStreetMap Overpass API (free, no key) ---------- */

async function fetchNearbySellers(lat, lon, radiusMeters = 15000) {
  const query = `
    [out:json][timeout:20];
    (
      node["shop"="agrarian"](around:${radiusMeters},${lat},${lon});
      node["shop"="garden_centre"](around:${radiusMeters},${lat},${lon});
      way["shop"="agrarian"](around:${radiusMeters},${lat},${lon});
    );
    out center 30;
  `;
  const url = "https://overpass-api.de/api/interpreter";
  const res = await fetch(url, { method: "POST", body: query });
  if (!res.ok) throw new Error("Overpass query failed");
  const data = await res.json();
  return (data.elements || []).map(el => {
    const tags = el.tags || {};
    const elLat = el.lat || (el.center && el.center.lat);
    const elLon = el.lon || (el.center && el.center.lon);
    return {
      name: tags.name || "Agri supply shop",
      lat: elLat, lon: elLon,
      distanceKm: haversineKm(lat, lon, elLat, elLon),
      phone: tags.phone || tags["contact:phone"] || null,
      address: [tags["addr:street"], tags["addr:city"]].filter(Boolean).join(", "),
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat2 == null || lon2 == null) return 999;
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ---------- 3b. Owner-listed sellers — optional Supabase backend ---------- */

function sellerListingsConfigured() {
  return CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY &&
    !CONFIG.SUPABASE_URL.startsWith("PASTE_") && !CONFIG.SUPABASE_ANON_KEY.startsWith("PASTE_");
}

function sellerListingsHeaders() {
  return {
    "apikey": CONFIG.SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
}

async function fetchOwnerListedSellers(lat, lon, radiusMeters = 15000) {
  if (!sellerListingsConfigured()) return [];
  const url = `${CONFIG.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/seller_listings?select=id,name,phone,address,lat,lon,category,verified&is_active=eq.true&limit=250`;
  const res = await fetch(url, { headers: sellerListingsHeaders() });
  if (!res.ok) throw new Error("Owner listings fetch failed");
  const rows = await res.json();
  return rows
    .filter(row => Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lon)))
    .map(row => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      address: row.address,
      lat: Number(row.lat),
      lon: Number(row.lon),
      category: row.category,
      verified: Boolean(row.verified),
      source: "owner",
    }))
    .map(row => ({ ...row, distanceKm: haversineKm(lat, lon, row.lat, row.lon) }))
    .filter(row => row.distanceKm <= radiusMeters / 1000);
}

async function submitOwnerListing(listing) {
  if (!sellerListingsConfigured()) throw new Error("SELLER_LISTINGS_NOT_CONFIGURED");
  const url = `${CONFIG.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/seller_listings`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...sellerListingsHeaders(), "Prefer": "return=representation" },
    body: JSON.stringify(listing),
  });
  if (!res.ok) throw new Error("Listing submission failed");
  return res.json();
}

/* ---------- 4. Plant disease detection — Hugging Face Inference API (free) ---------- */
/* Get your free token: https://huggingface.co/settings/tokens  (see README.md) */

async function classifyPlantDisease(imageFile, retried = false) {
  if (!CONFIG.HF_TOKEN || CONFIG.HF_TOKEN === "PASTE_YOUR_FREE_HF_TOKEN_HERE") {
    throw new Error("NO_TOKEN");
  }
  // The legacy api-inference.huggingface.co endpoint was retired. The
  // current HF Inference route is served through the Hugging Face router.
  const url = `https://router.huggingface.co/hf-inference/models/${CONFIG.HF_DISEASE_MODEL}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONFIG.HF_TOKEN}`,
      "Content-Type": "application/octet-stream",
    },
    body: imageFile,
  });
  if (res.status === 503 && !retried) {
    // model is cold-starting on HF's free infra — wait and retry once
    await new Promise(r => setTimeout(r, 4000));
    return classifyPlantDisease(imageFile, true);
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    const message = detail.error || detail.message || `HTTP ${res.status}`;
    throw new Error(`HF_ERROR_${res.status}:${message}`);
  }
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) throw new Error("HF_EMPTY");
  // Expected shape: [{label: "...", score: 0.93}, ...]
  return data.sort((a, b) => b.score - a.score).slice(0, 3);
}

function lookupDiseaseInfo(label) {
  const lower = label.toLowerCase();
  for (const entry of DISEASE_INFO) {
    if (entry.match.some(kw => lower.includes(kw))) return entry.en;
  }
  return DEFAULT_DISEASE_INFO;
}
