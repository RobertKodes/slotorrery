import { PALETTE } from '../lib/palette.ts'
import { familyColor, familyLabel, type Family } from '../lib/programs.ts'
import type { CometSpec, FamilyHeat } from '../hooks/useChainPulse.ts'

export type Planet = {
  family: Family
  label: string
  baseR: number
  size: number
  angle: number
  omega0: number
  heat: number
  x: number
  y: number
}

type TrailPt = { x: number; y: number }

type Comet = {
  family: Family
  failed: boolean
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  burn: number
  trail: TrailPt[]
}

const PLANET_SPEC: { family: Family; baseR: number; size: number; omega0: number; angle: number }[] = [
  { family: 'SYS', baseR: 0.22, size: 0.028, omega0: 0.55, angle: 0.4 },
  { family: 'TKN', baseR: 0.34, size: 0.032, omega0: 0.38, angle: 1.7 },
  { family: 'JUP', baseR: 0.47, size: 0.038, omega0: 0.26, angle: 3.1 },
  { family: 'RAY', baseR: 0.6, size: 0.034, omega0: 0.2, angle: 4.4 },
  { family: 'STK', baseR: 0.73, size: 0.03, omega0: 0.14, angle: 5.5 },
  { family: '???', baseR: 0.86, size: 0.026, omega0: 0.09, angle: 0.9 },
]

export class OrrerySim {
  planets: Planet[]
  comets: Comet[] = []
  frozen = false
  reduced = false
  warp = 0
  slot = 0
  tickFlash = 0
  apsidal = 0.35
  graspFamily: Family | null = null
  private spawnAcc = 0
  private lastSlot = -1

  constructor() {
    this.planets = PLANET_SPEC.map((p) => ({
      ...p,
      label: familyLabel(p.family),
      heat: 0.18,
      x: 0,
      y: 0,
    }))
  }

  hitPlanet(nx: number, ny: number, maxR: number): Family | null {
    let best: Family | null = null
    let bestD = 18
    for (const p of this.planets) {
      const px = p.x * maxR
      const py = p.y * maxR
      const d = Math.hypot(nx - px, ny - py)
      const hit = Math.max(14, p.size * maxR * 2.4)
      if (d < hit && d < bestD) {
        bestD = d
        best = p.family
      }
    }
    return best
  }

  step(dt: number, pull: () => CometSpec | null, heat: FamilyHeat, slot: number | null) {
    if (slot != null && slot !== this.lastSlot) {
      if (this.lastSlot > 0 && !this.frozen) this.tickFlash = 1
      this.lastSlot = slot
      this.slot = slot
    }
    if (!this.frozen) this.tickFlash = Math.max(0, this.tickFlash - dt * 2.4)

    if (this.frozen || this.reduced) {
      this.placePlanets()
      return
    }

    this.apsidal += dt * (0.04 + this.warp * 0.05)
    for (const p of this.planets) {
      const h = heat[p.family] ?? 0
      p.heat += (h - p.heat) * Math.min(1, dt * 2.2)
      const omega = p.omega0 * (0.32 + 1.55 * (0.12 + p.heat))
      p.angle += omega * dt
    }
    this.placePlanets()

    this.spawnAcc += dt
    while (this.spawnAcc > 0.045) {
      this.spawnAcc -= 0.045
      const spec = pull()
      if (spec) this.spawnComet(spec)
    }

    const e = 0.08 + this.warp * 0.42
    for (let i = this.comets.length - 1; i >= 0; i--) {
      const c = this.comets[i]!
      c.life -= dt
      const r2 = c.x * c.x + c.y * c.y
      const r = Math.sqrt(Math.max(1e-6, r2))
      const pullIn = (0.12 + e * 0.55) * dt
      c.vx -= (c.x / r) * pullIn
      c.vy -= (c.y / r) * pullIn
      if (c.failed) {
        c.burn = Math.min(1, c.burn + dt * 1.8)
        c.vx *= 1 - dt * 0.55
        c.vy *= 1 - dt * 0.55
      }
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.trail.push({ x: c.x, y: c.y })
      if (c.trail.length > 14) c.trail.shift()
      if (c.life <= 0 || r > 1.35 || r < 0.06) this.comets.splice(i, 1)
    }
    if (this.comets.length > 48) this.comets.splice(0, this.comets.length - 48)
  }

