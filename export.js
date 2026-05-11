// ── export.js ─────────────────────────────────────────────────────────────
// Converts zone + fold lines into a valid .fold file for Origami Simulator.
//
// Strategy:
//   1. Collect all vertices: 4 rectangle corners + all edge intersection points
//   2. Build edges: rectangle boundary (B) + fold lines (M or V)
//   3. Build faces: triangulate the rectangle regions using a simple approach
//   4. Serialise as JSON and trigger download

const EPSILON = 1e-9

// ── vector helpers ─────────────────────────────────────────────────────────

function ptEq(a, b) {
  return Math.abs(a[0] - b[0]) < EPSILON && Math.abs(a[1] - b[1]) < EPSILON
}

function addVertex(verts, pt) {
  for (let i = 0; i < verts.length; i++) {
    if (ptEq(verts[i], pt)) return i
  }
  verts.push(pt)
  return verts.length - 1
}

// line segment intersection — returns point or null
function segIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const r  = [bx - ax, by - ay]
  const s  = [dx - cx, dy - cy]
  const rxs = r[0] * s[1] - r[1] * s[0]
  if (Math.abs(rxs) < EPSILON) return null  // parallel

  const t = ((cx - ax) * s[1] - (cy - ay) * s[0]) / rxs
  const u = ((cx - ax) * r[1] - (cy - ay) * r[0]) / rxs

  if (t >= -EPSILON && t <= 1 + EPSILON && u >= -EPSILON && u <= 1 + EPSILON) {
    return [ax + t * r[0], ay + t * r[1]]
  }
  return null
}


// ── main export function ───────────────────────────────────────────────────

