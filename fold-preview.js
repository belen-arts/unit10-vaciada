// ── fold-preview.js ───────────────────────────────────────────────────────
// Lightweight fold simulation using Three.js.
// Mountain folds = red lines, Valley folds = blue lines, both thick.

const EPSILON = 1e-9

// ── geometry helpers ───────────────────────────────────────────────────────

function ptEq(a, b) {
  return Math.abs(a[0] - b[0]) < EPSILON && Math.abs(a[1] - b[1]) < EPSILON
}

function addVert(verts, pt) {
  for (let i = 0; i < verts.length; i++) {
    if (ptEq(verts[i], pt)) return i
  }
  verts.push([...pt])
  return verts.length - 1
}

function segIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const rx = bx - ax, ry = by - ay
  const sx = dx - cx, sy = dy - cy
  const rxs = rx * sy - ry * sx
  if (Math.abs(rxs) < EPSILON) return null
  const t = ((cx - ax) * sy - (cy - ay) * sx) / rxs
  const u = ((cx - ax) * ry - (cy - ay) * rx) / rxs
  if (t >= -EPSILON && t <= 1 + EPSILON && u >= -EPSILON && u <= 1 + EPSILON) {
    return [ax + t * rx, ay + t * ry]
  }
  return null
}

// ── build mesh data ────────────────────────────────────────────────────────

function buildMeshData(zone, lines, map) {
  const llToN = ll => {
    const p  = map.latLngToContainerPoint(ll)
    const nw = map.latLngToContainerPoint(zone.nw)
    const se = map.latLngToContainerPoint(zone.se)
    const W  = se.x - nw.x
    const H  = se.y - nw.y
    return [(p.x - nw.x) / W, (p.y - nw.y) / H]
  }

  const corners = [[0,0],[1,0],[1,1],[0,1]]
  const segs = lines.map(l => ({
    a: llToN(l.start),
    b: llToN(l.end),
    fold: l.fold
  }))

  const verts = [...corners]
  segs.forEach(s => {
    addVert(verts, s.a)
    addVert(verts, s.b)
  })

  const rectEdges = [
    { a: corners[0], b: corners[1] },
    { a: corners[1], b: corners[2] },
    { a: corners[2], b: corners[3] },
    { a: corners[3], b: corners[0] },
  ]

  segs.forEach(s => {
    rectEdges.forEach(re => {
      const pt = segIntersect(s.a[0],s.a[1],s.b[0],s.b[1],re.a[0],re.a[1],re.b[0],re.b[1])
      if (pt) addVert(verts, pt)
    })
    segs.forEach(other => {
      if (other === s) return
      const pt = segIntersect(s.a[0],s.a[1],s.b[0],s.b[1],other.a[0],other.a[1],other.b[0],other.b[1])
      if (pt) addVert(verts, pt)
    })
  })

  const edges = []

  const rectEdgeDefs = [
    { axis:'y', val:0, coord:'x', asc:true  },
    { axis:'x', val:1, coord:'y', asc:true  },
    { axis:'y', val:1, coord:'x', asc:false },
    { axis:'x', val:0, coord:'y', asc:false },
  ]

  rectEdgeDefs.forEach(({ axis, val, coord, asc }) => {
    const ai = axis === 'x' ? 0 : 1
    const ci = coord === 'x' ? 0 : 1
    const onEdge = verts
      .map((v,i) => ({ i, t: v[ci], v }))
      .filter(({ v }) => Math.abs(v[ai] - val) < 0.001)
    onEdge.sort((a,b) => asc ? a.t - b.t : b.t - a.t)
    for (let k = 0; k < onEdge.length - 1; k++) {
      edges.push({ a: onEdge[k].i, b: onEdge[k+1].i, type: 'B', fold: null })
    }
  })

  segs.forEach(s => {
    const onSeg = []
    verts.forEach((v, i) => {
      const dx = s.b[0]-s.a[0], dy = s.b[1]-s.a[1]
      const len2 = dx*dx + dy*dy
      if (len2 < EPSILON) return
      const t = ((v[0]-s.a[0])*dx + (v[1]-s.a[1])*dy) / len2
      if (t < -EPSILON || t > 1+EPSILON) return
      const px = s.a[0]+t*dx-v[0], py = s.a[1]+t*dy-v[1]
      if (px*px+py*py < EPSILON) onSeg.push({ i, t })
    })
    onSeg.sort((a,b) => a.t - b.t)
    for (let k = 0; k < onSeg.length-1; k++) {
      edges.push({ a: onSeg[k].i, b: onSeg[k+1].i, type: s.fold, fold: s.fold })
    }
  })

  const triangles = []
  for (let i = 1; i < verts.length - 1; i++) {
    triangles.push([0, i, i+1 < verts.length ? i+1 : 1])
  }

  const foldEdges = edges.filter(e => e.type === 'M' || e.type === 'V').map(e => ({
    ...e,
    ax: verts[e.a],
    bx: verts[e.b],
  }))

  return { verts, triangles, foldEdges, edges }
}


// ── Three.js renderer ─────────────────────────────────────────────────────

let renderer, scene, camera, foldMesh, wireGroup, animId
let currentFoldPercent = 0
let meshData = null

export function initFoldPreview() {
  const canvas = document.getElementById('fold-canvas')

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setClearColor(0x2e2e2e, 1)

  scene  = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100)
  camera.position.set(0.5, 0.5, 2.2)
  camera.lookAt(0.5, 0.5, 0)

  const amb  = new THREE.AmbientLight(0xffffff, 0.7)
  scene.add(amb)
  const dir  = new THREE.DirectionalLight(0xffffff, 0.9)
  dir.position.set(1, 2, 3)
  scene.add(dir)
  const dir2 = new THREE.DirectionalLight(0xfff0dd, 0.4)
  dir2.position.set(-1, -1, 2)
  scene.add(dir2)

  addOrbitControl(canvas)

  resizeFold()
  window.addEventListener('resize', resizeFold)

  animate()

  document.getElementById('fold-slider').addEventListener('input', e => {
    currentFoldPercent = +e.target.value / 100
    if (meshData) buildFoldMesh(meshData, currentFoldPercent)
  })
}

