/* ============================================================
   KISAN MITRA — data.js
   Reference agronomic dataset + translations + disease remedies.

   NOTE ON DATA QUALITY:
   The numbers in CROPS below (temperature/rainfall/pH ranges,
   average yield, cost of cultivation, base price) are ILLUSTRATIVE
   reference figures drawn from general Indian agronomy knowledge
   (ICAR-style ballparks). They are good enough to power realistic
   recommendations and a working demo, but they are NOT a substitute
   for local agricultural extension data. Two easy upgrades are
   described in README.md:
     1. Swap in the public "Crop_recommendation.csv" dataset
        (2200 rows, Kaggle) and do k-NN instead of rule scoring.
     2. Pull live prices from data.gov.in (already wired in api.js)
        so basePricePerQuintal is only ever a fallback.
   ============================================================ */

const SOILS = [
  { id: "alluvial", en: "Alluvial", hi: "जलोढ़" },
  { id: "black", en: "Black (Regur)", hi: "काली मिट्टी" },
  { id: "red", en: "Red", hi: "लाल मिट्टी" },
  { id: "laterite", en: "Laterite", hi: "लैटेराइट" },
  { id: "sandy", en: "Sandy", hi: "रेतीली" },
  { id: "sandyloam", en: "Sandy Loam", hi: "बलुई दोमट" },
  { id: "loamy", en: "Loamy", hi: "दोमट" },
  { id: "clay", en: "Clay", hi: "चिकनी मिट्टी" },
];

/* ============================================================
   SOIL-BY-REGION LOOKUP
   Used to auto-suggest a soil type from GPS location.  A compact,
   deliberately bounded town/taluka lookup is checked before the
   reverse-geocoded district/state fallback.  It is a decision-support
   hint, never a replacement for a field soil test.

   These are broad ICAR-style dominant soil groups per state —
   real soil varies within any district, so this is a starting
   suggestion the user can always override, never a survey-grade
   soil map.

   DISTRICT_SOIL_OVERRIDES exists because a handful of coastal
   belts have a very different dominant soil than the rest of
   their state (e.g. Maharashtra is mostly black/regur soil, but
   the Konkan coastal strip — Ratnagiri, Sindhudurg, Raigad,
   Thane, Palghar, Mumbai — is laterite). Match district name
   first; fall back to state.
   ============================================================ */
const STATE_SOIL_DEFAULT = {
  "punjab": "alluvial", "haryana": "alluvial", "delhi": "alluvial",
  "uttar pradesh": "alluvial", "bihar": "alluvial", "west bengal": "alluvial",
  "assam": "alluvial", "chandigarh": "alluvial",
  "uttarakhand": "loamy", "himachal pradesh": "loamy", "jammu and kashmir": "loamy",
  "ladakh": "sandy", "rajasthan": "sandy",
  "gujarat": "black", "madhya pradesh": "black", "telangana": "black",
  "maharashtra": "black",
  "chhattisgarh": "red", "karnataka": "red", "andhra pradesh": "red",
  "tamil nadu": "red", "jharkhand": "red", "arunachal pradesh": "red",
  "nagaland": "red", "manipur": "red", "puducherry": "red",
  "goa": "laterite", "kerala": "laterite", "odisha": "laterite",
  "mizoram": "laterite", "tripura": "laterite", "meghalaya": "laterite",
  "andaman and nicobar islands": "laterite",
  "sikkim": "loamy",
};

const DISTRICT_SOIL_OVERRIDES = {
  // Konkan coastal belt, Maharashtra — laterite, not the state's usual black soil
  "ratnagiri": "laterite", "sindhudurg": "laterite", "raigad": "laterite",
  "thane": "laterite", "palghar": "laterite",
  "mumbai": "laterite", "mumbai city": "laterite", "mumbai suburban": "laterite",
  // Coastal Karnataka — laterite, not the state's usual red soil
  "dakshina kannada": "laterite", "udupi": "laterite", "uttara kannada": "laterite",
};

