// ── archive.js ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vaciada_archive'

let map        = null
let markers    = []
let onLoadFold = null
let activeEntryId = null  // id of fold currently being viewed


// ── init ───────────────────────────────────────────────────────────────────

export function initArchive(mapInstance, loadFoldCallback) {
  map        = mapInstance
  onLoadFold = loadFoldCallback
  renderMarkers()
}


// ── save ───────────────────────────────────────────────────────────────────

export function saveFold({ name, community, reason, colour, zone, lines }) {
  const entries = loadEntries()

  const entry = {
    id:        Date.now(),
    name:      name.trim() || 'Anonymous',
    community: community.trim(),
    reason:    reason.trim(),
    colour:    colour || '#c0392b',
    date:      new Date().toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' }),
    lat:       (zone.nw.lat + zone.se.lat) / 2,
    lng:       (zone.nw.lng + zone.se.lng) / 2,
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

export function renderMarkers() {
  if (!map) return

  markers.forEach(m => m.remove())
  markers = []

  const entries = loadEntries()

  entries.forEach(entry => {
    const colour = entry.colour || '#c0392b'

    const marker = L.marker([entry.lat, entry.lng], {
      icon: L.divIcon({
        html: `<div style="
          width: 28px;
          height: 28px;
          background: ${colour};
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          cursor: pointer;
        "></div>`,
        className:  '',
        iconSize:   [28, 28],
        iconAnchor: [14, 14]
      })
    }).addTo(map)

    marker.on('click', () => showEntry(entry))

    // hide if currently being viewed
    if (activeEntryId === entry.id) {
      marker.setOpacity(0)
    }

    markers.push({ marker, id: entry.id })
  })
}

// hide the pin for the entry being viewed
export function hideMarker(entryId) {
  activeEntryId = entryId
  markers.forEach(m => {
    if (m.id === entryId) m.marker.setOpacity(0)
  })
}

// restore all pins
export function showAllMarkers() {
  activeEntryId = null
  markers.forEach(m => m.marker.setOpacity(1))
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
  ;[...entries].reverse().forEach(entry => {
    const colour = entry.colour || '#c0392b'
    const item   = document.createElement('div')
    item.className = 'archive-item'
    item.innerHTML = `
      <div class="archive-pin-dot" style="background:${colour}"></div>
      <div class="archive-item-content">
        <div class="archive-item-name">${entry.name}</div>
        <div class="archive-item-community">${entry.community}</div>
        <div class="archive-item-reason">${entry.reason}</div>
        <div class="archive-item-date">${entry.date}</div>
        <button class="see-fold-btn" style="border-color:${colour};color:${colour}">see this fold →</button>
      </div>
    `
    item.querySelector('.see-fold-btn').addEventListener('click', e => {
      e.stopPropagation()
      closeOverlay('overlay-archive')
      triggerLoadFold(entry)
    })
    item.addEventListener('click', () => {
      closeOverlay('overlay-archive')
      showEntry(entry)
      if (map) map.setView([entry.lat, entry.lng], 14)
    })
    list.appendChild(item)
  })
}


// ── show entry popup ───────────────────────────────────────────────────────

function showEntry(entry) {
  const colour = entry.colour || '#c0392b'

  document.getElementById('view-title').textContent     = entry.name
  document.getElementById('view-community').textContent = entry.community
  document.getElementById('view-reason').textContent    = entry.reason
  document.getElementById('view-date').textContent      = entry.date

  const seeFoldBtn = document.getElementById('view-see-fold')
  seeFoldBtn.style.borderColor = colour
  seeFoldBtn.style.color       = colour
  seeFoldBtn._entry            = entry

  openOverlay('overlay-view')
}


// ── load fold ─────────────────────────────────────────────────────────────

function triggerLoadFold(entry) {
  if (!onLoadFold) return
  closeOverlay('overlay-view')
  hideMarker(entry.id)
  if (map) map.setView([entry.lat, entry.lng], 15)
  onLoadFold(entry)
}


// ── helpers ────────────────────────────────────────────────────────────────

function openOverlay(id)  { document.getElementById(id).classList.remove('hidden') }
function closeOverlay(id) { document.getElementById(id).classList.add('hidden') }

export function initViewFoldButton() {
  const btn = document.getElementById('view-see-fold')
  if (!btn) return
  btn.addEventListener('click', () => {
    if (btn._entry) triggerLoadFold(btn._entry)
  })
}