  private placePlanets() {
    const e = 0.04 + this.warp * 0.38
    const rot = this.apsidal
    const cr = Math.cos(rot)
    const sr = Math.sin(rot)
    for (const p of this.planets) {
      const a = p.baseR * (1 + p.heat * 0.14)
      const b = a * (1 - e)
      const x0 = a * Math.cos(p.angle)
      const y0 = b * Math.sin(p.angle)
      p.x = x0 * cr - y0 * sr
      p.y = x0 * sr + y0 * cr
    }
  }

  private spawnComet(spec: CometSpec) {
    const p = this.planets.find((pl) => pl.family === spec.family) ?? this.planets[this.planets.length - 1]!
    const tx = -p.y
    const ty = p.x
    const tlen = Math.hypot(tx, ty) || 1
    const speed = 0.42 + p.heat * 0.55 + Math.random() * 0.12
    const outward = 0.08 + Math.random() * 0.1
    const jitter = (Math.random() - 0.5) * 0.04
    this.comets.push({
      family: spec.family,
      failed: spec.failed,
      x: p.x + jitter,
      y: p.y + jitter,
      vx: (tx / tlen) * speed + (p.x / (Math.hypot(p.x, p.y) || 1)) * outward,
      vy: (ty / tlen) * speed + (p.y / (Math.hypot(p.x, p.y) || 1)) * outward,
      life: spec.failed ? 1.15 : 1.7 + Math.random() * 0.5,
      maxLife: spec.failed ? 1.15 : 2.1,
      burn: spec.failed ? 0.15 : 0,
      trail: [{ x: p.x, y: p.y }],
    })
  }
}

export type DrawHud = {
  frozen: boolean
  reduced: boolean
  grasp: Family | null
}

export function drawOrrery(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sim: OrrerySim,
  hud: DrawHud,
) {
  ctx.clearRect(0, 0, w, h)
  const cx = w * 0.5
  const cy = h * 0.5
  const maxR = Math.min(w, h) * 0.42

  drawCloth(ctx, w, h)
  ctx.save()
  ctx.translate(cx, cy)

  drawDome(ctx, maxR)
  drawWell(ctx, maxR, sim)
  drawArmillary(ctx, maxR, sim)
  drawOrbits(ctx, maxR, sim)
  drawArms(ctx, maxR, sim)
  drawComets(ctx, maxR, sim)
  drawPlanets(ctx, maxR, sim, hud.grasp)
  drawSun(ctx, maxR, sim)
  if (hud.frozen) drawHeldPlate(ctx, maxR)

  ctx.restore()
}

function drawCloth(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 8, w * 0.5, h * 0.5, Math.max(w, h) * 0.72)
  g.addColorStop(0, '#221c28')
  g.addColorStop(0.45, '#1a161f')
  g.addColorStop(1, PALETTE.velvet)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.globalAlpha = 0.04
  ctx.strokeStyle = PALETTE.ivory
  ctx.lineWidth = 1
  const step = 28
  for (let x = 0; x < w; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  ctx.restore()
}

function drawDome(ctx: CanvasRenderingContext2D, R: number) {
  ctx.beginPath()
  ctx.arc(0, 0, R * 1.18, 0, Math.PI * 2)
  ctx.strokeStyle = PALETTE.patina
  ctx.globalAlpha = 0.35
  ctx.lineWidth = Math.max(1.2, R * 0.012)
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.beginPath()
  ctx.arc(-R * 0.38, -R * 0.42, R * 0.55, -0.4, 0.9)
  ctx.strokeStyle = 'rgba(231, 217, 196, 0.12)'
  ctx.lineWidth = R * 0.03
  ctx.stroke()
}