/*
   RATNAGIRI + NEARBY LOCATION LOOKUP (August 2026)

   `soil` is the dominant soil for the named town/settlement, mapped to
   the app's existing recommendation categories. `detail` preserves the
   important local qualifier: soils can change sharply between a lateritic
   plateau, a river/estuary plain, and a coastal strip within one taluka.

   Evidence: Maharashtra Gazetteer, Ratnagiri — Agriculture & Irrigation,
   “Soils”; CGWB Ratnagiri district profile; Maharashtra GSDA Ratnagiri
   district geology. Sources and usage note: README.md § Soil lookup.
*/
const RATNAGIRI_LOCATION_SOILS = [
  // All nine Ratnagiri taluka headquarters
  { name: "Mandangad", taluka: "Mandangad", lat: 17.9807, lon: 73.2228, radiusKm: 12, soil: "red", detail: "Shallow red/lateritic upland soils; forested terrain is extensive." },
  { name: "Dapoli", taluka: "Dapoli", lat: 17.7588, lon: 73.1873, radiusKm: 12, soil: "laterite", detail: "Lateritic plateau soil; coastal pockets grade to deep sandy-loam alluvium." },
  { name: "Khed", taluka: "Khed", lat: 17.7189, lon: 73.3967, radiusKm: 12, soil: "alluvial", detail: "Jagbudi valley alluvium around town; surrounding uplands are shallow lateritic/basalt-derived soils." },
  { name: "Chiplun", taluka: "Chiplun", lat: 17.5334, lon: 73.5170, radiusKm: 14, soil: "alluvial", detail: "Vashishti valley alluvium around town; lateritic and basalt-derived soils occur on adjacent slopes." },
  { name: "Guhagar", taluka: "Guhagar", lat: 17.4820, lon: 73.1938, radiusKm: 12, soil: "sandyloam", detail: "Coastal sandy-loam alluvium near the settlement; laterite dominates the surrounding plateau." },
  { name: "Sangameshwar", taluka: "Sangameshwar", lat: 17.1831, lon: 73.5534, radiusKm: 12, soil: "alluvial", detail: "Shastri river-valley alluvium around town; nearby slopes are lateritic/basalt-derived." },
  { name: "Ratnagiri", taluka: "Ratnagiri", lat: 16.9902, lon: 73.3120, radiusKm: 15, soil: "laterite", detail: "Lateritic plateau soil; estuarine/coastal pockets contain alluvium and occasional saline patches." },
  { name: "Lanja", taluka: "Lanja", lat: 16.8564, lon: 73.5499, radiusKm: 12, soil: "laterite", detail: "Lateritic/basalt-derived upland soil; valley bottoms can be deeper and finer textured." },
  { name: "Rajapur", taluka: "Rajapur", lat: 16.6560, lon: 73.5170, radiusKm: 12, soil: "alluvial", detail: "River-valley alluvium around town; lateritic uplands and local shallow soils are nearby." },

  // Nearby/commonly used Konkan locations for a useful GPS result beyond headquarters
  { name: "Kelshi", taluka: "Dapoli", lat: 17.9253, lon: 73.0487, radiusKm: 8, soil: "sandyloam", detail: "Coastal alluvial sandy loam; verify salinity close to the creek." },
  { name: "Harnai", taluka: "Dapoli", lat: 17.8141, lon: 73.0947, radiusKm: 8, soil: "sandyloam", detail: "Coastal sandy-loam alluvium; laterite rises immediately inland." },
  { name: "Dabhol", taluka: "Dapoli", lat: 17.5904, lon: 73.1768, radiusKm: 8, soil: "alluvial", detail: "Vashishti estuary alluvium; check salinity in low-lying creek-side fields." },
  { name: "Hedavi", taluka: "Guhagar", lat: 17.3973, lon: 73.1948, radiusKm: 8, soil: "sandyloam", detail: "Coastal sandy-loam alluvium with lateritic uplands nearby." },
  { name: "Devrukh", taluka: "Sangameshwar", lat: 17.0559, lon: 73.6147, radiusKm: 10, soil: "laterite", detail: "Lateritic/basalt-derived upland soil; local valley bottoms differ." },
  { name: "Ganpatipule", taluka: "Ratnagiri", lat: 17.1417, lon: 73.2697, radiusKm: 8, soil: "sandyloam", detail: "Coastal sandy-loam/alluvial strip; laterite dominates nearby higher ground." },
  { name: "Jaigad", taluka: "Ratnagiri", lat: 17.2882, lon: 73.2238, radiusKm: 8, soil: "alluvial", detail: "Estuarine alluvium; test for salinity near the creek." },
  { name: "Purnagad", taluka: "Ratnagiri", lat: 16.8126, lon: 73.2990, radiusKm: 8, soil: "alluvial", detail: "Estuarine alluvium; test for salinity near tidal influence." },
  { name: "Nate", taluka: "Rajapur", lat: 16.5959, lon: 73.3234, radiusKm: 8, soil: "sandyloam", detail: "Coastal sandy-loam alluvium; local lowland salinity is possible." },
  { name: "Mahad", taluka: "Mahad, Raigad", lat: 18.0833, lon: 73.4167, radiusKm: 14, soil: "alluvial", detail: "Savitri river-valley alluvium around town; nearby hills are lateritic/basalt-derived." },
  { name: "Poladpur", taluka: "Poladpur, Raigad", lat: 17.9857, lon: 73.4524, radiusKm: 12, soil: "laterite", detail: "Lateritic/basalt-derived foothill soil; valley patches can be deeper." },
  { name: "Sawantwadi", taluka: "Sawantwadi, Sindhudurg", lat: 15.9041, lon: 73.8219, radiusKm: 14, soil: "laterite", detail: "Lateritic upland soil; local valleys and creek margins vary." },
];

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Returns the closest approved location only while GPS is inside its stated radius.
function guessSoilFromCoordinates(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const matches = RATNAGIRI_LOCATION_SOILS
    .map(place => ({ ...place, distance: distanceKm(lat, lon, place.lat, place.lon) }))
    .filter(place => place.distance <= place.radiusKm)
    .sort((a, b) => a.distance - b.distance);
  return matches[0] || null;
}

