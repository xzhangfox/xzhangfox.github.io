/** A shared, pixel-sized aperture field: positive inside the opening, negative on glass.
 * Rendering and contact queries consume this same warped silhouette. Coordinates are CSS pixels. */
export function createApertureField(alpha: Uint8Array, width: number, height: number, step = 2) {
  const distance = new Float32Array(width * height), inside = (i: number) => alpha[i] > 127
  const diagonal = Math.SQRT2
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, value = inside(i)
    distance[i] = (x > 0 && inside(i - 1) !== value) || (x + 1 < width && inside(i + 1) !== value)
      || (y > 0 && inside(i - width) !== value) || (y + 1 < height && inside(i + width) !== value) ? Math.abs(alpha[i] / 255 - .5) : 1e5
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x
    if (x) distance[i] = Math.min(distance[i], distance[i - 1] + 1)
    if (y) {
      distance[i] = Math.min(distance[i], distance[i - width] + 1)
      if (x) distance[i] = Math.min(distance[i], distance[i - width - 1] + diagonal)
      if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i - width + 1] + diagonal)
    }
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x
    if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i + 1] + 1)
    if (y + 1 < height) {
      distance[i] = Math.min(distance[i], distance[i + width] + 1)
      if (x) distance[i] = Math.min(distance[i], distance[i + width - 1] + diagonal)
      if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i + width + 1] + diagonal)
    }
  }
  for (let i = 0; i < distance.length; i++) distance[i] *= (inside(i) ? 1 : -1) * step
  const at = (x: number, y: number) => distance[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))]
  const sample = (x: number, y: number) => {
    const px = x / step - .5, py = y / step - .5, ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy
    return (at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx) * (1 - fy)
      + (at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx) * fy
  }
  const normal = (x: number, y: number) => {
    const nx = sample(x + step * 3, y) - sample(x - step * 3, y), ny = sample(x, y + step * 3) - sample(x, y - step * 3), length = Math.hypot(nx, ny)
    return length > .001 ? { x: nx / length, y: ny / length } : { x: 0, y: 1 }
  }
  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x
    // A resolved normal footprint suppresses stair-step lighting without blurring the visible aperture.
    const nx = at(x + 3, y) - at(x - 3, y) + .5 * (at(x + 3, y - 1) - at(x - 3, y - 1) + at(x + 3, y + 1) - at(x - 3, y + 1))
    const ny = at(x, y + 3) - at(x, y - 3) + .5 * (at(x - 1, y + 3) - at(x - 1, y - 3) + at(x + 1, y + 3) - at(x + 1, y - 3))
    const length = Math.hypot(nx, ny)
    pixels[i * 4] = Math.round(Math.max(0, Math.min(1, .5 + distance[i] / 64)) * 255)
    pixels[i * 4 + 1] = Math.round(((length > .001 ? nx / length : 0) * .5 + .5) * 255)
    pixels[i * 4 + 2] = Math.round(((length > .001 ? ny / length : 1) * .5 + .5) * 255); pixels[i * 4 + 3] = alpha[i]
  }
  return { width, height, step, pixels, sample, normal }
}
export type ApertureField = ReturnType<typeof createApertureField>
export type DropMode = 'glass' | 'rim' | 'cavity' | 'falling'
export interface GlassDrop {
  x: number; y: number; r: number; vx: number; vy: number; age: number; life: number; seed: number
  mode: DropMode; held: number; anchorX: number; anchorY: number; nx: number; ny: number
}
export const dropStats = () => ({ slides: 0, merges: 0, contacts: 0, detached: 0, landings: 0 })
export function glassDrop(x: number, y: number, r: number, seed = .5): GlassDrop {
  return { x, y, r, vx: 0, vy: 0, age: 0, life: 55 + seed * 60, seed, mode: 'glass', held: 0, anchorX: x, anchorY: y, nx: 0, ny: 1 }
}
/** Float history avoids 8-bit feedback rounding: a small per-frame fade must not stick forever. */
export function createWetHistory(width: number, height: number) {
  const values = new Float32Array(width * height), pixels = new Uint8ClampedArray(width * height * 4)
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255
  return {
    values, pixels,
    deposit(x: number, y: number, toX: number, toY: number, radius: number) {
      const dx = toX - x, dy = toY - y, length2 = dx * dx + dy * dy
      for (let py = Math.max(0, Math.floor(Math.min(y, toY) - radius)); py <= Math.min(height - 1, Math.ceil(Math.max(y, toY) + radius)); py++) {
        for (let px = Math.max(0, Math.floor(Math.min(x, toX) - radius)); px <= Math.min(width - 1, Math.ceil(Math.max(x, toX) + radius)); px++) {
          const t = length2 > 1e-8 ? Math.max(0, Math.min(1, ((px + .5 - x) * dx + (py + .5 - y) * dy) / length2)) : 0
          const distance = Math.hypot(px + .5 - x - dx * t, py + .5 - y - dy * t)
          if (distance < radius) { const i = py * width + px; values[i] = Math.max(values[i], .62 * (1 - (distance / radius) ** 2)) }
        }
      }
    },
    advance(dt: number, lifetime: number) {
      const decay = Math.exp(-Math.max(0, dt) / lifetime)
      for (let i = 0; i < values.length; i++) {
        values[i] *= decay
        const v = values[i] * 255, p = i * 4
        pixels[p] = pixels[p + 1] = pixels[p + 2] = v
      }
    },
  }
}
function pin(drop: GlassDrop, field: ApertureField, x: number, y: number) {
  for (let i = 0; i < 3; i++) { const n = field.normal(x, y), d = field.sample(x, y); x -= n.x * d; y -= n.y * d }
  const n = field.normal(x, y)
  Object.assign(drop, { mode: 'rim', held: 0, anchorX: x, anchorY: y, nx: n.x, ny: n.y, vx: 0, vy: 0 })
  drop.x = x + n.x * drop.r * .12; drop.y = y + n.y * drop.r * .12
}
/** Bounded contact-line approximation, not a volumetric CFD solver.
 * Pinning resists gravity; coalescence conserves r^3 volume and momentum. Free water leaves no glass trail. */
