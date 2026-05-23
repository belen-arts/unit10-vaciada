import { initMap, searchPlace }            from './map.js'
import { initCanvas, getLines, getZone }   from './lines.js'
import { exportFOLD }                      from './export.js'
import { initFoldPreview, updateFoldPreview } from './fold-preview.js'

// ── boot ──────────────────────────────────────────────────────────────────

const map = initMap('map')
initCanvas(map)
initFoldPreview()

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

// ── export ────────────────────────────────────────────────────────────────

document.getElementById('btn-export').addEventListener('click', () => {
  exportFOLD(getZone(), getLines(), map)
})

// ── fold preview sync ─────────────────────────────────────────────────────
// Called by lines.js whenever lines change — exposed on window so lines.js
// can call it without a circular import

window.onLinesChanged = () => {
  updateFoldPreview(getZone(), getLines(), map)
}