// Takes a Nominatim-style address object ({ state_district / county / state })
// and returns a soil id, or null if nothing matched.
function guessSoilFromAddress(address) {
  if (!address) return null;
  const district = (address.state_district || address.county || address.city_district || "").toLowerCase().trim();
  const state = (address.state || "").toLowerCase().trim();
  if (district && DISTRICT_SOIL_OVERRIDES[district]) return DISTRICT_SOIL_OVERRIDES[district];
  if (state && STATE_SOIL_DEFAULT[state]) return STATE_SOIL_DEFAULT[state];
  return null;
}

// season windows used for the "in-season now" bonus
const SEASON_MONTHS = {
  kharif: [6, 7, 8, 9, 10],      // Jun - Oct (monsoon sown)
  rabi: [10, 11, 12, 1, 2, 3],   // Oct - Mar (winter sown)
  zaid: [3, 4, 5, 6],            // Mar - Jun (summer, irrigated)
  annual: [1,2,3,4,5,6,7,8,9,10,11,12],
};

/* Location rules are hard constraints, not score penalties. A crop listed
   here must never be suggested when GPS identifies the district. Ratnagiri
   is a humid Konkan horticulture/rice/millet district; the Maharashtra
   Gazetteer explicitly states that cotton is not grown there. */
const DISTRICT_CROP_RULES = {
  ratnagiri: {
    label: "Ratnagiri (Konkan coastal)",
    // Cotton is not grown here; sugarcane and fibre crops (including jute)
    // are documented as negligible in Ratnagiri and should not be top picks.
    exclude: ["cotton", "sugarcane", "jute"],
    prefer: ["mango", "cashew", "finger_millet", "rice"],
  },
};

function getDistrictCropRule(district) {
  if (!district) return null;
  return DISTRICT_CROP_RULES[district.toLowerCase().trim()] || null;
}

