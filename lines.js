// ── lines.js ──────────────────────────────────────────────────────────────

import { setStatus } from './map.js'

const canvas  = document.getElementById('canvas')
const ctx     = canvas.getContext('2d')

const btnPan       = document.getElementById('btn-pan')
const btnZone      = document.getElementById('btn-zone')
const btnDraw      = document.getElementById('btn-draw')
const btnClearZone = document.getElementById('btn-clear-zone')
const btnSave      = document.getElementById('btn-save')
const btnCloseFold = document.getElementById('btn-close-fold')
const clearBtn     = document.getElementById('clear-btn')
const linesList    = document.getElementById('lines-list')

let map        = null
let mode       = 'pan'
let isReadOnly = false

let zoneBounds = null
let zoneFirst  = null
let previewPt  = null
let lines      = []
let lineStart  = null


// ── init ───────────────────────────────────────────────────────────────────

export function initCanvas(mapInstance) {
  map = mapInstance

  resizeCanvas()
  window.addEventListener('resize', () => { resizeCanvas(); redraw() })
  map.on('move zoom moveend zoomend', redraw)

  const container = map.getContainer()
  container.addEventListener('mousemove',  onMouseMove)
  container.addEventListener('mouseleave', onMouseLeave)
  container.addEventListener('click',      onContainerClick)

  btnPan.addEventListener('click', () => setMode('pan'))

  btnZone.addEventListener('click', () => {
    if (isReadOnly) {
      exitReadOnly()
      return
    }
    if (zoneBounds) { setStatus('clear zone first to redraw'); return }
    setMode('zone')
  })

  btnDraw.addEventListener('click', () => {
    if (isReadOnly) {
      setStatus('viewing someone else\'s fold — click "draw zone" to start your own')
      return
    }
    if (!zoneBounds) { setStatus('draw a zone first'); return }
    setMode('draw')
  })

  btnClearZone.addEventListener('click', () => {
    if (isReadOnly) {
      window.showStartOwnWarning?.()
      return
    }
    resetAll()
  })

  btnCloseFold?.addEventListener('click', () => {
    window.onCloseFold?.()
  })

  clearBtn.addEventListener('click', () => {
    if (isReadOnly) {
      window.showStartOwnWarning?.()
      return
    }
    lines     = []
    lineStart = null
    renderList()
    redraw()
    window.onLinesChanged?.()
  })
}


// ── read-only mode ─────────────────────────────────────────────────────────

function setReadOnlyUI(on) {
  // hide save fold, show close fold when read-only
  if (btnSave)      btnSave.style.display      = on ? 'none'  : ''
  if (btnCloseFold) btnCloseFold.style.display  = on ? ''      : 'none'
}

function exitReadOnly() {
  isReadOnly = false
  zoneBounds = null
  zoneFirst  = null
  lines      = []
  lineStart  = null
  setReadOnlyUI(false)
  renderList()
  window.onLinesChanged?.()
  setMode('zone')
}


// ── load a saved fold from archive ─────────────────────────────────────────

export function loadFold(entry) {
  zoneBounds = {
    nw: L.latLng(entry.zone.nw.lat, entry.zone.nw.lng),
    se: L.latLng(entry.zone.se.lat, entry.zone.se.lng)
  }

  lines = entry.lines.map(l => ({
    start: L.latLng(l.start.lat, l.start.lng),
    end:   L.latLng(l.end.lat,   l.end.lng),
    angle: l.angle,
    fold:  l.fold
  }))

  isReadOnly = true
  lineStart  = null
  previewPt  = null

  setReadOnlyUI(true)
  setMode('pan')
  renderList()
  redraw()
  window.onLinesChanged?.()

  setStatus(`viewing ${entry.name}'s fold — "close fold" to return`)
}

export function resetAll() {
  isReadOnly = false
  zoneBounds = null
  zoneFirst  = null
  lines      = []
  lineStart  = null
  previewPt  = null
  setReadOnlyUI(false)
  renderList()
  setStatus('no zone set')
  map.dragging.enable()
  setMode('pan')
  redraw()
  window.onLinesChanged?.()
}

export function hasActiveWork() {
  return (zoneBounds !== null || lines.length > 0)
}


// ── canvas sizing ──────────────────────────────────────────────────────────

function resizeCanvas() {
  const wrap = document.getElementById('map-wrap')
  canvas.width  = wrap.offsetWidth
  canvas.height = wrap.offsetHeight
}


// ── coordinate helpers ─────────────────────────────────────────────────────

