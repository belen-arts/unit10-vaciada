import { initMap, searchPlace }               from './map.js'
import { initCanvas, getLines, getZone }       from './lines.js'
import { exportFOLD }                          from './export.js'
import { initFoldPreview, updateFoldPreview }  from './fold-preview.js'
import { initArchive, saveFold, renderArchiveList } from './archive.js'

// ── boot ──────────────────────────────────────────────────────────────────

const map = initMap('map')
initCanvas(map)
initFoldPreview()
initArchive(map)

// ── search ────────────────────────────────────────────────────────────────

const input = document.getElementById('place-input')
const btn   = document.getElementById('search-btn')

async function search() {
  const q = input.value.trim()
  if (!q) return
  btn.textContent = '…'
  await searchPlace(map, q)
  btn.textContent = 'search'
}

btn.addEventListener('click', search)
input.addEventListener('keydown', e => { if (e.key === 'Enter') search() })
input.value = 'Granadilla, Cáceres'
search()

// ── fold preview sync ─────────────────────────────────────────────────────

window.onLinesChanged = () => {
  updateFoldPreview(getZone(), getLines(), map)
}

// ── export ────────────────────────────────────────────────────────────────

document.getElementById('btn-export').addEventListener('click', () => {
  exportFOLD(getZone(), getLines(), map)
})

// ── overlays ──────────────────────────────────────────────────────────────

function openOverlay(id)  { document.getElementById(id).classList.remove('hidden') }
function closeOverlay(id) { document.getElementById(id).classList.add('hidden') }

// open buttons
document.getElementById('btn-instructions').addEventListener('click', () => openOverlay('overlay-instructions'))
document.getElementById('btn-archive').addEventListener('click', () => {
  renderArchiveList()
  openOverlay('overlay-archive')
})

// close buttons (data-close attribute)
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeOverlay(btn.dataset.close))
})

// close on backdrop click
document.querySelectorAll('.overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeOverlay(overlay.id)
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
  // pre-fill community from search bar
  document.getElementById('save-community').value = input.value
  openOverlay('overlay-save')
})

document.getElementById('btn-save-confirm').addEventListener('click', () => {
  const name      = document.getElementById('save-name').value.trim()
  const community = document.getElementById('save-community').value.trim()
  const reason    = document.getElementById('save-reason').value.trim()

  if (!community) {
    alert('Please enter the community name.')
    return
  }

  saveFold({ name, community, reason, zone: getZone(), lines: getLines() })

  // reset form
  document.getElementById('save-name').value      = ''
  document.getElementById('save-community').value = ''
  document.getElementById('save-reason').value    = ''

  closeOverlay('overlay-save')

  // brief confirmation in status bar
  document.getElementById('status').textContent = `fold saved — thank you, ${name || 'anonymous'}`
})

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
  const rowRect = splitRow.getBoundingClientRect()
  const newRight = Math.max(120, Math.min(rowRect.width - 300, rowRect.right - e.clientX))
  rightPanel.style.width = newRight + 'px'
})

window.addEventListener('mouseup', () => {
  if (!isDragging) return
  isDragging = false
  divider.classList.remove('dragging')
  // trigger Three.js resize
  window.dispatchEvent(new Event('resize'))
})