const CROPS = [
  { id:"mango", en:"Mango (Alphonso)", hi:"आम (हापुस)", season:"annual", temp:[22,35], rain:[1500,3500], ph:[5.5,7.5], soils:["laterite","red","sandyloam"], water:"medium", duration:365, yieldPerAcre:35, costPerAcre:50000, basePrice:4500 },
  { id:"cashew", en:"Cashew", hi:"काजू", season:"annual", temp:[20,35], rain:[1000,3000], ph:[5.0,6.5], soils:["laterite","red","sandy"], water:"low", duration:365, yieldPerAcre:4, costPerAcre:30000, basePrice:10000 },
  { id:"finger_millet", en:"Finger Millet (Nachni)", hi:"नाचणी", season:"kharif", temp:[20,30], rain:[700,1500], ph:[5.0,7.5], soils:["laterite","red","loamy"], water:"low", duration:110, yieldPerAcre:8, costPerAcre:9000, basePrice:3500 },
  { id:"rice", en:"Rice", hi:"धान", season:"kharif", temp:[20,37], rain:[1000,2000], ph:[5.5,7.0], soils:["clay","alluvial"], water:"high", duration:135, yieldPerAcre:22, costPerAcre:25000, basePrice:2100 },
  { id:"wheat", en:"Wheat", hi:"गेहूं", season:"rabi", temp:[10,25], rain:[400,1000], ph:[6.0,7.5], soils:["alluvial","loamy","clay"], water:"medium", duration:120, yieldPerAcre:18, costPerAcre:22000, basePrice:2300 },
  { id:"maize", en:"Maize", hi:"मक्का", season:"kharif", temp:[18,32], rain:[500,1000], ph:[5.5,7.5], soils:["alluvial","red","loamy"], water:"medium", duration:100, yieldPerAcre:24, costPerAcre:18000, basePrice:1950 },
  { id:"sugarcane", en:"Sugarcane", hi:"गन्ना", season:"annual", temp:[20,38], rain:[1000,1500], ph:[6.0,7.5], soils:["alluvial","loamy","clay"], water:"high", duration:340, yieldPerAcre:320, costPerAcre:45000, basePrice:340 },
  { id:"cotton", en:"Cotton", hi:"कपास", season:"kharif", temp:[21,35], rain:[500,1000], ph:[6.0,8.0], soils:["black","alluvial"], water:"medium", duration:165, yieldPerAcre:7, costPerAcre:28000, basePrice:7100 },
  { id:"soybean", en:"Soybean", hi:"सोयाबीन", season:"kharif", temp:[20,30], rain:[600,1000], ph:[6.0,7.5], soils:["black","loamy"], water:"medium", duration:100, yieldPerAcre:10, costPerAcre:15000, basePrice:4500 },
  { id:"groundnut", en:"Groundnut", hi:"मूंगफली", season:"kharif", temp:[20,30], rain:[500,1000], ph:[6.0,7.5], soils:["sandy","loamy","red"], water:"medium", duration:115, yieldPerAcre:9, costPerAcre:20000, basePrice:5900 },
  { id:"mustard", en:"Mustard", hi:"सरसों", season:"rabi", temp:[10,25], rain:[250,400], ph:[6.0,7.5], soils:["alluvial","loamy","sandy"], water:"low", duration:125, yieldPerAcre:7, costPerAcre:12000, basePrice:5350 },
  { id:"bajra", en:"Pearl Millet (Bajra)", hi:"बाजरा", season:"kharif", temp:[25,35], rain:[250,500], ph:[6.5,8.0], soils:["sandy","red"], water:"low", duration:85, yieldPerAcre:9, costPerAcre:9000, basePrice:2400 },
  { id:"jowar", en:"Sorghum (Jowar)", hi:"ज्वार", season:"kharif", temp:[20,32], rain:[400,800], ph:[6.0,7.5], soils:["black","red","loamy"], water:"low", duration:110, yieldPerAcre:10, costPerAcre:10000, basePrice:3200 },
  { id:"gram", en:"Chickpea (Gram)", hi:"चना", season:"rabi", temp:[10,25], rain:[400,600], ph:[6.0,7.5], soils:["black","alluvial","loamy"], water:"low", duration:105, yieldPerAcre:7, costPerAcre:14000, basePrice:5500 },
  { id:"tur", en:"Pigeon Pea (Tur)", hi:"अरहर", season:"kharif", temp:[20,30], rain:[600,1000], ph:[6.0,7.5], soils:["black","red","loamy"], water:"medium", duration:165, yieldPerAcre:6, costPerAcre:13000, basePrice:7100 },
  { id:"moong", en:"Green Gram (Moong)", hi:"मूंग", season:"zaid", temp:[25,35], rain:[400,600], ph:[6.5,7.5], soils:["loamy","sandy","alluvial"], water:"low", duration:70, yieldPerAcre:4, costPerAcre:9000, basePrice:8500 },
  { id:"potato", en:"Potato", hi:"आलू", season:"rabi", temp:[15,25], rain:[500,750], ph:[5.0,6.5], soils:["sandyloam","loamy","alluvial"], water:"high", duration:100, yieldPerAcre:80, costPerAcre:35000, basePrice:1200 },
  { id:"onion", en:"Onion", hi:"प्याज", season:"rabi", temp:[13,30], rain:[350,650], ph:[6.0,7.5], soils:["sandyloam","loamy","alluvial"], water:"medium", duration:125, yieldPerAcre:90, costPerAcre:40000, basePrice:1800 },
  { id:"tomato", en:"Tomato", hi:"टमाटर", season:"rabi", temp:[18,27], rain:[600,1250], ph:[6.0,7.0], soils:["loamy","alluvial","red"], water:"high", duration:105, yieldPerAcre:150, costPerAcre:50000, basePrice:1200 },
  { id:"banana", en:"Banana", hi:"केला", season:"annual", temp:[20,35], rain:[1200,2200], ph:[6.0,7.5], soils:["alluvial","loamy","clay"], water:"high", duration:340, yieldPerAcre:160, costPerAcre:60000, basePrice:1000 },
  { id:"turmeric", en:"Turmeric", hi:"हल्दी", season:"kharif", temp:[20,30], rain:[1500,2250], ph:[5.0,7.5], soils:["red","black","loamy"], water:"high", duration:240, yieldPerAcre:90, costPerAcre:55000, basePrice:1400 },
  { id:"chili", en:"Chili", hi:"मिर्च", season:"kharif", temp:[20,30], rain:[600,1250], ph:[6.0,7.0], soils:["black","red","alluvial"], water:"medium", duration:165, yieldPerAcre:20, costPerAcre:40000, basePrice:12000 },
  { id:"sunflower", en:"Sunflower", hi:"सूरजमुखी", season:"rabi", temp:[18,28], rain:[500,750], ph:[6.5,7.5], soils:["black","alluvial","red"], water:"medium", duration:100, yieldPerAcre:7, costPerAcre:13000, basePrice:6800 },
  { id:"barley", en:"Barley", hi:"जौ", season:"rabi", temp:[10,25], rain:[300,500], ph:[6.0,8.5], soils:["alluvial","loamy","sandy"], water:"low", duration:130, yieldPerAcre:16, costPerAcre:14000, basePrice:1900 },
  { id:"jute", en:"Jute", hi:"जूट", season:"kharif", temp:[24,37], rain:[1000,2500], ph:[6.0,7.5], soils:["alluvial","clay"], water:"high", duration:135, yieldPerAcre:10, costPerAcre:18000, basePrice:4700 },
];

