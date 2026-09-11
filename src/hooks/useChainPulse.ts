import { useEffect, useRef, useState } from 'react'
import { FAMILIES, type Family, WATCH } from '../lib/programs.ts'
import { RpcPool, rpcEndpoints, sampleFeeMicro, sampleTps, wellWarp, type SigInfo } from '../lib/rpc.ts'

export type PulseHud = {
  slot: number | null
  tps: number | null
  rttMs: number | null
  host: string
  degraded: boolean
  live: boolean
  warp: number
}

export type CometSpec = {
  family: Family
  failed: boolean
}

export type FamilyHeat = Record<Family, number>

const EMPTY: PulseHud = {
  slot: null,
  tps: null,
  rttMs: null,
  host: '—',
  degraded: false,
  live: false,
  warp: 0,
}

function emptyHeat(): FamilyHeat {
  return { SYS: 0, JUP: 0, RAY: 0, TKN: 0, STK: 0, '???': 0 }
}

export function useChainPulse(paused: boolean) {
  const [hud, setHud] = useState<PulseHud>(EMPTY)
  const queueRef = useRef<CometSpec[]>([])
  const seenRef = useRef(new Set<string>())
  const heatRef = useRef<FamilyHeat>(emptyHeat())
  const countsRef = useRef<FamilyHeat>(emptyHeat())
  const poolRef = useRef<RpcPool | null>(null)
  if (!poolRef.current) poolRef.current = new RpcPool(rpcEndpoints())

  useEffect(() => {
    if (paused) return
    const pool = poolRef.current!
    const ac = new AbortController()
    let watchAt = 0
    let lastSlot = -1e12
    let lastPerf = -1e12
    let lastFee = -1e12
    let lastSig = -1e12
    let lastDecay = -1e12
    let fails = 0
    let prevSlot: number | null = null
    let tps: number | null = null
    let feeMicro: number | null = null

    const tick = async () => {
      if (ac.signal.aborted) return
      const now = performance.now()
      if (now - lastDecay > 900) {
        lastDecay = now
        const c = countsRef.current
        for (const f of FAMILIES) {
          c[f] *= 0.72
          heatRef.current[f] += (Math.min(1, c[f] / 8) - heatRef.current[f]) * 0.28
        }
      }
      try {
        if (now - lastSlot > 450) {
          lastSlot = now
          const { value: slot, rttMs } = await pool.getSlot()
          if (ac.signal.aborted) return
          fails = 0
          const delta = prevSlot == null ? 1 : Math.max(0, slot - prevSlot)
          prevSlot = slot
          const warp = wellWarp({ feeMicro, tps, slotDelta: delta })
          setHud((h) => ({
            ...h,
            slot,
            rttMs,
            host: pool.host,
            degraded: false,
            live: true,
            warp: h.warp * 0.65 + warp * 0.35,
          }))
        }
        if (now - lastPerf > 8000) {
          lastPerf = now
          const { value: samples, rttMs } = await pool.getPerf()
          if (ac.signal.aborted) return
          tps = sampleTps(samples)
          setHud((h) => ({
            ...h,
            tps,
            rttMs: h.rttMs ?? rttMs,
            host: pool.host,
            live: true,
            degraded: false,
            warp: wellWarp({ feeMicro, tps, slotDelta: 1 }),
          }))
        }
        if (now - lastFee > 9000) {
          lastFee = now
          const { value: fees } = await pool.getFees()
          if (ac.signal.aborted) return
          feeMicro = sampleFeeMicro(fees)
          setHud((h) => ({
            ...h,
            live: true,
            warp: wellWarp({ feeMicro, tps, slotDelta: 1 }),
          }))
        }
        if (now - lastSig > 2200) {
          lastSig = now
          const watch = WATCH[watchAt % WATCH.length]!
          watchAt += 1
          const { value: sigs } = await pool.getSigs(watch.key, 14)
          if (ac.signal.aborted) return
          ingest(sigs, watch.family)
        }
      } catch {
        fails += 1
        if (fails >= 2) {
          setHud((h) => ({ ...h, degraded: true, live: false }))
        }
      }
    }

    const ingest = (sigs: SigInfo[], family: Family) => {
      const seen = seenRef.current
      const fresh: CometSpec[] = []
      for (const s of sigs) {
        if (seen.has(s.signature)) continue
        seen.add(s.signature)
        fresh.push({ family, failed: s.err != null })
      }
      if (fresh.length) {
        countsRef.current[family] += Math.min(12, fresh.length)
        queueRef.current.push(...fresh.reverse())
        if (queueRef.current.length > 60) {
          queueRef.current.splice(0, queueRef.current.length - 60)
        }
        if (seen.size > 400) {
          const keep = [...seen].slice(-200)
          seenRef.current = new Set(keep)
        }
      }
    }

    void tick()
    const id = window.setInterval(() => void tick(), 280)
    return () => {
      ac.abort()
      window.clearInterval(id)
    }
  }, [paused])

  const pull = (): CometSpec | null => {
    const q = queueRef.current
    return q.length ? (q.shift() ?? null) : null
  }

  const heat = (): FamilyHeat => heatRef.current

  return { hud, pull, heat }
}
