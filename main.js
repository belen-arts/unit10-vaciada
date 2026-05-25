import { initMap, searchPlace }                       from './map.js'
import { initCanvas, getLines, getZone, loadFold,
         hasActiveWork, resetAll }                     from './lines.js'
import { initFoldPreview, updateFoldPreview,
         clearFoldPreview }                            from './fold-preview.js'
import { initArchive, saveFold, renderArchiveList,
         initViewFoldButton, showAllMarkers }          from './archive.js'

// ── boot ──────────────────────────────────────────────────────────────────

const map = initMap('map')
initCanvas(map)
initFoldPreview()
initArchive(map, handleLoadFold)
initViewFoldButton()

// ── overlay helpers ───────────────────────────────────────────────────────

function openOverlay(id)  { document.getElementById(id).classList.remove('hidden') }
function closeOverlay(id) { document.getElementById(id).classList.add('hidden') }

// ── hide close-fold on start ──────────────────────────────────────────────

document.getElementById('btn-close-fold').style.display = 'none'

// ── search ────────────────────────────────────────────────────────────────

const input     = document.getElementById('place-input')
const searchBtn = document.getElementById('search-btn')

async function search() {
  const q = input.value.trim()
  if (!q) return
  searchBtn.textContent = '…'
  await searchPlace(map, q)
  searchBtn.textContent = 'search'
}

searchBtn.addEventListener('click', search)
input.addEventListener('keydown', e => { if (e.key === 'Enter') search() })
input.value = 'Granadilla, Cáceres'
search()

// ── fold preview sync ─────────────────────────────────────────────────────

window.onLinesChanged = () => {
  updateFoldPreview(getZone(), getLines(), map)
}

// ── fold slider ───────────────────────────────────────────────────────────

document.getElementById('fold-slider').addEventListener('input', e => {
  document.getElementById('fold-pct').textContent = e.target.value + '%'
})

// ── nav overlays ──────────────────────────────────────────────────────────

document.getElementById('btn-instructions').addEventListener('click', () => openOverlay('overlay-instructions'))

document.getElementById('btn-archive').addEventListener('click', () => {
  renderArchiveList()
  openOverlay('overlay-archive')
})

document.querySelectorAll('[data-close]').forEach(b => {
  b.addEventListener('click', () => closeOverlay(b.dataset.close))
})

document.querySelectorAll('.overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeOverlay(overlay.id)
  })
})

// ── colour picker ─────────────────────────────────────────────────────────

let selectedColour = '#c0392b'

document.querySelectorAll('.colour-opt').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.colour-opt').forEach(x => x.classList.remove('selected'))
    b.classList.add('selected')
    selectedColour = b.dataset.colour
  })
})

// ── save fold ─────────────────────────────────────────────────────────────

document.getElementById('btn-save').addEventListener('click', () => {
  const zone  = getZone()
  const lines = getLines()
  if (!zone || lines.length === 0) {
    alert('Draw a zone and at least one fold line before saving.')
    return
  }
  document.getElementById('save-community').value = input.value
  openOverlay('overlay-save')
})

document.getElementById('btn-save-confirm').addEventListener('click', () => {
  const name      = document.getElementById('save-name').value.trim()
  const community = document.getElementById('save-community').value.trim()
  const reason    = document.getElementById('save-reason').value.trim()

  if (!community) {
    document.getElementById('save-community').style.borderColor = '#c0392b'
    document.getElementById('save-community').focus()
    return
  }

  // close overlay immediately
  closeOverlay('overlay-save')

  // save to archive
  saveFold({
    name,
    community,
    reason,
    colour: selectedColour,
    zone:   getZone(),
    lines:  getLines()
  })

  // reset form fields
  document.getElementById('save-name').value            = ''
  document.getElementById('save-community').value       = ''
  document.getElementById('save-reason').value          = ''
  document.getElementById('save-community').style.borderColor = ''

  document.getElementById('status').textContent = `fold saved — thank you, ${name || 'anonymous'}`

  // clear map drawing and simulation
  resetAll()
  clearFoldPreview()

  // reset slider
  document.getElementById('fold-slider').value = 0
  document.getElementById('fold-pct').textContent = '0%'
})

// ── close fold (when viewing someone else's) ──────────────────────────────

function closeFold() {
  showAllMarkers()
  resetAll()
  clearFoldPreview()
  document.getElementById('fold-slider').value = 0
  document.getElementById('fold-pct').textContent = '0%'
}

document.getElementById('btn-close-fold').addEventListener('click', closeFold)
window.onCloseFold = closeFold

// ── start-own warning ─────────────────────────────────────────────────────

window.showStartOwnWarning = () => openOverlay('overlay-start-own')

document.getElementById('btn-start-own-confirm').addEventListener('click', () => {
  closeOverlay('overlay-start-own')
  showAllMarkers()
  resetAll()
  clearFoldPreview()
})

// ── load fold from archive ────────────────────────────────────────────────

let pendingFoldEntry = null

function handleLoadFold(entry) {
  closeOverlay('overlay-view')
  if (hasActiveWork()) {
    pendingFoldEntry = entry
    openOverlay('overlay-warning')
  } else {
    doLoadFold(entry)
  }
}

document.getElementById('btn-warning-confirm').addEventListener('click', () => {
  closeOverlay('overlay-warning')
  if (pendingFoldEntry) {
    doLoadFold(pendingFoldEntry)
    pendingFoldEntry = null
  }
})

function doLoadFold(entry) {
  loadFold(entry)
  document.getElementById('fold-slider').value = 0
  document.getElementById('fold-pct').textContent = '0%'
  map.setView([entry.lat, entry.lng], 15)
}

// ── resizable divider ─────────────────────────────────────────────────────

const divider    = document.getElementById('divider')
const splitRow   = document.getElementById('split-row')
const rightPanel = document.getElementById('right-panel')

let isDragging = false

divider.addEventListener('mousedown', e => {
  isDragging = true
  divider.classList.add('dragging')
  e.preventDefault()
})

window.addEventListener('mousemove', e => {
  if (!isDragging) return
  const rowRect  = splitRow.getBoundingClientRect()
  const newRight = Math.max(200, Math.min(rowRect.width - 300, rowRect.right - e.clientX))
  rightPanel.style.width = newRight + 'px'
})

window.addEventListener('mouseup', () => {
  if (!isDragging) return
  isDragging = false
  divider.classList.remove('dragging')
  window.dispatchEvent(new Event('resize'))
})