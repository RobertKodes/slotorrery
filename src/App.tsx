import { useCallback, useEffect, useRef, useState } from 'react'
import { drawOrrery, OrrerySim } from './engine/orrery.ts'
import { useChainPulse } from './hooks/useChainPulse.ts'
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion.ts'
import { FAMILIES, familyColor, familyLabel, type Family } from './lib/programs.ts'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<OrrerySim | null>(null)
  if (!simRef.current) simRef.current = new OrrerySim()

  const reduced = usePrefersReducedMotion()
  const [held, setHeld] = useState(false)
  const heldRef = useRef(false)
  const reducedRef = useRef(reduced)
  heldRef.current = held
  reducedRef.current = reduced

  const { hud, pull, heat } = useChainPulse(held)
  const pullRef = useRef(pull)
  const heatRef = useRef(heat)
  const hudRef = useRef(hud)
  pullRef.current = pull
  heatRef.current = heat
  hudRef.current = hud

  const setHold = useCallback((next: boolean) => {
    heldRef.current = next
    simRef.current!.frozen = next
    setHeld(next)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return
    const sim = simRef.current!
    let raf = 0
    let last = performance.now()

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const parent = canvas.parentElement ?? canvas
      const rect = parent.getBoundingClientRect()
      const cssW = Math.max(1, rect.width)
      const cssH = Math.max(1, rect.height)
      const w = Math.max(1, Math.floor(cssW * dpr))
      const h = Math.max(1, Math.floor(cssH * dpr))
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas.parentElement ?? canvas)

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      sim.frozen = heldRef.current
      sim.reduced = reducedRef.current
      sim.warp += (hudRef.current.warp - sim.warp) * Math.min(1, dt * 1.8)
      sim.step(dt, () => pullRef.current(), heatRef.current(), hudRef.current.slot)
      const parent = canvas.parentElement ?? canvas
      const rect = parent.getBoundingClientRect()
      drawOrrery(ctx, rect.width, rect.height, sim, {
        frozen: heldRef.current,
        reduced: reducedRef.current,
        grasp: sim.graspFamily,
      })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const canvasHold = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      const sim = simRef.current
      if (!canvas || !sim) return
      const rect = canvas.getBoundingClientRect()
      const cx = rect.width * 0.5
      const cy = rect.height * 0.5
      const maxR = Math.min(rect.width, rect.height) * 0.42
      const nx = e.clientX - rect.left - cx
      const ny = e.clientY - rect.top - cy
      const family = sim.hitPlanet(nx, ny, maxR)
      if (!family) return
      e.preventDefault()
      canvas.setPointerCapture(e.pointerId)
      sim.graspFamily = family
      setHold(true)
    },
    [setHold],
  )

  const canvasRelease = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      const sim = simRef.current
      if (!canvas || !sim) return
      if (sim.graspFamily == null) return
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
      sim.graspFamily = null
      setHold(false)
    },
    [setHold],
  )

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      if (e.target !== document.body) return
      e.preventDefault()
      setHold(true)
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      setHold(false)
    }
    const onBlur = () => setHold(false)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [setHold])

  const slot = hud.slot != null ? hud.slot.toLocaleString('en-US') : '—'
  const tps = hud.tps != null ? Math.round(hud.tps).toLocaleString('en-US') : '—'
  const rtt = hud.rttMs != null ? `${Math.round(hud.rttMs)}` : '—'
  const well = hud.warp < 0.22 ? 'round' : hud.warp < 0.55 ? 'warped' : 'strained'

  return (
    <div className="cabinet">
      <header className="plate">
        <div className="mast">
          <p className="kicker">cabinet instrument · mainnet</p>
          <h1>Slotorrery</h1>
          <p className="lede">the chain, as a brass orrery</p>
        </div>
        <button
          type="button"
          className={held ? 'hold pressed' : 'hold'}
          onPointerDown={(e) => {
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            setHold(true)
          }}
          onPointerUp={(e) => {
            try {
              e.currentTarget.releasePointerCapture(e.pointerId)
            } catch {
              /* already released */
            }
            setHold(false)
          }}
          onPointerCancel={() => setHold(false)}
          aria-pressed={held}
          aria-label={held ? 'Release to resume live feed' : 'Hold to freeze a sample'}
        >
          <span className="hold-knob" />
          <span className="hold-label">{held ? 'held' : 'hold'}</span>
        </button>
      </header>

      <main className="stage">
        <canvas
          ref={canvasRef}
          className="glass"
          role="img"
          aria-label="Brass orrery of live Solana program families and recent transactions"
          onPointerDown={canvasHold}
          onPointerUp={canvasRelease}
          onPointerCancel={canvasRelease}
        />
      </main>

      <footer className="hud">
        <Readout k="slot" v={slot} live={hud.live && !held} />
        <Readout k="tps" v={tps} live={hud.live && !held} />
        <Readout k="rtt" v={rtt} unit="ms" live={hud.live && !held} />
        <Readout k="well" v={hud.degraded ? 'degraded' : well} live={hud.live && !held} />
        <Readout k="rpc" v={hud.degraded ? 'degraded' : hud.host} live={hud.live && !held} />
        <ol className="legend">
          {FAMILIES.map((f) => (
            <li key={f}>
              <i style={{ background: familyColor(f as Family) }} />
              {familyLabel(f as Family)}
            </li>
          ))}
        </ol>
      </footer>
    </div>
  )
}

function Readout({
  k,
  v,
  unit,
  live,
}: {
  k: string
  v: string
  unit?: string
  live: boolean
}) {
  return (
    <div className={live ? 'read live' : 'read'}>
      <span className="k">{k}</span>
      <span className="v">
        {v}
        {unit ? <em>{unit}</em> : null}
      </span>
    </div>
  )
}