/* Human-readable remedy guidance, keyed by keywords that appear in
   plant-disease-classifier label strings (typically PlantVillage-style
   "Crop___Disease_name"). We match loosely (case-insensitive substring)
   so this works across several different HF models' label formats. */
const DISEASE_INFO = [
  { match: ["healthy"], en: { title: "Healthy plant", advice: "No disease detected. Keep monitoring weekly, maintain balanced watering, and avoid overhead irrigation late in the day to keep foliage dry." } },
  { match: ["early_blight", "early blight"], en: { title: "Early Blight", advice: "Fungal disease showing as dark concentric-ring spots on older leaves. Remove and destroy infected leaves, avoid overhead watering, rotate crops (don't replant tomato/potato family in the same spot next season), and apply a copper-based or chlorothalonil fungicide — check dosage with your local Krishi Vigyan Kendra (KVK)." } },
  { match: ["late_blight", "late blight"], en: { title: "Late Blight", advice: "Fast-spreading fungal-like disease (water-soaked patches, white mold under leaves). Remove infected plants immediately, improve field drainage and spacing for airflow, and use a protectant fungicide (e.g. copper oxychloride/mancozeb) — get exact dosage from your local KVK, as this disease can destroy a crop within days in wet weather." } },
  { match: ["bacterial_spot", "bacterial spot"], en: { title: "Bacterial Spot", advice: "Small, dark, water-soaked spots with yellow halos. Avoid working in wet fields (spreads on wet leaves/hands/tools), use disease-free seed, rotate crops, and apply copper-based bactericides early — full recovery of severely infected plants is unlikely, focus on protecting healthy ones." } },
  { match: ["leaf_spot", "leaf spot", "septoria"], en: { title: "Leaf Spot", advice: "Circular brown/grey spots, often with a yellow halo. Remove affected leaves, avoid wetting foliage, improve airflow with wider spacing, and rotate with a non-host crop next season. A copper or mancozeb-based fungicide can help if it spreads." } },
  { match: ["powdery_mildew", "powdery mildew"], en: { title: "Powdery Mildew", advice: "White powdery coating on leaves, common in humid-then-dry cycles. Improve airflow by spacing/pruning, avoid excess nitrogen fertilizer, and apply sulfur-based or neem-oil spray at first sign — reapply every 7-10 days." } },
  { match: ["rust"], en: { title: "Rust", advice: "Orange/brown raised pustules on leaf undersides. Remove infected leaves, avoid overhead irrigation, ensure good spacing, and use a triazole or sulfur-based fungicide if it's spreading fast — resistant varieties are the best long-term fix." } },
  { match: ["mosaic", "mosaic_virus"], en: { title: "Mosaic Virus", advice: "Viral disease (mottled yellow-green leaves, stunted growth) spread mainly by aphids/whiteflies — there is no cure once infected. Remove and destroy infected plants, control the insect vector with yellow sticky traps or neem oil, and plant virus-resistant varieties next season." } },
  { match: ["blight"], en: { title: "Blight", advice: "General blight symptoms detected (rapid browning/wilting of leaves or stems). Remove infected material promptly, avoid overhead watering, rotate crops, and consult your local KVK for the correct fungicide for your specific crop." } },
  { match: ["mold", "mildew"], en: { title: "Mold / Mildew", advice: "Fungal growth favoured by high humidity and poor airflow. Prune for airflow, avoid overcrowding, water at the base (not leaves), and use a sulfur or copper-based fungicide if spreading." } },
  { match: ["scab"], en: { title: "Scab", advice: "Rough, corky lesions on leaves/fruit from fungal infection in wet spring weather. Rake and destroy fallen leaves after harvest to reduce next season's spores, improve airflow, and apply a protectant fungicide starting at bud break." } },
  { match: ["nutrient", "deficiency"], en: { title: "Possible Nutrient Deficiency", advice: "Discoloration pattern suggests a nutrient issue rather than disease. Get a soil test done (most state agriculture departments offer this free/cheap) before adding fertilizer, since over-correcting can hurt the crop further." } },
];