function getXY(e) {
  const rect = canvas.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function xyToLL(x, y) {
  return map.containerPointToLatLng(L.point(x, y))
}

function llToXY(ll) {
  const p = map.latLngToContainerPoint(ll)
  return { x: p.x, y: p.y }
}

function getZoneRect() {
  if (!zoneBounds) return null
  const nw = llToXY(zoneBounds.nw)
  const se = llToXY(zoneBounds.se)
  return { x: nw.x, y: nw.y, w: se.x - nw.x, h: se.y - nw.y }
}

function rectFromPoints(x1, y1, x2, y2) {
  return {
    x: Math.min(x1, x2), y: Math.min(y1, y2),
    w: Math.abs(x2 - x1), h: Math.abs(y2 - y1)
  }
}

const SNAP_THRESHOLD = 16

function snapToEdge(x, y, r) {
  const dLeft   = Math.abs(x - r.x)
  const dRight  = Math.abs(x - (r.x + r.w))
  const dTop    = Math.abs(y - r.y)
  const dBottom = Math.abs(y - (r.y + r.h))
  const minD    = Math.min(dLeft, dRight, dTop, dBottom)
  const cx      = Math.max(r.x, Math.min(r.x + r.w, x))
  const cy      = Math.max(r.y, Math.min(r.y + r.h, y))
  if (minD === dLeft)   return { x: r.x,       y: cy }
  if (minD === dRight)  return { x: r.x + r.w, y: cy }
  if (minD === dTop)    return { x: cx,         y: r.y }
  return                       { x: cx,         y: r.y + r.h }
}

function nearEdge(x, y, r) {
  if (!r) return false
  const nearLeft   = Math.abs(x - r.x)         < SNAP_THRESHOLD && y >= r.y && y <= r.y + r.h
  const nearRight  = Math.abs(x - (r.x + r.w)) < SNAP_THRESHOLD && y >= r.y && y <= r.y + r.h
  const nearTop    = Math.abs(y - r.y)          < SNAP_THRESHOLD && x >= r.x && x <= r.x + r.w
  const nearBottom = Math.abs(y - (r.y + r.h))  < SNAP_THRESHOLD && x >= r.x && x <= r.x + r.w
  return nearLeft || nearRight || nearTop || nearBottom
}

function angleDeg(x1, y1, x2, y2) {
  let a = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
  a = ((a % 360) + 360) % 360
  return Math.round(a * 10) / 10
}


// ── mode ───────────────────────────────────────────────────────────────────

function setMode(m) {
  mode = m

  btnPan.classList.toggle('active',  m === 'pan')
  btnZone.classList.toggle('active', m === 'zone')
  btnDraw.classList.toggle('active', m === 'draw')

  zoneFirst = null
  lineStart = null
  previewPt = null

  map.dragging.enable()

  if (m === 'zone' || m === 'draw') {
    map.getContainer().style.cursor = 'crosshair'
  } else {
    map.getContainer().style.cursor = ''
  }

  redraw()
}


// ── mouse events ───────────────────────────────────────────────────────────

function onMouseMove(e) {
  if (mode === 'pan' || isReadOnly) return
  previewPt = getXY(e)
  redraw()
}

function onMouseLeave() {
  previewPt = null
  redraw()
}

function onContainerClick(e) {
  if (isReadOnly) return
  const { x, y } = getXY(e)

  if (mode === 'zone') {
    if (!zoneFirst) {
      zoneFirst = xyToLL(x, y)
      setStatus('click second corner to complete the zone')
      redraw()
    } else {
      const p1 = llToXY(zoneFirst)
      const r  = rectFromPoints(p1.x, p1.y, x, y)
      if (r.w > 10 && r.h > 10) {
        zoneBounds = {
          nw: xyToLL(Math.min(p1.x, x), Math.min(p1.y, y)),
          se: xyToLL(Math.max(p1.x, x), Math.max(p1.y, y))
        }
        zoneFirst = null
        lines     = []
        lineStart = null
        renderList()
        setStatus('zone set — click an edge to start a fold line')
        setMode('draw')
      } else {
        zoneFirst = null
        setStatus('zone too small — click first corner again')
      }
      redraw()
    }
    return
  }

  if (mode === 'draw' && zoneBounds) {
    const r = getZoneRect()
    if (!nearEdge(x, y, r)) {
      setStatus('click on the zone edge to place a line endpoint')
      return
    }
    const snapped = snapToEdge(x, y, r)
    const ll      = xyToLL(snapped.x, snapped.y)
    if (!lineStart) {
      lineStart = ll
      setStatus('now click the opposite edge for the second point')
      redraw()
    } else {
      const p1    = llToXY(lineStart)
      const p2    = llToXY(ll)
      const angle = angleDeg(p1.x, p1.y, p2.x, p2.y)
      lines.push({ start: lineStart, end: ll, angle, fold: 'M' })
      lineStart = null
      previewPt = null
      setStatus('line added — toggle M/V in sidebar, or add next line')
      renderList()
      redraw()
      window.onLinesChanged?.()
    }
  }
}


// ── drawing ────────────────────────────────────────────────────────────────

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (mode === 'zone' && zoneFirst && previewPt) {
    const p1 = llToXY(zoneFirst)
    const r  = rectFromPoints(p1.x, p1.y, previewPt.x, previewPt.y)
    ctx.save()
    ctx.strokeStyle = '#c0392b'
    ctx.lineWidth   = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(r.x, r.y, r.w, r.h)
    ctx.fillStyle = 'rgba(192,57,43,0.06)'
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.setLineDash([])
    ctx.fillStyle = '#c0392b'
    ctx.beginPath()
    ctx.arc(p1.x, p1.y, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const r = getZoneRect()
  if (r) {
    ctx.save()
    ctx.strokeStyle = isReadOnly ? '#888' : '#1a1a1a'
    ctx.lineWidth   = isReadOnly ? 1 : 2
    ctx.setLineDash(isReadOnly ? [6, 4] : [])
    ctx.strokeRect(r.x, r.y, r.w, r.h)
    ctx.fillStyle = isReadOnly ? 'rgba(0,0,0,0.01)' : 'rgba(26,26,26,0.02)'
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.restore()
  }

  lines.forEach(l => {
    const p1 = llToXY(l.start)
    const p2 = llToXY(l.end)
    ctx.save()
    ctx.strokeStyle = l.fold === 'M' ? '#c0392b' : '#2563a8'
    ctx.lineWidth   = isReadOnly ? 1.5 : 2
    ctx.globalAlpha = isReadOnly ? 0.6 : 1
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.stroke()
    ctx.restore()
  })

  if (lineStart) {
    const p = llToXY(lineStart)
    ctx.save()
    ctx.fillStyle = '#c0392b'
    ctx.beginPath()
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  if (mode === 'draw' && previewPt && r && nearEdge(previewPt.x, previewPt.y, r)) {
    const snapped = snapToEdge(previewPt.x, previewPt.y, r)
    ctx.save()
    ctx.strokeStyle = '#c0392b'
    ctx.lineWidth   = 2
    ctx.beginPath()
    ctx.arc(snapped.x, snapped.y, 6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  if (mode === 'draw' && lineStart && previewPt && r) {
    const p1      = llToXY(lineStart)
    const snapped = nearEdge(previewPt.x, previewPt.y, r)
      ? snapToEdge(previewPt.x, previewPt.y, r)
      : previewPt
    ctx.save()
    ctx.strokeStyle = '#c0392b'
    ctx.lineWidth   = 1.5
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(snapped.x, snapped.y)
    ctx.stroke()
    ctx.setLineDash([])
    const ang = angleDeg(p1.x, p1.y, snapped.x, snapped.y)
    ctx.fillStyle = '#c0392b'
    ctx.font      = '13px "IBM Plex Mono", monospace'
    ctx.fillText(ang + '°', snapped.x + 10, snapped.y - 8)
    ctx.restore()
  }
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
      <button class="fold-toggle fold-${l.fold.toLowerCase()}" data-index="${i}">${l.fold}</button>
      ${isReadOnly ? '' : `<button class="del-btn" data-index="${i}">×</button>`}
    </div>
  `).join('')

  if (!isReadOnly) {
    linesList.querySelectorAll('.line-angle').forEach(el => {
      el.addEventListener('click', () => {
        if (navigator.clipboard) navigator.clipboard.writeText(el.dataset.angle)
      })
    })
    linesList.querySelectorAll('.fold-toggle').forEach(el => {
      el.addEventListener('click', () => {
        const i = +el.dataset.index
        lines[i].fold = lines[i].fold === 'M' ? 'V' : 'M'
        renderList()
        redraw()
        window.onLinesChanged?.()
      })
    })
    linesList.querySelectorAll('.del-btn').forEach(el => {
      el.addEventListener('click', () => {
        lines.splice(+el.dataset.index, 1)
        renderList()
        redraw()
        window.onLinesChanged?.()
      })
    })
  }
}


// ── public getters ─────────────────────────────────────────────────────────

export function getLines()  { return lines }
export function getZone()   { return zoneBounds }