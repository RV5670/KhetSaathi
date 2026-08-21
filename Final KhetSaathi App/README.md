# KhetSaathi (KhetSaathi) — Farming Decision Assistant

A free, installable mobile web app for farmers, built for the **Agriculture, Food
Tech & Rural Development** theme. It has four screens:

1. **Recommend** — pick soil type + land size, optionally use GPS to pull real
   weather, and get a ranked list of crops with an estimated yield, cost and
   net profit for your exact land size.
2. **Market** — mandi (market) prices per crop, live where a free key is
   configured, reference estimates otherwise.
3. **Sellers** — nearby seed/fertilizer/agri-input shops from OpenStreetMap
   plus optional owner-submitted listings, with distance and a map link.
4. **Scan** — upload or camera-capture a leaf photo and get a disease name,
   confidence score and plain-language treatment advice.

It's a **Progressive Web App (PWA)**: no app store, no build step, no
server code, and no paid API on the required path. You "install" it by
opening it in a phone browser and tapping *Add to Home Screen* — it then
behaves like a native app icon, opens full-screen, and the app shell keeps
working with no signal.

---

## 1. Try it locally first (2 minutes)

You need any static file server — opening `index.html` directly with
`file://` will break the fetch calls, so use one of these:

```bash
# Option A: Python (already on most machines)
cd khetsaathi
python3 -m http.server 8080

# Option B: Node
npx serve khetsaathi
```

Then open `http://localhost:8080` in your phone's browser (same Wi-Fi) or
in Chrome DevTools' device toolbar on your laptop.

Everything works immediately **except** live mandi prices and the disease
scanner, which need one free key each — see below. Owner-submitted shop
listings are an optional free Supabase integration. The crop recommendation
engine, yield/profit calculator and the language toggle all work with zero
setup because they run entirely in the browser.

---

## 2. Optional services and API keys

Open `js/config.js` — it's the only file you need to edit.

### A. Market prices — data.gov.in (free, instant)

1. Go to **https://data.gov.in/user/register** and sign up (email + basic
   details, no payment info).
2. After logging in, go to **My Account → API Keys** and copy your key.
3. Paste it into `js/config.js`:
   ```js
   DATA_GOV_IN_API_KEY: "your-key-here",
   ```
   This powers the "Variety-wise Daily Market Prices" dataset
   (resource id already wired up in `js/api.js`). No credit card, no
   request limit that a student project will ever hit.

### B. Plant disease scanner — Hugging Face (free)

1. Create a free account at **https://huggingface.co/join**.
2. Go to **https://huggingface.co/settings/tokens** → **New token** and
   enable **Make calls to Inference Providers** → create.
3. Paste it into `js/config.js`:
   ```js
   HF_TOKEN: "hf_xxxxxxxxxxxxxxxxxxxxx",
   ```

