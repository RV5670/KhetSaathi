/* Separate seller-owner portal. Requires the optional Supabase settings in config.js. */
const form = document.getElementById("sellerListingForm");
const locationButton = document.getElementById("shopLocationBtn");
const locationStatus = document.getElementById("shopLocationStatus");
const listingStatus = document.getElementById("listingStatus");
const submitButton = document.getElementById("submitListingBtn");

locationButton.addEventListener("click", async () => {
  locationStatus.innerHTML = '<span class="dot"></span> Getting location…';
  try {
    const { lat, lon } = await getLocation();
    document.getElementById("shopLat").value = lat.toFixed(6);
    document.getElementById("shopLon").value = lon.toFixed(6);
    locationStatus.innerHTML = `<span class="dot live"></span> Location added: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch (error) {
    locationStatus.innerHTML = '<span class="dot"></span> Location permission is needed to list the shop.';
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const lat = Number(document.getElementById("shopLat").value);
  const lon = Number(document.getElementById("shopLon").value);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    listingStatus.textContent = "Add your shop location before submitting.";
    return;
  }
  if (!sellerListingsConfigured()) {
    listingStatus.textContent = "The owner-listing service has not been configured yet. Ask the site administrator to complete the Supabase setup in README.md.";
    return;
  }
  const data = new FormData(form);
  const listing = {
    name: data.get("name").trim(),
    phone: data.get("phone").trim(),
    address: data.get("address").trim(),
    category: data.get("category"),
    lat, lon,
    is_active: true,
  };
  submitButton.disabled = true;
  listingStatus.innerHTML = '<span class="dot"></span> Submitting…';
  try {
    await submitOwnerListing(listing);
    form.reset();
    locationStatus.innerHTML = '<span class="dot"></span> Location not added';
    listingStatus.innerHTML = '<span class="dot live"></span> Submitted. Farmers nearby can now find your shop.';
  } catch (error) {
    listingStatus.textContent = "Could not submit your listing. Please try again shortly.";
  } finally {
    submitButton.disabled = false;
  }
});
