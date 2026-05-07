import { initMap, searchPlace } from './map.js'
import { initCanvas }           from './lines.js'

// ── boot ──────────────────────────────────────────────────────────────────

const map = initMap('map')
initCanvas(map)

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

// load Granadilla on start
input.value = 'Granadilla, Cáceres'
search()