**Good to know:** Hugging Face's current Inference Providers router sometimes needs 10-20
seconds to "wake up" a model on the first request after it's been idle
(you'll see the spinner run a bit longer) — the app already retries once
automatically. If you want higher reliability for the hackathon demo day,
pre-warm it by sending one test image a few minutes before you present.

If a model ever gets retired or rate-limited, swap `HF_DISEASE_MODEL` in
`config.js` for an **Inference Providers-supported** image-classification
model from huggingface.co/models. The legacy `api-inference.huggingface.co`
endpoint has been retired; this app uses the current router endpoint.

**Fully-offline alternative (optional, more work):** train a model for
free at **https://teachablemachine.withgoogle.com/**, export as
TensorFlow.js, and it will run entirely on the phone with unlimited
requests and zero API calls. This is a great "level up" for the judging
round if you have a few spare hours, but the Hugging Face route above is
enough for a working demo today.

### C. Seller-owner listings — Supabase free tier

`seller-listing.html` is a separate owner portal, linked from the Sellers
screen. It stores shop submissions in Supabase; the farmer app reads only
nearby active listings, merges them with OpenStreetMap results, and marks
them **Owner listed** (or **Verified owner** after an admin review).

1. Create a free project at [Supabase](https://supabase.com/), then open
   the project's **SQL Editor**.
2. Paste and run the complete `seller-listings-setup.sql` file included in
   this project. It creates the table and the minimum browser-safe access
   policies: anyone can submit a bounded listing, but nobody can update or
   delete one anonymously.
3. In Supabase, open **Project Settings → API**. Copy the Project URL and
   the public **anon** key into `js/config.js`:
   ```js
   SUPABASE_URL: "https://your-project.supabase.co",
   SUPABASE_ANON_KEY: "your-public-anon-key",
   ```
4. Deploy the app over HTTPS. A shop owner opens
   `https://your-site.example/seller-listing.html`, enters shop details,
   shares the shop's GPS location, and submits. The listing then appears
   to farmers inside the 15 km seller search radius.

The anon key is intentionally a public browser key; keep the Row Level
Security policies in `seller-listings-setup.sql` enabled. For a public
production launch, add a CAPTCHA and an admin approval workflow before
setting `is_active=true` automatically. Admins can use the Supabase table
to set `verified=true` or hide abusive listings with `is_active=false`.

### Weather & Sellers need no key at all

- **Weather** uses **Open-Meteo** (`api.open-meteo.com`) — free forever, no
  signup, no key.
- **Sellers** uses **OpenStreetMap's Overpass API** — free forever, no
  signup, no key. Coverage depends on how many shops locals have already
  tagged on OpenStreetMap; in areas with few tagged shops the list may be
  short. You can add your own local shop at openstreetmap.org to help
  other users (and other student teams!) — it's a public map anyone can
  edit.

---

## 3. Deploy it for free (choose one, ~5 minutes)

Any static host works since there's no backend. Two easy free options:

### Option A — GitHub Pages
1. Create a new GitHub repo and push the `khetsaathi` folder to it.
2. Repo → **Settings → Pages** → Source: `main` branch, `/ (root)` folder → Save.
3. Your app is live at `https://<your-username>.github.io/<repo-name>/`.

### Option B — Netlify (drag-and-drop, no git needed)
1. Go to **https://app.netlify.com/drop**.
2. Drag the whole `khetsaathi` folder onto the page.
3. Netlify gives you a live `https://your-app.netlify.app` URL instantly.
   (Both GitHub Pages and Netlify's free tiers serve over HTTPS, which is
   required for GPS location and camera access to work.)

Either way — **HTTPS is required** for geolocation and camera capture to
work on a real phone, so don't skip straight to a plain HTTP host.

---

## 4. Install it on your phone

Once it's live on HTTPS:

- **Android (Chrome):** open the URL → tap the **⋮** menu → **Add to Home
  screen** / **Install app**.
- **iPhone (Safari):** open the URL → tap the **Share** icon → **Add to
  Home Screen**.

It now opens full-screen with its own icon, no browser address bar — a
real mobile app experience, entirely free to host and run.

---

## 5. How the recommendation engine works (for your judging round)

`js/data.js` holds a reference table of ~22 major Indian crops with
agronomic ranges (temperature, rainfall, soil pH, compatible soil types),
typical cultivation cost/acre, typical yield/acre, and a reference market
price. `js/app.js`'s `computeRecommendations()` scores every crop against
your soil choice + fetched weather using a weighted match:

```
match = 0.35 × soil fit + 0.30 × temperature fit + 0.20 × rainfall fit + 0.15 × in-season bonus
```

then multiplies yield × your land size × price to estimate revenue, and
cost/acre × land size for cost, so profit is specific to your farm size —
not a generic per-crop number.

**To make this judge-ready as a "real" ML feature** rather than a rule
engine, the natural upgrade (mentioned in `data.js`'s header comment) is
to swap in the public **Crop_recommendation.csv** dataset from Kaggle
(2200 labeled rows of N/P/K/temperature/humidity/pH/rainfall → crop) and
run a small k-NN classifier client-side in JavaScript instead of the
hand-written ranges — the app's structure already isolates this in one
function so it's a contained change.

---

## Soil lookup: Ratnagiri talukas and nearby locations

The GPS soil suggestion now checks a fixed, **city/taluka-level** lookup
before its broader district/state fallback. It includes all nine Ratnagiri
taluka headquarters—Mandangad, Dapoli, Khed, Chiplun, Guhagar,
Sangameshwar, Ratnagiri, Lanja and Rajapur—plus Kelshi, Harnai, Dabhol,
Hedavi, Devrukh, Ganpatipule, Jaigad, Purnagad, Nate, Mahad, Poladpur and
Sawantwadi. Each match has a deliberately small GPS radius, so the app
falls back rather than extending a town label across an entire taluka.

The record represents the dominant soil at/around the settlement, not a
parcel-level survey. River valleys and coastal/estuarine strips are mapped
to alluvium or sandy loam where appropriate; plateau/foothill locations
are mapped to laterite or red soil. Tidal lowlands may be saline and must
be tested. Farmers can always change the suggested chip.

Sources used for this classification:

- Maharashtra Gazetteer, [Ratnagiri—Agriculture and Irrigation: Soils](https://gazetteers.maharashtra.gov.in/cultural.maharashtra.gov.in/english/gazetteer/RATNAGIRI/agri_soils.html): dominant lateritic soil; coastal alluvium in Dapoli, Guhagar, Ratnagiri and Rajapur; local salt lands.
- Central Ground Water Board, [Ratnagiri district profile](https://www.cgwb.gov.in/old_website/District_Profile/Maharashtra/Ratnagiri.pdf): coarse/shallow, medium-depth and river-bank deep soils; coastal alluvium and coastal saline soils.
- Maharashtra GSDA, [Ratnagiri district geology](https://gsda.maharashtra.gov.in/en-ratnagir-district/): western laterite plateaus and eastern Deccan basalt distribution.

For a fertilizer or crop decision, use the lookup as a starting point and
confirm pH, EC/salinity, texture and nutrients with a plot-specific soil
test.

---

## Ratnagiri crop suitability guardrail

When GPS reverse-geocoding identifies **Ratnagiri district**, the
recommendation engine applies a hard Konkan suitability rule: **cotton,
sugarcane and jute are excluded**, rather than being allowed to surface
with a low score. It also
adds Mango (Alphonso), Cashew and Finger Millet (Nachni) to the regional
candidate set and gives the district's established crops a modest ranking
preference. The rule is shown above results so it is clear when it applies.

This is based on the Ratnagiri Government's current crop summary (rice,
coconut/areca nut in coastal areas; mango, cashew and millet in hills) and
the Maharashtra Gazetteer's explicit statement that cotton is not grown in
Ratnagiri and that sugarcane/fibre crops are negligible. It is a
district-level safeguard, not a replacement for a
plot-level plan from the local KVK.

---

## 6. File map

```
khetsaathi/
├── index.html          # app shell, all 4 screens
├── manifest.json        # makes it installable (PWA)
├── sw.js                 # offline app-shell caching
├── css/style.css        # design system
├── js/
│   ├── config.js        # ← your two free API keys go here
│   ├── data.js           # crop dataset, translations, disease remedies
│   ├── api.js             # every network call (weather/market/sellers/scan)
│   └── app.js              # UI wiring + recommendation scoring
└── icons/                # home-screen icons
```

---

## 7. Honest limitations to mention to judges

- The agronomic ranges in `data.js` are informed reference figures, not
  official ICAR data — good for a working demo, flagged in-app as
  estimates, upgradeable as described above.
- OpenStreetMap's shop coverage is crowd-sourced, so seller results vary
  by region — this is disclosed to the user in the empty state rather
  than presented as a complete directory.
- Hugging Face's free Inference API has rate limits meant for demos/small
  projects, not production scale — fine for a hackathon, worth noting as
  a "next step: self-host the model" in your pitch.