const DEFAULT_DISEASE_INFO = { title: "Unrecognised condition", advice: "The model couldn't confidently match this to a known disease pattern. Try a clearer, well-lit close-up of the affected leaf against a plain background, or show the photo to your nearest Krishi Vigyan Kendra (KVK) / agriculture extension officer for a confirmed diagnosis." };

/* ---------------- i18n ---------------- */
const STR = {
  en: {
    appName: "KhetSaathi", tagline: "Your farming decision partner",
    navRecommend: "Recommend", navMarket: "Market", navSellers: "Sellers", navScan: "Scan",
    recTitle: "What should I grow?", recSub: "Answer a few questions for a ranked list, expected yield and profit.",
    soilLabel: "Soil type", acreLabel: "Land size (in acres)", locateBtn: "Use my location",
    locating: "Locating…", weatherFetched: "Weather fetched for your area",
    getRecs: "Get recommendations", topPicks: "Top picks for your field",
    perAcre: "per acre", estProfit: "Est. net profit", estYield: "Est. yield", estCost: "Est. cost",
    seasonNow: "in season now", viewDetail: "View yield & profit detail",
    marketTitle: "Market prices", marketSub: "Live mandi prices where available, otherwise a reference estimate.",
    searchCrop: "Search a crop…", stateLabel: "State (for live mandi data)",
    sellersTitle: "Sellers near you", sellersSub: "Seed, fertilizer and agri-input shops close to your location.",
    findSellers: "Find nearby sellers", noSellers: "No listed shops found nearby on OpenStreetMap yet — you can add your local shop there to help other farmers too.",
    scanTitle: "Plant disease scanner", scanSub: "Upload or capture a clear photo of the affected leaf.",
    uploadPhoto: "Upload photo", takePhoto: "Take photo", analyzing: "Analysing photo…",
    confidence: "Confidence", whatToDo: "What to do",
    langToggle: "हिंदी",
  },
  hi: {
    appName: "KhetSaathi", tagline: "आपका खेती सलाहकार",
    navRecommend: "सुझाव", navMarket: "बाज़ार", navSellers: "विक्रेता", navScan: "जांच",
    recTitle: "मुझे क्या उगाना चाहिए?", recSub: "कुछ सवालों के जवाब दें और फसल सूची, उपज व मुनाफ़ा पाएं।",
    soilLabel: "मिट्टी का प्रकार", acreLabel: "ज़मीन (एकड़ में)", locateBtn: "मेरी लोकेशन इस्तेमाल करें",
    locating: "लोकेशन ढूंढ रहे हैं…", weatherFetched: "आपके क्षेत्र का मौसम मिल गया",
    getRecs: "सुझाव पाएं", topPicks: "आपके खेत के लिए सर्वश्रेष्ठ फ़सलें",
    perAcre: "प्रति एकड़", estProfit: "अनुमानित शुद्ध लाभ", estYield: "अनुमानित उपज", estCost: "अनुमानित लागत",
    seasonNow: "अभी का मौसम", viewDetail: "उपज व लाभ का विवरण देखें",
    marketTitle: "बाज़ार भाव", marketSub: "जहाँ उपलब्ध हो वहाँ लाइव मंडी भाव, अन्यथा अनुमानित भाव।",
    searchCrop: "फ़सल खोजें…", stateLabel: "राज्य (लाइव मंडी डेटा के लिए)",
    sellersTitle: "आस-पास के विक्रेता", sellersSub: "आपके पास के बीज, खाद और कृषि इनपुट की दुकानें।",
    findSellers: "पास के विक्रेता खोजें", noSellers: "OpenStreetMap पर अभी पास कोई दुकान सूचीबद्ध नहीं मिली — आप अपनी स्थानीय दुकान वहाँ जोड़कर दूसरे किसानों की मदद कर सकते हैं।",
    scanTitle: "पौधा रोग जांच", scanSub: "प्रभावित पत्ती की स्पष्ट फ़ोटो अपलोड या कैप्चर करें।",
    uploadPhoto: "फ़ोटो अपलोड करें", takePhoto: "फ़ोटो लें", analyzing: "फ़ोटो जांची जा रही है…",
    confidence: "विश्वसनीयता", whatToDo: "क्या करें",
    langToggle: "English",
  }
};

let currentLang = localStorage.getItem("km_lang") || "en";
function t(key){ return (STR[currentLang] && STR[currentLang][key]) || STR.en[key] || key; }