function resizeFold() {
  const wrap = document.getElementById('fold-canvas-wrap')
  const w = wrap.offsetWidth
  const h = wrap.offsetHeight
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

function animate() {
  animId = requestAnimationFrame(animate)
  renderer.render(scene, camera)
}


// ── build / update mesh ───────────────────────────────────────────────────

export function updateFoldPreview(zone, lines, map) {
  const empty = document.getElementById('fold-empty')

  if (!zone || lines.length === 0) {
    empty.classList.remove('hidden')
    if (foldMesh)  { scene.remove(foldMesh);  foldMesh  = null }
    if (wireGroup) { scene.remove(wireGroup); wireGroup = null }
    return
  }

  empty.classList.add('hidden')
  meshData = buildMeshData(zone, lines, map)
  buildFoldMesh(meshData, currentFoldPercent)
}

export function clearFoldPreview() {
  const empty = document.getElementById('fold-empty')
  empty.classList.remove('hidden')
  if (foldMesh)  { scene.remove(foldMesh);  foldMesh  = null }
  if (wireGroup) { scene.remove(wireGroup); wireGroup = null }
  meshData           = null
  currentFoldPercent = 0
}

function buildFoldMesh(data, foldPct) {
  if (foldMesh)  { scene.remove(foldMesh);  foldMesh  = null }
  if (wireGroup) { scene.remove(wireGroup); wireGroup = null }

  const { verts, triangles, foldEdges } = data

  const pos3D = verts.map(v => new THREE.Vector3(v[0], 1 - v[1], 0))

  foldEdges.forEach(fe => {
    const va   = pos3D[fe.a]
    const vb   = pos3D[fe.b]
    const axis = new THREE.Vector3().subVectors(vb, va).normalize()

    const maxAngle = Math.PI * foldPct
    const angle    = fe.fold === 'M' ? -maxAngle : maxAngle

    const edgeDir = new THREE.Vector3().subVectors(
      new THREE.Vector3(fe.bx[0], fe.bx[1], 0),
      new THREE.Vector3(fe.ax[0], fe.ax[1], 0)
    )

    verts.forEach((v, i) => {
      const onCrease = Math.abs(
        (fe.bx[0]-fe.ax[0])*(v[1]-fe.ax[1]) - (fe.bx[1]-fe.ax[1])*(v[0]-fe.ax[0])
      ) < 0.01
      if (onCrease) return

      const cross = edgeDir.x * (v[1] - fe.ax[1]) - edgeDir.y * (v[0] - fe.ax[0])
      if (cross > 0) {
        const q        = new THREE.Quaternion().setFromAxisAngle(axis, angle * 0.5)
        const relative = pos3D[i].clone().sub(va)
        relative.applyQuaternion(q)
        pos3D[i] = relative.add(va)
      }
    })
  })

  // cloth mesh
  const geometry  = new THREE.BufferGeometry()
  const positions = []
  const colors    = []
  const clothCol  = new THREE.Color(0xede8dc)

  triangles.forEach(([i0, i1, i2]) => {
    if (i0 >= pos3D.length || i1 >= pos3D.length || i2 >= pos3D.length) return
    const p0 = pos3D[i0], p1 = pos3D[i1], p2 = pos3D[i2]
    positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
    const c = clothCol
    colors.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b)
  })

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()

  foldMesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  }))
  scene.add(foldMesh)

  // fold lines — thick tubes coloured by M/V
  wireGroup = new THREE.Group()

  foldEdges.forEach(fe => {
    const pa     = pos3D[fe.a]
    const pb     = pos3D[fe.b]
    const colour = fe.fold === 'M' ? 0xe74c3c : 0x3498db

    const points = [pa.clone(), pb.clone()]
    const path   = new THREE.CatmullRomCurve3(points)
    const tube   = new THREE.TubeGeometry(path, 1, 0.008, 6, false)
    const mat    = new THREE.MeshBasicMaterial({ color: colour })
    wireGroup.add(new THREE.Mesh(tube, mat))
  })

  scene.add(wireGroup)
}


// ── orbit control ─────────────────────────────────────────────────────────

function addOrbitControl(canvas) {
  let isDragging = false
  let lastX = 0, lastY = 0
  let rotX = 0, rotY = 0

  canvas.addEventListener('mousedown', e => {
    isDragging = true
    lastX = e.clientX
    lastY = e.clientY
  })

  window.addEventListener('mouseup', () => { isDragging = false })

  window.addEventListener('mousemove', e => {
    if (!isDragging) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    rotY += dx * 0.005
    rotX += dy * 0.005
    rotX = Math.max(-Math.PI/2, Math.min(Math.PI/2, rotX))
    const r = 2.2
    camera.position.x = 0.5 + r * Math.sin(rotY) * Math.cos(rotX)
    camera.position.y = 0.5 + r * Math.sin(rotX)
    camera.position.z = r * Math.cos(rotY) * Math.cos(rotX)
    camera.lookAt(0.5, 0.5, 0)
  })

  canvas.addEventListener('wheel', e => {
    const dir = new THREE.Vector3().subVectors(camera.position, new THREE.Vector3(0.5,0.5,0)).normalize()
    camera.position.addScaledVector(dir, e.deltaY * 0.001)
  })
}