export function stepGlassWater(drops: GlassDrop[], field: ApertureField, rain: number, fog: number, dt: number,
  stats: ReturnType<typeof dropStats>, trail: (x: number, y: number, toX: number, toY: number, radius: number) => void) {
  // Small substeps prevent tunnelling through a thin serif or a letter's inner counter.
  const count = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / count
  for (let step = 0; step < count; step++) for (const d of drops) {
    d.age += h
    if (d.mode === 'glass' || d.mode === 'rim') {
      if (rain > .02) d.r += h * rain * (.045 + d.seed * .09)
      else if (fog < .15) d.r = Math.max(0, d.r - h * .065)
    }
    if (d.mode === 'rim') {
      d.held += h
      // Gravity projected onto the local frame tangent carries water down sloped letter edges.
      const tx = -d.ny, ty = d.nx, along = ty * 22
      let x = d.anchorX + tx * along * h, y = d.anchorY + ty * along * h
      for (let i = 0; i < 2; i++) { const n = field.normal(x, y), s = field.sample(x, y); x -= n.x * s; y -= n.y * s }
      const n = field.normal(x, y); d.anchorX = x; d.anchorY = y; d.nx = n.x; d.ny = n.y
      const hang = Math.min(1, d.held / .9) * Math.min(1, d.r / 5)
      d.x = x + n.x * d.r * .18; d.y = y + n.y * d.r * .12 + hang * d.r * .22
      const criticalRadius = 4.7 + (1 - Math.abs(n.y)) * 1.2
      if (d.r >= criticalRadius && d.held > .7 + d.seed * .65) {
        d.mode = n.y > .25 ? 'cavity' : 'falling'; d.vy = 18; d.vx = n.x * 7
        if (d.mode === 'cavity') { d.x = x + n.x * (d.r * .5 + 1); d.y = y + n.y * (d.r * .5 + 1) }
        else d.y = y + d.r * .4
        stats.detached++
      }
      continue
    }
    if (d.mode === 'cavity' || d.mode === 'falling') {
      d.vy += 310 * h; d.vx *= Math.exp(-h * .35)
      const x = d.x + d.vx * h, y = d.y + d.vy * h
      if (d.mode === 'cavity' && field.sample(x, y) <= d.r * .6) {
        const n = field.normal(x, y)
        if (d.vx * n.x + d.vy * n.y < -.01) { pin(d, field, x, y); stats.landings++; continue }
      }
      d.x = x; d.y = y; continue
    }
    // A contact radius gives small drops a stable pinned phase; mass defeats contact-line friction.
    const mobile = Math.max(0, d.r * d.r - 4.5 * 4.5)
    d.vy += (Math.min(155, mobile * 5) * (rain > .02 ? 1 : .45) - d.vy * 2.4) * h
    d.vx += (Math.sin(d.y * .025 + d.seed * 8) * d.vy * .055 - d.vx * 4) * h
    const x = d.x + d.vx * h, y = d.y + d.vy * h, before = field.sample(d.x, d.y)
    if (field.sample(x, y) >= -d.r * .4 && before < 1) {
      const n = field.normal(x, y)
      if (d.vx * n.x + d.vy * n.y > .01) { pin(d, field, x, y); stats.contacts++; continue }
    }
    if (Math.hypot(x - d.x, y - d.y) > .006 && before < -d.r * .15) {
      trail(d.x, d.y, x, y, d.r); stats.slides++
    }
    d.x = x; d.y = y
  }
  for (let i = 0; i < drops.length; i++) for (let j = i + 1; j < drops.length; j++) {
    const a = drops[i], b = drops[j]
    const attachedA = a.mode === 'glass' || a.mode === 'rim', attachedB = b.mode === 'glass' || b.mode === 'rim'
    if (attachedA !== attachedB || (!attachedA && a.mode !== b.mode)) continue
    if (Math.hypot(a.x - b.x, a.y - b.y) > (a.r + b.r) * .78) continue
    // A frosted web between two nearby strokes prevents droplets on opposite sides from merging.
    const sameRim = a.mode === 'rim' && b.mode === 'rim' && a.nx * b.nx + a.ny * b.ny > .5
    if (!sameRim && a.mode !== 'falling' && (field.sample((a.x + b.x) / 2, (a.y + b.y) / 2) > 1) === attachedA) continue
    const va = a.r ** 3, vb = b.r ** 3, total = va + vb
    const x = (a.x * va + b.x * vb) / total, y = (a.y * va + b.y * vb) / total
    a.vx = (a.vx * va + b.vx * vb) / total; a.vy = (a.vy * va + b.vy * vb) / total
    a.r = Math.cbrt(total); a.age = Math.min(a.age, b.age)
    if (a.mode === 'rim' || b.mode === 'rim') {
      const rim = a.mode === 'rim' ? a : b, held = Math.max(a.held, b.held)
      pin(a, field, rim.anchorX, rim.anchorY); a.held = held
    } else { a.x = x; a.y = y }
    drops.splice(j--, 1); stats.merges++
  }
}
