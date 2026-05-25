// ── map.js ────────────────────────────────────────────────────────────────
// Handles Leaflet map setup and place search via Nominatim

const STATUS = document.getElementById('status')

export function initMap(containerId) {
  const map = L.map(containerId, { zoomControl: true })
    .setView([40.1, -6.0], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map)
  return map
}

export async function searchPlace(map, query) {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()

    if (data.length) {
      const { lat, lon, display_name } = data[0]
      map.setView([+lat, +lon], 15)
      const label = display_name.split(',').slice(0, 3).join(',')
      setStatus(label)
    } else {
      setStatus('place not found')
    }
  } catch (err) {
    setStatus('search error')
    console.error(err)
  }
}

export function setStatus(text) {
  STATUS.textContent = text
}