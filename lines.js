// ── lines.js ──────────────────────────────────────────────────────────────
// Handles canvas overlay, centre point, and radiating fold/crease lines

import { setStatus } from './map.js'

const canvas  = document.getElementById('canvas')
const ctx     = canvas.getContext('2d')

const btnPan    = document.getElementById('btn-pan')
const btnCentre = document.getElementById('btn-centre')
const btnDraw   = document.getElementById('btn-draw')
const clearBtn  = document.getElementById('clear-btn')
const linesList = document.getElementById('lines-list')

let map       = null
let mode      = 'pan'
let centre    = null   // Leaflet LatLng
let lines     = []     // [{ end: LatLng, angle: Number }]
let previewPt = null   // { x, y } canvas coords while hovering

// ── init ───────────────────────────────────────────────────────────────────

export function initCanvas(mapInstance) {
  map = mapInstance

  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  map.on('move zoom moveend zoomend', redraw)

  canvas.addEventListener('click',      onCanvasClick)
  canvas.addEventListener('mousemove',  onCanvasMove)
  canvas.addEventListener('mouseleave', onCanvasLeave)

  btnPan.addEventListener('click',    () => setMode('pan'))
  btnCentre.addEventListener('click', () => setMode('centre'))
  btnDraw.addEventListener('click',   () => {
    if (!centre) { setStatus('set a centre point first'); return }
    setMode('draw')
  })

  clearBtn.addEventListener('click', () => {
    lines = []
    renderList()
    redraw()
  })
}

// ── canvas sizing ──────────────────────────────────────────────────────────

function resizeCanvas() {
  const wrap = document.getElementById('map-wrap')
  canvas.width  = wrap.offsetWidth
  canvas.height = wrap.offsetHeight
  redraw()
}

// ── coordinate helpers ─────────────────────────────────────────────────────

function llToCanvas(ll) {
  const p = map.latLngToContainerPoint(ll)
  return { x: p.x, y: p.y }
}

function canvasToLL(x, y) {
  return map.containerPointToLatLng(L.point(x, y))
}

function getXY(e) {
  const rect = canvas.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function angleDeg(x1, y1, x2, y2) {
  let a = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
  a = ((a % 360) + 360) % 360
  return Math.round(a * 10) / 10
}

// ── mode ───────────────────────────────────────────────────────────────────

function setMode(m) {
  mode = m

  btnPan.classList.toggle('active',    m === 'pan')
  btnCentre.classList.toggle('active', m === 'centre')
  btnDraw.classList.toggle('active',   m === 'draw')

  canvas.classList.remove('mode-centre', 'mode-draw')
  if (m === 'centre') canvas.classList.add('mode-centre')
  if (m === 'draw')   canvas.classList.add('mode-draw')

  if (m === 'pan') map.dragging.enable()
  else             map.dragging.disable()
}

// ── canvas events ──────────────────────────────────────────────────────────

function onCanvasClick(e) {
  const { x, y } = getXY(e)

  if (mode === 'centre') {
    centre = canvasToLL(x, y)
    setStatus('centre set')
    setMode('pan')
    redraw()

  } else if (mode === 'draw' && centre) {
    const end   = canvasToLL(x, y)
    const cp    = llToCanvas(centre)
    const angle = angleDeg(cp.x, cp.y, x, y)
    lines.push({ end, angle })
    previewPt = null
    redraw()
    renderList()
  }
}

function onCanvasMove(e) {
  if (mode !== 'draw') return
  previewPt = getXY(e)
  redraw()
}

function onCanvasLeave() {
  previewPt = null
  redraw()
}

// ── drawing ────────────────────────────────────────────────────────────────

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!centre) return

  const cp = llToCanvas(centre)

  // committed lines
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth   = 1.5
  ctx.setLineDash([])
  lines.forEach(l => {
    const ep = llToCanvas(l.end)
    ctx.beginPath()
    ctx.moveTo(cp.x, cp.y)
    ctx.lineTo(ep.x, ep.y)
    ctx.stroke()
  })

  // preview line
  if (mode === 'draw' && previewPt) {
    ctx.strokeStyle = '#c0392b'
    ctx.lineWidth   = 1
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(cp.x, cp.y)
    ctx.lineTo(previewPt.x, previewPt.y)
    ctx.stroke()
    ctx.setLineDash([])

    const ang = angleDeg(cp.x, cp.y, previewPt.x, previewPt.y)
    ctx.fillStyle = '#c0392b'
    ctx.font      = '11px "IBM Plex Mono", monospace'
    ctx.fillText(ang + '°', previewPt.x + 8, previewPt.y - 6)
  }

  // centre dot
  ctx.setLineDash([])
  ctx.fillStyle   = '#c0392b'
  ctx.beginPath()
  ctx.arc(cp.x, cp.y, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth   = 1.5
  ctx.beginPath()
  ctx.arc(cp.x, cp.y, 5, 0, Math.PI * 2)
  ctx.stroke()
}

// ── sidebar list ───────────────────────────────────────────────────────────

function renderList() {
  if (!lines.length) {
    linesList.innerHTML = '<p class="empty-msg">no lines yet.</p>'
    return
  }

  linesList.innerHTML = lines.map((l, i) => `
    <div class="line-item">
      <span class="line-angle" title="click to copy" data-angle="${l.angle}">${l.angle}°</span>
      <button class="del-btn" data-index="${i}">×</button>
    </div>
  `).join('')

  linesList.querySelectorAll('.line-angle').forEach(el => {
    el.addEventListener('click', () => {
      if (navigator.clipboard) navigator.clipboard.writeText(el.dataset.angle)
    })
  })

  linesList.querySelectorAll('.del-btn').forEach(el => {
    el.addEventListener('click', () => {
      lines.splice(+el.dataset.index, 1)
      renderList()
      redraw()
    })
  })
}

// ── public getters (for use in weave.js later) ─────────────────────────────

export function getLines()  { return lines }
export function getCentre() { return centre }