function drawWell(ctx: CanvasRenderingContext2D, R: number, sim: OrrerySim) {
  const e = 0.04 + sim.warp * 0.38
  const rot = sim.apsidal
  ctx.save()
  ctx.rotate(rot)
  const g = ctx.createRadialGradient(0, 0, R * 0.04, 0, 0, R)
  g.addColorStop(0, 'rgba(230, 201, 122, 0.16)')
  g.addColorStop(0.22, 'rgba(198, 163, 90, 0.06)')
  g.addColorStop(1, 'rgba(20, 16, 24, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(0, 0, R, R * (1 - e), 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = PALETTE.brass
  ctx.globalAlpha = 0.12 + sim.warp * 0.12
  ctx.lineWidth = 1
  for (let i = 1; i <= 8; i++) {
    const t = i / 8
    ctx.beginPath()
    ctx.ellipse(0, 0, R * t, R * t * (1 - e), 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function drawArmillary(ctx: CanvasRenderingContext2D, R: number, sim: OrrerySim) {
  ctx.save()
  ctx.globalAlpha = 0.22
  ctx.strokeStyle = PALETTE.brass
  ctx.lineWidth = Math.max(1, R * 0.008)
  const tilt = 0.55 + sim.warp * 0.12
  ctx.beginPath()
  ctx.ellipse(0, 0, R * 1.02, R * 1.02 * Math.sin(tilt), 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(0, 0, R * 1.02 * Math.sin(tilt * 0.7), R * 1.02, 0.4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawOrbits(ctx: CanvasRenderingContext2D, R: number, sim: OrrerySim) {
  const e = 0.04 + sim.warp * 0.38
  const rot = sim.apsidal
  ctx.save()
  ctx.rotate(rot)
  for (const p of sim.planets) {
    const a = p.baseR * (1 + p.heat * 0.14) * R
    const b = a * (1 - e)
    ctx.beginPath()
    ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2)
    ctx.strokeStyle = familyColor(p.family)
    ctx.globalAlpha = 0.22 + p.heat * 0.28
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.globalAlpha = 0.28
    ctx.strokeStyle = PALETTE.ivory
    ctx.lineWidth = 0.8
    const ticks = 24
    for (let i = 0; i < ticks; i++) {
      const th = (i / ticks) * Math.PI * 2
      const x = a * Math.cos(th)
      const y = b * Math.sin(th)
      const n = Math.hypot(x / a, y / b) || 1
      const nx = x / (a * n)
      const ny = y / (b * n)
      const len = i % 6 === 0 ? 6 : 3
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + nx * len, y + ny * len)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawArms(ctx: CanvasRenderingContext2D, R: number, sim: OrrerySim) {
  ctx.lineWidth = Math.max(0.8, R * 0.004)
  for (const p of sim.planets) {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(p.x * R, p.y * R)
    ctx.strokeStyle = PALETTE.brass
    ctx.globalAlpha = 0.28
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawComets(ctx: CanvasRenderingContext2D, R: number, sim: OrrerySim) {
  for (const c of sim.comets) {
    const fade = Math.max(0, c.life / c.maxLife)
    const col = c.burn > 0.05 ? lerpHex(familyColor(c.family), PALETTE.cinnabar, Math.min(1, c.burn)) : familyColor(c.family)
    if (c.trail.length > 1) {
      ctx.beginPath()
      ctx.moveTo(c.trail[0]!.x * R, c.trail[0]!.y * R)
      for (let i = 1; i < c.trail.length; i++) {
        ctx.lineTo(c.trail[i]!.x * R, c.trail[i]!.y * R)
      }
      ctx.strokeStyle = col
      ctx.globalAlpha = 0.28 + fade * 0.62
      ctx.lineWidth = c.failed ? 2.4 : 1.7
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(c.x * R, c.y * R, c.failed ? 2.6 : 2.1, 0, Math.PI * 2)
    ctx.fillStyle = col
    ctx.globalAlpha = 0.4 + fade * 0.6
    ctx.fill()
    if (c.burn > 0.4) {
      ctx.beginPath()
      ctx.arc(c.x * R, c.y * R, 5.5 * c.burn, 0, Math.PI * 2)
      ctx.fillStyle = PALETTE.cinnabar
      ctx.globalAlpha = 0.18 * fade
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

function drawPlanets(ctx: CanvasRenderingContext2D, R: number, sim: OrrerySim, grasp: Family | null) {
  ctx.font = `${Math.max(9, R * 0.038)}px 'Chivo Mono', ui-monospace, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const p of sim.planets) {
    const x = p.x * R
    const y = p.y * R
    const rad = Math.max(4.5, p.size * R * (1 + p.heat * 0.35))
    const grabbed = grasp === p.family
    ctx.beginPath()
    ctx.arc(x, y, rad + (grabbed ? 3.5 : 0), 0, Math.PI * 2)
    if (grabbed) {
      ctx.strokeStyle = PALETTE.gilt
      ctx.globalAlpha = 0.85
      ctx.lineWidth = 1.4
      ctx.stroke()
    }

    const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.35, rad * 0.1, x, y, rad)
    g.addColorStop(0, PALETTE.ivory)
    g.addColorStop(0.35, familyColor(p.family))
    g.addColorStop(1, PALETTE.velvet)
    ctx.fillStyle = g
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(x, y, rad, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = PALETTE.brass
    ctx.globalAlpha = 0.8
    ctx.lineWidth = 1
    ctx.stroke()

    const len = Math.hypot(x, y) || 1
    const ox = x / len
    const oy = y / len
    ctx.fillStyle = PALETTE.ivory
    ctx.globalAlpha = 0.78
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(p.label, x + ox * (rad + Math.max(16, R * 0.045)), y + oy * (rad + Math.max(16, R * 0.045)))
  }
  ctx.globalAlpha = 1
}

function drawSun(ctx: CanvasRenderingContext2D, R: number, sim: OrrerySim) {
  const sunR = R * 0.09
  const flash = sim.tickFlash
  const g = ctx.createRadialGradient(-sunR * 0.25, -sunR * 0.3, sunR * 0.1, 0, 0, sunR * 1.8)
  g.addColorStop(0, PALETTE.ivory)
  g.addColorStop(0.35, PALETTE.gilt)
  g.addColorStop(0.7, PALETTE.brass)
  g.addColorStop(1, 'rgba(198, 163, 90, 0)')
  ctx.fillStyle = g
  ctx.globalAlpha = 0.55 + flash * 0.35
  ctx.beginPath()
  ctx.arc(0, 0, sunR * 1.7, 0, Math.PI * 2)
  ctx.fill()

  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.arc(0, 0, sunR, 0, Math.PI * 2)
  const disc = ctx.createRadialGradient(-sunR * 0.3, -sunR * 0.35, 1, 0, 0, sunR)
  disc.addColorStop(0, '#F3E4B0')
  disc.addColorStop(0.55, PALETTE.gilt)
  disc.addColorStop(1, '#8A6A2E')
  ctx.fillStyle = disc
  ctx.fill()
  ctx.strokeStyle = PALETTE.brass
  ctx.lineWidth = 1.4
  ctx.stroke()

  ctx.strokeStyle = PALETTE.velvet
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 1
  const ticks = 16
  for (let i = 0; i < ticks; i++) {
    const th = (i / ticks) * Math.PI * 2
    const inner = sunR * (i % 4 === 0 ? 0.62 : 0.78)
    ctx.beginPath()
    ctx.moveTo(Math.cos(th) * inner, Math.sin(th) * inner)
    ctx.lineTo(Math.cos(th) * sunR * 0.92, Math.sin(th) * sunR * 0.92)
    ctx.stroke()
  }

  const hand = ((sim.slot % 64) / 64) * Math.PI * 2 - Math.PI / 2
  ctx.globalAlpha = 0.9
  ctx.strokeStyle = PALETTE.velvet
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(Math.cos(hand) * sunR * 0.72, Math.sin(hand) * sunR * 0.72)
  ctx.stroke()

  ctx.fillStyle = PALETTE.velvet
  ctx.globalAlpha = 0.55
  ctx.font = `${Math.max(8, R * 0.032)}px 'Chivo Mono', ui-monospace, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('SLOT', 0, sunR + R * 0.045)
  ctx.globalAlpha = 1
}

function drawHeldPlate(ctx: CanvasRenderingContext2D, R: number) {
  ctx.save()
  ctx.fillStyle = PALETTE.velvet
  ctx.globalAlpha = 0.72
  const w = R * 0.42
  const h = R * 0.1
  roundRect(ctx, -w / 2, R * 0.98, w, h, 3)
  ctx.fill()
  ctx.strokeStyle = PALETTE.gilt
  ctx.globalAlpha = 0.9
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = PALETTE.gilt
  ctx.font = `${Math.max(10, R * 0.04)}px 'Chivo Mono', ui-monospace, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('SAMPLE HELD', 0, R * 0.98 + h / 2)
  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ar = (pa >> 16) & 255
  const ag = (pa >> 8) & 255
  const ab = pa & 255
  const br = (pb >> 16) & 255
  const bg = (pb >> 8) & 255
  const bb = pb & 255
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`
}
