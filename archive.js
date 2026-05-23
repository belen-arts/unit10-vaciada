// ── archive.js ────────────────────────────────────────────────────────────
// Saves fold entries to localStorage and displays them as map markers + list.

const STORAGE_KEY = 'vaciada_archive'

let map         = null
let markers     = []


// ── init ───────────────────────────────────────────────────────────────────

export function initArchive(mapInstance) {
  map = mapInstance
  renderMarkers()
}


// ── save ───────────────────────────────────────────────────────────────────

export function saveFold({ name, community, reason, zone, lines }) {
  const entries = loadEntries()

  const entry = {
    id:        Date.now(),
    name:      name.trim() || 'Anonymous',
    community: community.trim(),
    reason:    reason.trim(),
    date:      new Date().toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' }),
    // store zone centre for map marker
    lat:       (zone.nw.lat + zone.se.lat) / 2,
    lng:       (zone.nw.lng + zone.se.lng) / 2,
    // store full zone + lines for viewing
    zone: {
      nw: { lat: zone.nw.lat, lng: zone.nw.lng },
      se: { lat: zone.se.lat, lng: zone.se.lng }
    },
    lines: lines.map(l => ({
      start: { lat: l.start.lat, lng: l.start.lng },
      end:   { lat: l.end.lat,   lng: l.end.lng },
      angle: l.angle,
      fold:  l.fold
    }))
  }

  entries.push(entry)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  renderMarkers()
  renderArchiveList()
  return entry
}


// ── load ───────────────────────────────────────────────────────────────────

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}


// ── map markers ────────────────────────────────────────────────────────────

function renderMarkers() {
  if (!map) return

  // remove old markers
  markers.forEach(m => m.remove())
  markers = []

  const entries = loadEntries()

  entries.forEach(entry => {
    const el = document.createElement('div')
    el.className = 'archive-marker'
    el.textContent = entry.name

    const marker = L.marker([entry.lat, entry.lng], {
      icon: L.divIcon({
        html: el.outerHTML,
        className: '',
        iconAnchor: [0, 0]
      })
    }).addTo(map)

    marker.on('click', () => showEntry(entry))
    markers.push(marker)
  })
}


// ── archive list ───────────────────────────────────────────────────────────

export function renderArchiveList() {
  const list    = document.getElementById('archive-list')
  const entries = loadEntries()

  if (!entries.length) {
    list.innerHTML = '<p class="empty-msg">no folds saved yet.</p>'
    return
  }

  list.innerHTML = ''
  // newest first
  ;[...entries].reverse().forEach(entry => {
    const item = document.createElement('div')
    item.className = 'archive-item'
    item.innerHTML = `
      <div class="archive-item-name">${entry.name}</div>
      <div class="archive-item-community">${entry.community}</div>
      <div class="archive-item-reason">${entry.reason}</div>
      <div class="archive-item-date">${entry.date}</div>
    `
    item.addEventListener('click', () => {
      closeOverlay('overlay-archive')
      showEntry(entry)
      if (map) map.setView([entry.lat, entry.lng], 14)
    })
    list.appendChild(item)
  })
}


// ── view entry ─────────────────────────────────────────────────────────────

function showEntry(entry) {
  document.getElementById('view-title').textContent     = entry.name
  document.getElementById('view-community').textContent = entry.community
  document.getElementById('view-reason').textContent    = entry.reason
  document.getElementById('view-date').textContent      = entry.date
  openOverlay('overlay-view')
}


// ── helpers ────────────────────────────────────────────────────────────────

function openOverlay(id)  { document.getElementById(id).classList.remove('hidden') }
function closeOverlay(id) { document.getElementById(id).classList.add('hidden') }