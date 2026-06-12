async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'painted-near-you' }
  });
  const data = await res.json();
  if (!data || data.length === 0) throw new Error("Address not found. Try a city name instead.");
  const addr = data[0].address;
  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    neighborhood: addr.neighbourhood || addr.suburb || null,
    city: addr.city || addr.town || addr.village || null,
    county: addr.county || null,
    state: addr.state || null,
    country: addr.country || null
  };
}

async function searchMetForPainting(query) {
  const url = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&medium=Paintings&q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.objectIDs || data.objectIDs.length === 0) return null;

  // shuffle and try up to 15 to find one with an image
  const candidates = data.objectIDs.sort(() => Math.random() - 0.5).slice(0, 15);
  for (const id of candidates) {
    const objRes = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
    const obj = await objRes.json();
    if (obj.primaryImageSmall && obj.primaryImageSmall !== '') {
      return { painting: obj, searchTerm: query };
    }
  }
  return null;
}

async function findPainting(location) {
  // try progressively broader search terms
  const searchTerms = [
    location.neighborhood,
    location.city,
    location.county,
    location.state,
    location.country
  ].filter(Boolean);

  for (const term of searchTerms) {
    const result = await searchMetForPainting(term);
    if (result) return result;
  }
  return null;
}

function buildCaption(searchTerm, painting) {
  const place = searchTerm;
  const artist = painting.artistDisplayName || 'An unknown artist';
  const date = painting.objectDate || 'an unknown date';
  return `${artist} painted this in ${date} — a place that shares its name with somewhere near you.`;
}

async function run() {
  const address = document.getElementById('address').value.trim();
  if (!address) return;

  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const result = document.getElementById('result');

  loading.style.display = 'block';
  loading.textContent = 'Looking up your location...';
  error.style.display = 'none';
  result.style.display = 'none';

  try {
    const location = await geocode(address);

    loading.textContent = 'Searching for a painting near you...';

    const found = await findPainting(location);

    if (!found) {
      throw new Error("No painting found for your area. Try a nearby city or region.");
    }

    const { painting, searchTerm } = found;

    const locationParts = [location.city, location.state, location.country].filter(Boolean);
    document.getElementById('location-display').textContent =
      `Searching near: ${locationParts.join(', ')} — matched on "${searchTerm}"`;

    document.getElementById('painting-img').src = painting.primaryImageSmall;
    document.getElementById('painting-img').alt = painting.title;
    document.getElementById('painting-title').textContent = painting.title;
    document.getElementById('painting-artist').textContent = painting.artistDisplayName || 'Unknown artist';
    document.getElementById('painting-date').textContent = painting.objectDate || '';
    document.getElementById('painting-caption').textContent = buildCaption(searchTerm, painting);

    loading.style.display = 'none';
    result.style.display = 'block';

  } catch (err) {
    loading.style.display = 'none';
    error.style.display = 'block';
    error.textContent = err.message;
  }
}
