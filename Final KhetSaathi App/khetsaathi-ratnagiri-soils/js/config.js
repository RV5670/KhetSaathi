/* ============================================================
   KISAN MITRA — config.js
   The ONLY file you need to edit to wire up your own free API keys.
   Full step-by-step instructions for getting each key are in README.md.
   The app works without either key — it just falls back to
   reference/offline data — so you can deploy immediately and
   add keys later.
   ============================================================ */

const CONFIG = {
  // Free key from https://data.gov.in/user/register — powers live mandi
  // (market) prices. Without it, the app uses the reference prices
  // baked into js/data.js.
  DATA_GOV_IN_API_KEY: "PASTE_YOUR_FREE_KEY_HERE",

  // Token from https://huggingface.co/settings/tokens — powers the plant
  // disease photo scanner. The token needs the “Make calls to Inference
  // Providers” permission. Without it, the scanner shows setup guidance.
  HF_TOKEN: "PASTE_YOUR_FREE_HF_TOKEN_HERE",

  // Which Hugging Face model to call for disease classification.
  // This is a free, public model trained on the PlantVillage dataset
  // (38 classes across 14 crop species). You can swap in any other
  // image-classification model id from huggingface.co/models.
  HF_DISEASE_MODEL: "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification",

  // Optional: free Supabase project for seller-owner self-listing.
  // Leave both values as-is to keep owner listings disabled (OpenStreetMap
  // results still work). Setup SQL and exact steps are in README.md.
  SUPABASE_URL: "PASTE_YOUR_SUPABASE_PROJECT_URL",
  SUPABASE_ANON_KEY: "PASTE_YOUR_SUPABASE_ANON_KEY",
};