export function exportFOLD(zoneBounds, lines, map) {

  if (!zoneBounds || lines.length === 0) {
    alert('Add at least one fold line before exporting.')
    return
  }

  // ── 1. normalise coordinates to a unit-ish rectangle ──────────────────
  // We work in a simple 2D coordinate system where the rectangle goes from
  // (0,0) to (W, H), preserving aspect ratio. This keeps the FOLD file
  // readable and compatible with Origami Simulator.

  const llToXY = ll => {
    const p = map.latLngToContainerPoint(ll)
    return [p.x, p.y]
  }

  const nwXY = llToXY(zoneBounds.nw)
  const seXY = llToXY(zoneBounds.se)

  const ox = nwXY[0]   // origin x
  const oy = nwXY[1]   // origin y
  const W  = seXY[0] - ox
  const H  = seXY[1] - oy

  // normalise a canvas point to zone-local coords
  const norm = ([x, y]) => [
    (x - ox) / W,
    (y - oy) / H
  ]

  // rectangle corners in normalised space
  const corners = [
    [0, 0],  // NW  index 0
    [1, 0],  // NE  index 1
    [1, 1],  // SE  index 2
    [0, 1],  // SW  index 3
  ]

  const vertices_coords = [...corners]

  // ── 2. collect fold line endpoints and all intersections ──────────────

  // fold lines in normalised space
  const foldSegs = lines.map(l => {
    const p1 = llToXY(l.start)
    const p2 = llToXY(l.end)
    return {
      a: norm(p1),
      b: norm(p2),
      fold: l.fold  // 'M' or 'V'
    }
  })

  // add fold endpoints as vertices
  foldSegs.forEach(seg => {
    addVertex(vertices_coords, seg.a)
    addVertex(vertices_coords, seg.b)
  })

  // find all fold-fold and fold-boundary intersections
  const rectEdges = [
    { a: corners[0], b: corners[1] },  // top
    { a: corners[1], b: corners[2] },  // right
    { a: corners[2], b: corners[3] },  // bottom
    { a: corners[3], b: corners[0] },  // left
  ]

  foldSegs.forEach(seg => {
    // intersect with rect edges
    rectEdges.forEach(re => {
      const pt = segIntersect(
        seg.a[0], seg.a[1], seg.b[0], seg.b[1],
        re.a[0],  re.a[1],  re.b[0],  re.b[1]
      )
      if (pt) addVertex(vertices_coords, pt)
    })

    // intersect with other fold segs
    foldSegs.forEach(other => {
      if (other === seg) return
      const pt = segIntersect(
        seg.a[0], seg.a[1], seg.b[0], seg.b[1],
        other.a[0], other.a[1], other.b[0], other.b[1]
      )
      if (pt) addVertex(vertices_coords, pt)
    })
  })

  // ── 3. build edges ────────────────────────────────────────────────────

  const edges_vertices   = []
  const edges_assignment = []

  function addEdge(iA, iB, assignment) {
    // avoid duplicate edges
    for (let i = 0; i < edges_vertices.length; i++) {
      const e = edges_vertices[i]
      if ((e[0] === iA && e[1] === iB) || (e[0] === iB && e[1] === iA)) return
    }
    edges_vertices.push([iA, iB])
    edges_assignment.push(assignment)
  }

  // boundary edges — split by any vertices lying on each rect edge
  const rectEdgeDefs = [
    { a: 0, b: 1, axis: 'y', val: 0, coord: 'x' },   // top:    y=0, sort by x
    { a: 1, b: 2, axis: 'x', val: 1, coord: 'y' },   // right:  x=1, sort by y
    { a: 2, b: 3, axis: 'y', val: 1, coord: 'x' },   // bottom: y=1, sort by x (desc)
    { a: 3, b: 0, axis: 'x', val: 0, coord: 'y' },   // left:   x=0, sort by y (desc)
  ]

  rectEdgeDefs.forEach(({ a, b, axis, val, coord }) => {
    // find all vertices on this edge
    const onEdge = []
    vertices_coords.forEach((v, i) => {
      if (Math.abs(v[axis === 'x' ? 0 : 1] - val) < EPSILON * 10) {
        onEdge.push({ i, t: v[coord === 'x' ? 0 : 1] })
      }
    })
    // sort along the edge direction
    const startT = vertices_coords[a][coord === 'x' ? 0 : 1]
    const endT   = vertices_coords[b][coord === 'x' ? 0 : 1]
    onEdge.sort((p, q) => startT < endT ? p.t - q.t : q.t - p.t)

    // add sequential boundary segments
    for (let k = 0; k < onEdge.length - 1; k++) {
      addEdge(onEdge[k].i, onEdge[k + 1].i, 'B')
    }
  })

  // fold edges — each fold line, split at intersection vertices
  foldSegs.forEach(seg => {
    // collect all vertices on this segment
    const onSeg = []
    vertices_coords.forEach((v, i) => {
      // check if v lies on seg
      const dx = seg.b[0] - seg.a[0]
      const dy = seg.b[1] - seg.a[1]
      const len2 = dx * dx + dy * dy
      if (len2 < EPSILON) return
      const t = ((v[0] - seg.a[0]) * dx + (v[1] - seg.a[1]) * dy) / len2
      if (t < -EPSILON || t > 1 + EPSILON) return
      // check perpendicular distance
      const px = seg.a[0] + t * dx - v[0]
      const py = seg.a[1] + t * dy - v[1]
      if (px * px + py * py < EPSILON) {
        onSeg.push({ i, t })
      }
    })
    onSeg.sort((a, b) => a.t - b.t)

    for (let k = 0; k < onSeg.length - 1; k++) {
      addEdge(onSeg[k].i, onSeg[k + 1].i, seg.fold)
    }
  })

  // ── 4. build faces ────────────────────────────────────────────────────
  // Simple approach: use the 4 rectangle corners as one face.
  // Origami Simulator will triangulate internally.
  // For complex patterns with many intersections, a full planar subdivision
  // would be needed — this is a valid starting point for the simulator.

  const faces_vertices = [[0, 1, 2, 3]]

  // ── 5. assemble FOLD object ───────────────────────────────────────────

  const fold = {
    file_spec: 1.1,
    file_creator: 'Vaciada — map to cloth',
    file_classes: ['singleModel'],
    frame_title: 'Vaciada crease pattern',
    frame_classes: ['creasePattern'],
    frame_attributes: ['2D'],
    vertices_coords,
    edges_vertices,
    edges_assignment,
    faces_vertices
  }

  // ── 6. download ───────────────────────────────────────────────────────

  const json = JSON.stringify(fold, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'vaciada-crease-pattern.fold'
  a.click()
  URL.revokeObjectURL(url)
}