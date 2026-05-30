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

document.getElementById('btn-about').addEventListener('click',        () => openOverlay('overlay-about'))
document.getElementById('btn-instructions').addEventListener('click', () => openOverlay('overlay-instructions'))
document.getElementById('btn-archive').addEventListener('click', () => {
  renderArchiveList()
  openOverlay('overlay-archive')
})
document.getElementById('btn-feedback').addEventListener('click', () => {
  renderFeedbackList()
  openOverlay('overlay-feedback')
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

// ── shake helper ──────────────────────────────────────────────────────────

function shakeField(el) {
  el.classList.add('field-error', 'shake')
  el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true })
  el.addEventListener('input', () => el.classList.remove('field-error'), { once: true })
}

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
  const nameEl      = document.getElementById('save-name')
  const communityEl = document.getElementById('save-community')
  const reasonEl    = document.getElementById('save-reason')

  const name      = nameEl.value.trim()
  const community = communityEl.value.trim()
  const reason    = reasonEl.value.trim()

  let valid = true
  if (!name)      { shakeField(nameEl);      valid = false }
  if (!community) { shakeField(communityEl); valid = false }
  if (!reason)    { shakeField(reasonEl);    valid = false }
  if (!valid) return

  closeOverlay('overlay-save')

  saveFold({ name, community, reason, colour: selectedColour, zone: getZone(), lines: getLines() })

  nameEl.value      = ''
  communityEl.value = ''
  reasonEl.value    = ''
  nameEl.classList.remove('field-error')
  communityEl.classList.remove('field-error')
  reasonEl.classList.remove('field-error')

  document.getElementById('status').textContent = `fold saved — thank you, ${name}`
  resetAll()
  clearFoldPreview()
  document.getElementById('fold-slider').value = 0
  document.getElementById('fold-pct').textContent = '0%'
})

// ── close fold ────────────────────────────────────────────────────────────

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

// ── feedback ──────────────────────────────────────────────────────────────

const FEEDBACK_KEY = 'vaciada_feedback'

function loadFeedback() {
  try { return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]') } catch { return [] }
}

function saveFeedbackEntry({ name, message }) {
  const entries = loadFeedback()
  entries.push({
    name:    name.trim() || 'Anonymous',
    message: message.trim(),
    date:    new Date().toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' })
  })
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(entries))
}

function renderFeedbackList() {
  const list    = document.getElementById('feedback-list')
  const entries = loadFeedback()

  if (!entries.length) {
    list.innerHTML = '<p class="empty-msg">no feedback yet, be the first!</p>'
    return
  }

  list.innerHTML = ''
  ;[...entries].reverse().forEach(entry => {
    const item = document.createElement('div')
    item.className = 'feedback-item'
    item.innerHTML = `
      <div class="feedback-name">${entry.name}</div>
      <div class="feedback-message">${entry.message}</div>
      <div class="feedback-date">${entry.date}</div>
    `
    list.appendChild(item)
  })
}

document.getElementById('btn-feedback-confirm').addEventListener('click', () => {
  const nameEl    = document.getElementById('feedback-name')
  const messageEl = document.getElementById('feedback-message')

  const name    = nameEl.value.trim()
  const message = messageEl.value.trim()

  if (!message) { shakeField(messageEl); return }

  saveFeedbackEntry({ name, message })

  nameEl.value    = ''
  messageEl.value = ''
  messageEl.classList.remove('field-error')

  closeOverlay('overlay-feedback')
  document.getElementById('status').textContent = 'feedback received — thank you'
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